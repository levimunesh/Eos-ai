"""Validate and load one import.

Every non-blank data row ends in exactly one outcome: imported, rejected (with a reason in
import_errors) or duplicate. The whole commit runs in one transaction, so a failure leaves
nothing half-written and the job can simply be retried.
"""

import hashlib
from collections import Counter, defaultdict
from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

from sqlalchemy import and_, delete, insert, select, tuple_, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.catalog.models import Branch
from app.ingest.convert import CellError, ParseOptions, convert, is_blank
from app.ingest.models import Import, ImportErrorRow
from app.ingest.parsing import Table
from app.ingest.specs import ENTITIES, EntitySpec
from app.orgs.models import Organisation
from app.transactions.models import (
    Expense,
    FxRate,
    InventoryCount,
    Product,
    ProductCost,
    Purchase,
    PurchaseLine,
    Sale,
    SaleLine,
    Supplier,
)

CHUNK = 5000
ERROR_SAMPLE = 25


@dataclass
class RowErr:
    row: int
    column: str | None
    code: str
    message: str


@dataclass
class Ctx:
    session: AsyncSession
    org: Organisation
    imp: Import
    spec: EntitySpec
    table: Table
    column_map: dict[str, str]
    opts: ParseOptions
    allowed_branch_ids: frozenset[UUID] | None  # None = all branches
    conflict_mode: str
    dry_run: bool
    tz: ZoneInfo = field(init=False)

    def __post_init__(self) -> None:
        self.tz = ZoneInfo(self.org.timezone)


@dataclass
class Outcome:
    imported: set[int] = field(default_factory=set)
    duplicate_in_file: set[int] = field(default_factory=set)
    duplicate_existing: set[int] = field(default_factory=set)
    errors: list[RowErr] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    totals: dict[str, Any] = field(default_factory=dict)
    replaced_records: int = 0

    @property
    def rejected(self) -> set[int]:
        return {e.row for e in self.errors}

    def reject(self, row: int, code: str, message: str, column: str | None = None) -> None:
        self.errors.append(RowErr(row, column, code, message))


def _key(s: str) -> str:
    return s.strip().casefold()


async def _lookup(session: AsyncSession, model, attr: str, org_id: UUID) -> dict[str, UUID]:
    rows = await session.execute(
        select(getattr(model, attr), model.id).where(model.org_id == org_id)
    )
    return {_key(code): id_ for code, id_ in rows}


async def _insert_many(session: AsyncSession, model, rows: list[dict[str, Any]]) -> None:
    for i in range(0, len(rows), CHUNK):
        await session.execute(insert(model), rows[i : i + CHUNK])


def _src(ctx: Ctx, row: int) -> dict[str, Any]:
    return {"org_id": ctx.org.id, "source_import_id": ctx.imp.id, "source_row_number": row}


# ---- row conversion ----------------------------------------------------------------------


def convert_rows(ctx: Ctx, out: Outcome) -> tuple[list[tuple[int, dict[str, Any]]], int]:
    """Convert mapped cells. Returns (valid rows, number of blank rows ignored)."""
    idx = {h: i for i, h in enumerate(ctx.table.headers)}
    mapped = [(f, ctx.column_map.get(f.key)) for f in ctx.spec.fields]
    good: list[tuple[int, dict[str, Any]]] = []
    blank = 0
    for i, r in enumerate(ctx.table.rows):
        row_no = ctx.table.file_row_number(i)
        if all(is_blank(c) for c in r):
            blank += 1
            continue
        values: dict[str, Any] = {}
        failed = False
        for f, col in mapped:
            raw = r[idx[col]] if col is not None else None
            if is_blank(raw):
                if f.kind == "currency":
                    values[f.key] = ctx.opts.default_currency
                elif f.required:
                    out.reject(row_no, "missing_value", f"{f.label} is empty", col)
                    failed = True
                else:
                    values[f.key] = None
                continue
            try:
                values[f.key] = convert(f.kind, raw, ctx.opts)
            except CellError as e:
                out.reject(row_no, e.code, f"{f.label}: {e.message}", col)
                failed = True
        if not failed:
            good.append((row_no, values))
    return good, blank


