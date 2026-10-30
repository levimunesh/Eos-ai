from datetime import date
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import select

from app.core import currency
from app.core.errors import AppError, Forbidden
from app.core.tenancy import OrgContext
from app.kpi import engine
from app.kpi.definitions import (
    KpiValue,
    as_json,
    change_pct,
    coverage,
    expense_kpis,
    inventory_kpis,
    quantize,
    sales_kpis,
)
from app.orgs.models import Organisation

MAX_DAYS = 3 * 366

SOURCES = {
    "gross_sales": ["sales"],
    "discounts": ["sales"],
    "returns": ["sales"],
    "net_sales": ["sales"],
    "transactions": ["sales"],
    "avg_ticket": ["sales"],
    "cogs": ["sales", "product_costs"],
    "gross_profit": ["sales", "product_costs"],
    "gross_margin": ["sales", "product_costs"],
    "operating_expenses": ["expenses"],
    "inventory_value": ["inventory_counts"],
}


def scope(ctx: OrgContext, requested: list[UUID] | None) -> frozenset[UUID] | None:
    """Intersect requested branches with what the user may see. None means all branches."""
    if requested:
        req = frozenset(requested)
        if not ctx.all_branches and not req <= ctx.branch_ids:
            raise Forbidden("You don't have access to one or more of those branches")
        return req
    return None if ctx.all_branches else ctx.branch_ids


def check_range(start: date, end: date) -> None:
    if end < start:
        raise AppError("The end date is before the start date", code="bad_range")
    if (end - start).days > MAX_DAYS:
        raise AppError("Choose a range of three years or less", code="bad_range")


async def _org(ctx: OrgContext) -> Organisation:
    return (
        await ctx.session.execute(select(Organisation).where(Organisation.id == ctx.org_id))
    ).scalar_one()


async def _compute(ctx: OrgContext, org: Organisation, p: dict[str, Any]) -> list[KpiValue]:
    dp = currency.minor_units(org.base_currency)
    s = await engine.sales_agg(ctx.session, p)
    e = await engine.expense_agg(ctx.session, p)
    i = await engine.inventory_agg(ctx.session, p)
    out = sales_kpis(s, dp) + expense_kpis(e, dp) + inventory_kpis(i, dp)
    for k in out:
        if k.key == "inventory_value" and i.as_of_by_branch:
            k.notes.append(
                "As of the latest stock count per branch: "
                + ", ".join(f"{b} {d}" for b, d in i.as_of_by_branch.items())
            )
    return out


async def kpis(
    ctx: OrgContext, start: date, end: date, branch_ids: list[UUID] | None, compare: bool
) -> dict[str, Any]:
    check_range(start, end)
    org = await _org(ctx)
    branches = scope(ctx, branch_ids)
    base = dict(
        org_id=ctx.org_id,
        base=org.base_currency,
        incl_tax=org.prices_include_tax,
        branch_ids=branches,
    )
    current = await _compute(ctx, org, engine.params(start=start, end=end, **base))
    prev_start, prev_end = engine.previous_period(start, end)
    previous = (
        {
            k.key: k
            for k in await _compute(ctx, org, engine.params(start=prev_start, end=prev_end, **base))
        }
        if compare
        else {}
    )
    imports = await engine.last_imports(ctx.session, ctx.org_id)
    items = []
    for k in current:
        prev = previous.get(k.key)
        prev_value = prev.value if prev and prev.status != "no_data" else None
        srcs = SOURCES[k.key]
        last = max((imports[s] for s in srcs if s in imports), default=None)
        items.append(
            {
                "key": k.key,
                "label": k.label,
                "unit": k.unit,
                "value": as_json(k.value),
                "previous_value": as_json(prev_value),
                "change_pct": as_json(change_pct(k.value, prev_value)) if compare else None,
                "status": k.status,
                "coverage_pct": as_json(k.coverage_pct),
                "row_count": k.row_count,
                "notes": k.notes,
                "sources": srcs,
                "last_import_at": last,
            }
        )
    return {
        "currency": org.base_currency,
        "currency_decimals": currency.minor_units(org.base_currency),
        "period": {"from": start.isoformat(), "to": end.isoformat()},
        "previous_period": (
            {"from": prev_start.isoformat(), "to": prev_end.isoformat()} if compare else None
        ),
        "branch_ids": sorted(str(b) for b in branches) if branches is not None else None,
        "kpis": items,
    }


async def breakdown(
    ctx: OrgContext,
    start: date,
    end: date,
    branch_ids: list[UUID] | None,
    dimension: str,
    limit: int,
    order: str,
) -> dict[str, Any]:
    check_range(start, end)
    if dimension not in engine.DIMENSIONS:
        raise AppError(f"Unknown dimension '{dimension}'", code="bad_dimension")
    org = await _org(ctx)
    dp = currency.minor_units(org.base_currency)
    p = engine.params(
        org_id=ctx.org_id,
        base=org.base_currency,
        incl_tax=org.prices_include_tax,
        start=start,
        end=end,
        branch_ids=scope(ctx, branch_ids),
    )
    rows = await engine.sales_breakdown(ctx.session, p, dimension, limit, order)

    def q(v: Any) -> str:
        return str(quantize(Decimal(v), dp))

    return {
        "dimension": dimension,
        "currency": org.base_currency,
        "period": {"from": start.isoformat(), "to": end.isoformat()},
        "rows": [
            {
                "key": r["key"],
                "label": r["label"],
                "net_sales": q(r["net"]),
                "transactions": r["transactions"],
                "qty": str(r["qty"]),
                "cogs": q(r["cogs"]),
                "gross_profit": q(r["gross_profit"]),
                "cost_coverage_pct": str(coverage(r["costed_net"], r["net"])),
            }
            for r in rows
        ],
    }