def _sig(values: dict[str, Any]) -> tuple:
    return tuple(sorted((k, str(v)) for k, v in values.items()))


def _dedupe_in_file(
    rows: list[tuple[int, dict[str, Any]]], key_fn, out: Outcome, what: str
) -> list[tuple[int, dict[str, Any]]]:
    """Identical repeat of a key -> duplicate. Same key, different values -> rejected."""
    first: dict[Any, tuple[int, tuple]] = {}
    kept = []
    for row_no, v in rows:
        k = key_fn(v)
        sig = _sig(v)
        if k in first:
            if first[k][1] == sig:
                out.duplicate_in_file.add(row_no)
            else:
                out.reject(
                    row_no,
                    "conflicting_row",
                    f"Another row ({first[k][0]}) has the same {what} with different values",
                )
            continue
        first[k] = (row_no, sig)
        kept.append((row_no, v))
    return kept


def _resolve_branch(
    ctx: Ctx,
    out: Outcome,
    row_no: int,
    code: str | None,
    branches: dict[str, UUID],
    required: bool = True,
) -> UUID | None | bool:
    """Branch id, None when optional and blank, or False after rejecting the row."""
    col = ctx.column_map.get("branch_code")
    if code is None:
        if required:
            out.reject(row_no, "missing_value", "Branch code is empty", col)
            return False
        return None
    bid = branches.get(_key(code))
    if bid is None:
        out.reject(row_no, "unknown_branch", f"Branch '{code}' is not set up in EOS", col)
        return False
    if ctx.allowed_branch_ids is not None and bid not in ctx.allowed_branch_ids:
        out.reject(row_no, "branch_not_permitted", f"You don't have access to branch '{code}'", col)
        return False
    return bid


def _resolve_product(
    ctx: Ctx, out: Outcome, row_no: int, sku: str, products: dict[str, UUID]
) -> UUID | bool:
    pid = products.get(_key(sku))
    if pid is None:
        out.reject(
            row_no,
            "unknown_product",
            f"Product '{sku}' is not in EOS; import products first",
            ctx.column_map.get("sku"),
        )
        return False
    return pid


def _date_range(dates: Iterable[date]) -> dict[str, str] | None:
    ds = [d for d in dates if d is not None]
    return {"from": min(ds).isoformat(), "to": max(ds).isoformat()} if ds else None


# ---- simple keyed entities (catalog, FX, stock counts) --------------------------------------


@dataclass
class KeyedPlan:
    model: Any
    key_cols: tuple[str, ...]
    update_cols: tuple[str, ...]
    records: list[tuple[int, tuple, dict[str, Any]]]  # row_no, key, column values


async def _apply_keyed(ctx: Ctx, out: Outcome, plan: KeyedPlan) -> None:
    m = plan.model
    keys = [k for _, k, _ in plan.records]
    existing: set[tuple] = set()
    cols = [getattr(m, c) for c in plan.key_cols]
    for i in range(0, len(keys), CHUNK):
        chunk = keys[i : i + CHUNK]
        if not chunk:
            continue
        rows = await ctx.session.execute(
            select(*cols).where(m.org_id == ctx.org.id, tuple_(*cols).in_(chunk))
        )
        existing.update(tuple(r) for r in rows)
    new_rows = []
    for row_no, k, vals in plan.records:
        if k in existing:
            if ctx.conflict_mode == "replace" and plan.update_cols:
                out.imported.add(row_no)
                out.replaced_records += 1
                if not ctx.dry_run:
                    cond = and_(
                        m.org_id == ctx.org.id, *(c == kv for c, kv in zip(cols, k, strict=True))
                    )
                    await ctx.session.execute(
                        update(m)
                        .where(cond)
                        .values(
                            **{c: vals[c] for c in plan.update_cols},
                            source_import_id=ctx.imp.id,
                            source_row_number=row_no,
                        )
                    )
            else:
                out.duplicate_existing.add(row_no)
            continue
        out.imported.add(row_no)
        new_rows.append({**_src(ctx, row_no), **vals})
    if not ctx.dry_run and new_rows:
        await _insert_many(ctx.session, m, new_rows)


async def load_branches(ctx: Ctx, rows, out: Outcome) -> None:
    rows = _dedupe_in_file(rows, lambda v: _key(v["code"]), out, "branch code")
    stored = {
        _key(c): c
        for c in (
            await ctx.session.execute(select(Branch.code).where(Branch.org_id == ctx.org.id))
        ).scalars()
    }
    recs = []
    for n, v in rows:
        code = stored.get(_key(v["code"]), v["code"])  # match existing codes case-insensitively
        recs.append((n, (code,), {"code": code, "name": v["name"], "city": v["city"]}))
    await _apply_keyed(ctx, out, KeyedPlan(Branch, ("code",), ("name", "city"), recs))
    out.totals = {"branches": len(recs)}


async def load_products(ctx: Ctx, rows, out: Outcome) -> None:
    rows = _dedupe_in_file(rows, lambda v: _key(v["sku"]), out, "product code")
    recs = [
        (
            n,
            (v["sku"],),
            {"sku": v["sku"], "name": v["name"], "category": v["category"], "unit": v["unit"]},
        )
        for n, v in rows
    ]
    await _apply_keyed(ctx, out, KeyedPlan(Product, ("sku",), ("name", "category", "unit"), recs))
    out.totals = {
        "products": len(recs),
        "categories": len({v["category"] for _, v in rows if v["category"]}),
    }


async def load_suppliers(ctx: Ctx, rows, out: Outcome) -> None:
    rows = _dedupe_in_file(rows, lambda v: _key(v["code"]), out, "supplier code")
    recs = [
        (n, (v["code"],), {"code": v["code"], "name": v["name"], "currency": v["currency"]})
        for n, v in rows
    ]
    await _apply_keyed(ctx, out, KeyedPlan(Supplier, ("code",), ("name", "currency"), recs))
    out.totals = {"suppliers": len(recs)}


async def load_product_costs(ctx: Ctx, rows, out: Outcome) -> None:
    products = await _lookup(ctx.session, Product, "sku", ctx.org.id)
    resolved = []
    for n, v in rows:
        if v["unit_cost"] < 0:
            out.reject(
                n, "negative_cost", "Unit cost can't be negative", ctx.column_map.get("unit_cost")
            )
            continue
        pid = _resolve_product(ctx, out, n, v["sku"], products)
        if pid is False:
            continue
        resolved.append((n, {**v, "product_id": pid}))
    resolved = _dedupe_in_file(
        resolved, lambda v: (v["product_id"], v["effective_from"]), out, "product and date"
    )
    recs = [
        (
            n,
            (v["product_id"], v["effective_from"]),
            {
                "product_id": v["product_id"],
                "effective_from": v["effective_from"],
                "unit_cost": v["unit_cost"],
                "currency": v["currency"],
            },
        )
        for n, v in resolved
    ]
    await _apply_keyed(
        ctx,
        out,
        KeyedPlan(ProductCost, ("product_id", "effective_from"), ("unit_cost", "currency"), recs),
    )
    out.totals = {
        "date_range": _date_range(v["effective_from"] for _, v in resolved),
        "currencies": dict(Counter(v["currency"] for _, v in resolved)),
    }


async def load_fx_rates(ctx: Ctx, rows, out: Outcome) -> None:
    kept = []
    for n, v in rows:
        if v["currency"] == ctx.org.base_currency:
            out.reject(
                n,
                "base_currency_rate",
                f"{v['currency']} is the base currency; it doesn't need a rate",
                ctx.column_map.get("currency"),
            )
        elif v["rate_to_base"] <= 0:
            out.reject(
                n,
                "invalid_rate",
                "Rate must be greater than zero",
                ctx.column_map.get("rate_to_base"),
            )
        else:
            kept.append((n, v))
    kept = _dedupe_in_file(
        kept, lambda v: (v["currency"], v["rate_date"]), out, "currency and date"
    )
    recs = [(n, (v["currency"], v["rate_date"]), v) for n, v in kept]
    await _apply_keyed(
        ctx, out, KeyedPlan(FxRate, ("currency", "rate_date"), ("rate_to_base",), recs)
    )
    out.totals = {"currencies": sorted({v["currency"] for _, v in kept})}


async def load_inventory_counts(ctx: Ctx, rows, out: Outcome) -> None:
    branches = await _lookup(ctx.session, Branch, "code", ctx.org.id)
    products = await _lookup(ctx.session, Product, "sku", ctx.org.id)
    resolved = []
    for n, v in rows:
        bid = _resolve_branch(ctx, out, n, v["branch_code"], branches)
        if bid is False:
            continue
        pid = _resolve_product(ctx, out, n, v["sku"], products)
        if pid is False:
            continue
        resolved.append(
            (
                n,
                {
                    "branch_id": bid,
                    "product_id": pid,
                    "count_date": v["count_date"],
                    "qty": v["qty"],
                    "unit_cost": v["unit_cost"],
                },
            )
        )
    resolved = _dedupe_in_file(
        resolved,
        lambda v: (v["branch_id"], v["product_id"], v["count_date"]),
        out,
        "branch, product and date",
    )
    negative = sum(1 for _, v in resolved if v["qty"] < 0)
    if negative:
        out.warnings.append(f"{negative} counts have negative quantities")
    no_cost = sum(1 for _, v in resolved if v["unit_cost"] is None)
    if no_cost:
        out.warnings.append(f"{no_cost} counts have no unit cost, so their value is unknown")
    recs = [(n, (v["branch_id"], v["product_id"], v["count_date"]), v) for n, v in resolved]
    await _apply_keyed(
        ctx,
        out,
        KeyedPlan(
            InventoryCount, ("branch_id", "product_id", "count_date"), ("qty", "unit_cost"), recs
        ),
    )
    out.totals = {
        "date_range": _date_range(v["count_date"] for _, v in resolved),
        "count_dates": len({v["count_date"] for _, v in resolved}),
    }


# ---- expenses -------------------------------------------------------------------------------


async def load_expenses(ctx: Ctx, rows, out: Outcome) -> None:
    branches = await _lookup(ctx.session, Branch, "code", ctx.org.id)
    recs = []
    for n, v in rows:
        bid = _resolve_branch(ctx, out, n, v["branch_code"], branches, required=False)
        if bid is False:
            continue
        if bid is None and ctx.allowed_branch_ids is not None:
            out.reject(
                n,
                "branch_not_permitted",
                "Head-office expenses need access to all branches",
                ctx.column_map.get("branch_code"),
            )
            continue
        h = hashlib.sha256(
            "|".join(
                str(x)
                for x in (
                    v["incurred_on"],
                    _key(v["branch_code"] or ""),
                    _key(v["category"]),
                    (v["description"] or "").strip(),
                    v["amount"],
                    v["currency"],
                )
            ).encode()
        ).hexdigest()
        recs.append(
            (
                n,
                {
                    "branch_id": bid,
                    "category": v["category"],
                    "description": v["description"],
                    "incurred_on": v["incurred_on"],
                    "amount": v["amount"],
                    "tax": v["tax"] or Decimal(0),
                    "currency": v["currency"],
                    "row_hash": h,
                },
            )
        )
    recs = _dedupe_in_file(recs, lambda v: v["row_hash"], out, "expense")
    existing: set[str] = set()
    hashes = [v["row_hash"] for _, v in recs]
    for i in range(0, len(hashes), CHUNK):
        existing.update(
            (
                await ctx.session.execute(
                    select(Expense.row_hash).where(
                        Expense.org_id == ctx.org.id, Expense.row_hash.in_(hashes[i : i + CHUNK])
                    )
                )
            ).scalars()
        )
    new = []
    for n, v in recs:
        if v["row_hash"] in existing:  # identical row: nothing to replace
            out.duplicate_existing.add(n)
            continue
        out.imported.add(n)
        new.append({**_src(ctx, n), **v})
    if not ctx.dry_run:
        await _insert_many(ctx.session, Expense, new)
    by_cat: dict[str, Decimal] = defaultdict(Decimal)
    for _, v in recs:
        by_cat[f"{v['category']} ({v['currency']})"] += v["amount"]
    out.totals = {
        "date_range": _date_range(v["incurred_on"] for _, v in recs),
        "by_category": {k: str(s) for k, s in sorted(by_cat.items())},
        "currencies": dict(Counter(v["currency"] for _, v in recs)),
    }


# ---- sales ----------------------------------------------------------------------------------


async def load_sales(ctx: Ctx, rows, out: Outcome) -> None:
    branches = await _lookup(ctx.session, Branch, "code", ctx.org.id)
    products = await _lookup(ctx.session, Product, "sku", ctx.org.id)
    col = ctx.column_map.get
    lines = []
    for n, v in rows:
        bid = _resolve_branch(ctx, out, n, v["branch_code"], branches)
        if bid is False:
            continue
        pid = _resolve_product(ctx, out, n, v["sku"], products)
        if pid is False:
            continue
        qty, price = v["qty"], v["unit_price"]
        disc, tax = v["discount"] or Decimal(0), v["tax"] or Decimal(0)
        status = v["status"] or ("refund" if qty < 0 else "completed")
        if qty == 0:
            out.reject(n, "zero_quantity", "Quantity is zero", col("qty"))
            continue
        if price < 0:
            out.reject(n, "negative_price", "Unit price can't be negative", col("unit_price"))
            continue
        if status == "completed" and qty < 0:
            out.reject(
                n,
                "negative_qty_on_sale",
                "Negative quantity on a completed sale; mark it as a refund",
                col("qty"),
            )
            continue
        if status == "refund" and qty > 0:  # some systems export refunds as positive lines
            qty, disc, tax = -qty, -disc, -tax
        local = v["sold_at"]
        lines.append(
            (
                n,
                {
                    "branch_id": bid,
                    "receipt_no": v["receipt_no"],
                    "product_id": pid,
                    "raw_product_ref": v["sku"],
                    "description": v["description"],
                    "qty": qty,
                    "unit_price": price,
                    "discount": disc,
                    "tax": tax,
                    "currency": v["currency"],
                    "status": status,
                    "ref_receipt_no": v["ref_receipt_no"],
                    "customer_ref": v["customer_ref"],
                    "line_no": v.get("line_no"),
                    "sold_at": local.replace(tzinfo=ctx.tz).astimezone(UTC),
                    "business_date": local.date(),
                },
            )
        )

    # With a line number, a repeated (receipt, line) is a duplicate row. Without one, two
    # identical lines can be a genuine repeat purchase, so they are kept and reported.
    if ctx.column_map.get("line_no"):
        uniq = _dedupe_in_file(
            lines,
            lambda v: (v["branch_id"], v["receipt_no"], v["line_no"]),
            out,
            "receipt and line number",
        )
    else:
        uniq = lines
        counts = Counter(_sig(v) for _, v in lines)
        repeated = sum(c - 1 for c in counts.values() if c > 1)
        if repeated:
            out.warnings.append(
                f"{repeated} lines are identical to another line on the same receipt. They are "
                "kept as repeat purchases. If your export repeats rows, map a line-number "
                "column so true duplicates can be detected."
            )

    receipts: dict[tuple[UUID, str], dict[str, Any]] = {}
    for n, v in uniq:
        k = (v["branch_id"], v["receipt_no"])
        hdr = receipts.get(k)
        if hdr is None:
            receipts[k] = {
                **{
                    f: v[f]
                    for f in (
                        "branch_id",
                        "receipt_no",
                        "sold_at",
                        "business_date",
                        "status",
                        "currency",
                        "ref_receipt_no",
                        "customer_ref",
                    )
                },
                "first_row": n,
                "lines": [(n, v)],
            }
            continue
        mismatch = next(
            (f for f in ("business_date", "status", "currency") if hdr[f] != v[f]), None
        )
        if mismatch:
            out.reject(
                n,
                "receipt_conflict",
                f"Receipt {v['receipt_no']} has a different {mismatch.replace('_', ' ')} "
                f"on row {hdr['first_row']}",
                col("receipt_no"),
            )
            continue
        hdr["lines"].append((n, v))

    existing: set[tuple[UUID, str]] = set()
    keys = list(receipts)
    for i in range(0, len(keys), CHUNK):
        rs = await ctx.session.execute(
            select(Sale.branch_id, Sale.receipt_no).where(
                Sale.org_id == ctx.org.id,
                tuple_(Sale.branch_id, Sale.receipt_no).in_(keys[i : i + CHUNK]),
            )
        )
        existing.update(tuple(r) for r in rs)

    sale_rows, line_rows, to_replace = [], [], []
    for k, hdr in receipts.items():
        if k in existing:
            if ctx.conflict_mode != "replace":
                out.duplicate_existing.update(n for n, _ in hdr["lines"])
                continue
            to_replace.append(k)
            out.replaced_records += 1
        sid = uuid4()
        sale_rows.append(
            {
                "id": sid,
                **_src(ctx, hdr["first_row"]),
                **{
                    f: hdr[f]
                    for f in (
                        "branch_id",
                        "receipt_no",
                        "sold_at",
                        "business_date",
                        "status",
                        "currency",
                        "ref_receipt_no",
                        "customer_ref",
                    )
                },
            }
        )
        for n, v in hdr["lines"]:
            out.imported.add(n)
            line_rows.append(
                {
                    **_src(ctx, n),
                    "sale_id": sid,
                    "product_id": v["product_id"],
                    "raw_product_ref": v["raw_product_ref"],
                    "description": v["description"],
                    "qty": v["qty"],
                    "unit_price": v["unit_price"],
                    "discount": v["discount"],
                    "tax": v["tax"],
                }
            )

    if not ctx.dry_run:
        for i in range(0, len(to_replace), CHUNK):
            await ctx.session.execute(
                delete(Sale).where(
                    Sale.org_id == ctx.org.id,
                    tuple_(Sale.branch_id, Sale.receipt_no).in_(to_replace[i : i + CHUNK]),
                )
            )
        await _insert_many(ctx.session, Sale, sale_rows)
        await _insert_many(ctx.session, SaleLine, line_rows)

    # Report: totals of what would be / was loaded, per branch, in each line's currency.
    code_of = {v: k for k, v in branches.items()}
    by_branch: dict[str, dict[str, Any]] = {}
    for k, hdr in receipts.items():
        if k in existing and ctx.conflict_mode != "replace":
            continue
        b = by_branch.setdefault(
            code_of.get(k[0], str(k[0])).upper(),
            {"receipts": 0, "lines": 0, "net_by_currency": defaultdict(Decimal)},
        )
        b["receipts"] += 1
        for _, v in hdr["lines"]:
            b["lines"] += 1
            b["net_by_currency"][v["currency"]] += v["qty"] * v["unit_price"] - v["discount"]
    for b in by_branch.values():
        b["net_by_currency"] = {
            c: str(x.quantize(Decimal("0.001"))) for c, x in b["net_by_currency"].items()
        }
    statuses = Counter(h["status"] for h in receipts.values())
    rejected_rows = {e.row for e in out.errors}
    out.totals = {
        "date_range": _date_range(h["business_date"] for h in receipts.values()),
        "receipts": len(receipts),
        "receipt_status": dict(statuses),
        "by_branch": dict(sorted(by_branch.items())),
        "currencies": dict(Counter(h["currency"] for h in receipts.values())),
    }
    if rejected_rows:
        out.warnings.append(
            "Rejected lines are left out; receipts that also had valid lines are imported "
            "without them. Fix and re-import the error rows to complete them."
        )


# ---- purchases ------------------------------------------------------------------------------


async def load_purchases(ctx: Ctx, rows, out: Outcome) -> None:
    branches = await _lookup(ctx.session, Branch, "code", ctx.org.id)
    products = await _lookup(ctx.session, Product, "sku", ctx.org.id)
    suppliers = await _lookup(ctx.session, Supplier, "code", ctx.org.id)
    sup_ccy = dict(
        (
            await ctx.session.execute(
                select(Supplier.id, Supplier.currency).where(Supplier.org_id == ctx.org.id)
            )
        ).all()
    )
    currency_mapped = "currency" in ctx.column_map and ctx.column_map["currency"]
    col = ctx.column_map.get
    lines = []
    for n, v in rows:
        sid = suppliers.get(_key(v["supplier_code"]))
        if sid is None:
            out.reject(
                n,
                "unknown_supplier",
                f"Supplier '{v['supplier_code']}' is not in EOS; import suppliers first",
                col("supplier_code"),
            )
            continue
        bid = _resolve_branch(ctx, out, n, v["branch_code"], branches, required=False)
        if bid is False:
            continue
        pid = _resolve_product(ctx, out, n, v["sku"], products)
        if pid is False:
            continue
        if v["unit_cost"] < 0:
            out.reject(n, "negative_cost", "Unit cost can't be negative", col("unit_cost"))
            continue
        currency = v["currency"] if currency_mapped else (sup_ccy.get(sid) or v["currency"])
        lines.append(
            (
                n,
                {
                    "supplier_id": sid,
                    "doc_no": v["doc_no"],
                    "branch_id": bid,
                    "purchased_on": v["purchased_on"],
                    "currency": currency,
                    "product_id": pid,
                    "qty": v["qty"],
                    "unit_cost": v["unit_cost"],
                    "tax": v["tax"] or Decimal(0),
                },
            )
        )
    seen: set[tuple] = set()
    docs: dict[tuple[UUID, str], dict[str, Any]] = {}
    for n, v in lines:
        s = _sig(v)
        if s in seen:
            out.duplicate_in_file.add(n)
            continue
        seen.add(s)
        k = (v["supplier_id"], v["doc_no"])
        d = docs.get(k)
        if d is None:
            docs[k] = {
                **{
                    f: v[f]
                    for f in ("supplier_id", "doc_no", "branch_id", "purchased_on", "currency")
                },
                "first_row": n,
                "lines": [(n, v)],
            }
            continue
        mismatch = next(
            (f for f in ("purchased_on", "branch_id", "currency") if d[f] != v[f]), None
        )
        if mismatch:
            out.reject(
                n,
                "document_conflict",
                f"Invoice {v['doc_no']} has a different {mismatch.replace('_', ' ')} on "
                f"row {d['first_row']}",
                col("doc_no"),
            )
            continue
        d["lines"].append((n, v))

    existing: set[tuple[UUID, str]] = set()
    keys = list(docs)
    for i in range(0, len(keys), CHUNK):
        rs = await ctx.session.execute(
            select(Purchase.supplier_id, Purchase.doc_no).where(
                Purchase.org_id == ctx.org.id,
                tuple_(Purchase.supplier_id, Purchase.doc_no).in_(keys[i : i + CHUNK]),
            )
        )
        existing.update(tuple(r) for r in rs)

    p_rows, l_rows, to_replace = [], [], []
    for k, d in docs.items():
        if k in existing:
            if ctx.conflict_mode != "replace":
                out.duplicate_existing.update(n for n, _ in d["lines"])
                continue
            to_replace.append(k)
            out.replaced_records += 1
        pid = uuid4()
        p_rows.append(
            {
                "id": pid,
                **_src(ctx, d["first_row"]),
                **{
                    f: d[f]
                    for f in ("supplier_id", "doc_no", "branch_id", "purchased_on", "currency")
                },
            }
        )
        for n, v in d["lines"]:
            out.imported.add(n)
            l_rows.append(
                {
                    **_src(ctx, n),
                    "purchase_id": pid,
                    "product_id": v["product_id"],
                    "qty": v["qty"],
                    "unit_cost": v["unit_cost"],
                    "tax": v["tax"],
                }
            )
    if not ctx.dry_run:
        for i in range(0, len(to_replace), CHUNK):
            await ctx.session.execute(
                delete(Purchase).where(
                    Purchase.org_id == ctx.org.id,
                    tuple_(Purchase.supplier_id, Purchase.doc_no).in_(to_replace[i : i + CHUNK]),
                )
            )
        await _insert_many(ctx.session, Purchase, p_rows)
        await _insert_many(ctx.session, PurchaseLine, l_rows)
    by_ccy: dict[str, Decimal] = defaultdict(Decimal)
    for d in docs.values():
        for _, v in d["lines"]:
            by_ccy[v["currency"]] += v["qty"] * v["unit_cost"]
    out.totals = {
        "date_range": _date_range(d["purchased_on"] for d in docs.values()),
        "documents": len(docs),
        "value_by_currency": {
            c: str(x.quantize(Decimal("0.001"))) for c, x in sorted(by_ccy.items())
        },
    }


LOADERS = {
    "branches": load_branches,
    "products": load_products,
    "suppliers": load_suppliers,
    "product_costs": load_product_costs,
    "fx_rates": load_fx_rates,
    "inventory_counts": load_inventory_counts,
    "expenses": load_expenses,
    "sales": load_sales,
    "purchases": load_purchases,
}


async def _fx_warnings(ctx: Ctx, out: Outcome) -> None:
    currencies: set[str] = set()
    for key in ("currencies",):
        c = out.totals.get(key)
        if isinstance(c, dict):
            currencies |= set(c)
        elif isinstance(c, list):
            currencies |= set(c)
    for key in ("value_by_currency",):
        currencies |= set(out.totals.get(key, {}) or {})
    foreign = sorted(c for c in currencies if c != ctx.org.base_currency)
    if not foreign or ctx.spec.key == "fx_rates":
        return
    have = set(
        (
            await ctx.session.execute(
                select(FxRate.currency)
                .where(FxRate.org_id == ctx.org.id, FxRate.currency.in_(foreign))
                .distinct()
            )
        ).scalars()
    )
    missing = [c for c in foreign if c not in have]
    if missing:
        out.warnings.append(
            f"No exchange rate on file for {', '.join(missing)}; figures in "
            f"{ctx.org.base_currency} will be marked incomplete until rates are imported."
        )


async def run(ctx: Ctx) -> dict[str, Any]:
    """Validate (dry run) or commit. Returns the quality report; counts go on the import."""
    out = Outcome()
    good, blank = convert_rows(ctx, out)
    await LOADERS[ctx.spec.key](ctx, good, out)
    await _fx_warnings(ctx, out)

    rejected = out.rejected
    duplicates = (out.duplicate_in_file | out.duplicate_existing) - rejected
    imported = out.imported - rejected - duplicates
    total = len(ctx.table.rows) - blank
    accounted = len(imported) + len(rejected) + len(duplicates)
    if accounted != total:  # an invariant, not a user error
        raise RuntimeError(f"Row accounting mismatch: {accounted} of {total} rows accounted for")

    imp = ctx.imp
    imp.rows_total, imp.rows_imported = total, len(imported)
    imp.rows_rejected, imp.rows_duplicate = len(rejected), len(duplicates)

    await ctx.session.execute(delete(ImportErrorRow).where(ImportErrorRow.import_id == imp.id))
    raw_by_row = {ctx.table.file_row_number(i): r for i, r in enumerate(ctx.table.rows)}
    err_rows = [
        {
            "org_id": ctx.org.id,
            "import_id": imp.id,
            "row_number": e.row,
            "column_name": e.column,
            "error_code": e.code,
            "message": e.message,
            "raw_row": {
                h: (None if c is None else str(c))
                for h, c in zip(ctx.table.headers, raw_by_row.get(e.row, []), strict=False)
            },
        }
        for e in sorted(out.errors, key=lambda e: e.row)
    ]
    await _insert_many(ctx.session, ImportErrorRow, err_rows)

    return {
        "dry_run": ctx.dry_run,
        "conflict_mode": ctx.conflict_mode,
        "rows_total": total,
        "rows_valid": len(imported),
        "rows_rejected": len(rejected),
        "rows_duplicate": len(duplicates),
        "duplicates": {
            "in_file": len(out.duplicate_in_file - rejected),
            "already_in_eos": len(out.duplicate_existing - rejected),
        },
        "replaced_records": out.replaced_records,
        "blank_rows_ignored": blank,
        "errors_by_code": dict(Counter(e.code for e in out.errors).most_common()),
        "errors_sample": [
            {"row": e.row, "column": e.column, "code": e.code, "message": e.message}
            for e in sorted(out.errors, key=lambda e: e.row)[:ERROR_SAMPLE]
        ],
        "totals": out.totals,
        "warnings": out.warnings,
        "generated_at": datetime.now(UTC).isoformat(),
    }


def entity(key: str) -> EntitySpec:
    return ENTITIES[key]
