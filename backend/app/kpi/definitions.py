"""KPI definitions (brief section 6). Pure functions over aggregates; no I/O.

Money rules, applied identically everywhere:
- Sales line net = qty x unit price - discount (minus line tax when the organisation's
  prices include tax). Refund lines carry negative quantities, so they subtract.
- Foreign amounts convert to base at the latest rate on or before the record's date.
- Unit costs convert to base and round to 4 decimals; each line's cost rounds to 4 decimals.
- Results round half-up to the base currency's minor units only when presented.
"""

from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

ZERO = Decimal(0)
PCT = Decimal("0.0001")


@dataclass
class SalesAgg:
    gross: Decimal = ZERO  # completed lines before discount, ex tax
    discounts: Decimal = ZERO  # completed lines
    returns: Decimal = ZERO  # refund lines, as a positive amount
    net: Decimal = ZERO  # all non-voided lines
    transactions: int = 0  # non-voided receipts (refund receipts count)
    cogs: Decimal = ZERO  # lines that have a unit cost
    costed_net: Decimal = ZERO  # net sales of lines that have a unit cost
    lines: int = 0
    unconverted_lines: int = 0  # foreign-currency lines with no exchange rate
    unconverted_by_currency: dict[str, Decimal] = field(default_factory=dict)


@dataclass
class ExpenseAgg:
    total: Decimal = ZERO
    by_category: dict[str, Decimal] = field(default_factory=dict)
    rows: int = 0
    unconverted_rows: int = 0


@dataclass
class InventoryAgg:
    value: Decimal = ZERO
    rows: int = 0
    uncosted_rows: int = 0
    as_of_by_branch: dict[str, str] = field(default_factory=dict)


def quantize(x: Decimal | None, places: int) -> Decimal | None:
    if x is None:
        return None
    return x.quantize(Decimal(1).scaleb(-places), rounding=ROUND_HALF_UP)


def safe_div(a: Decimal, b: Decimal | int) -> Decimal | None:
    return None if not b else Decimal(a) / Decimal(b)


def change_pct(current: Decimal | int | None, previous: Decimal | int | None) -> Decimal | None:
    """(current - previous) / |previous|; None when either is missing or previous is 0."""
    if current is None or previous is None or previous == 0:
        return None
    return quantize((Decimal(current) - Decimal(previous)) / abs(Decimal(previous)), 4)


def gross_margin(net: Decimal, cogs: Decimal) -> Decimal | None:
    m = safe_div(net - cogs, net)
    return quantize(m, 4)


def coverage(part: Decimal, whole: Decimal) -> Decimal:
    """Share of `whole` that `part` covers, 1 when there is nothing to cover."""
    if whole == 0:
        return Decimal(1)
    return quantize(part / whole, 4)


@dataclass
class KpiValue:
    key: str
    label: str
    unit: str  # "money" | "count" | "ratio"
    value: Decimal | int | None
    status: str = "complete"  # complete | partial | no_data
    coverage_pct: Decimal = Decimal(1)
    row_count: int = 0
    notes: list[str] = field(default_factory=list)


def sales_kpis(s: SalesAgg, dp: int) -> list[KpiValue]:
    fx_note = []
    fx_cov = Decimal(1)
    if s.unconverted_lines:
        fx_cov = coverage(Decimal(s.lines - s.unconverted_lines), Decimal(s.lines))
        fx_note = [
            f"{s.unconverted_lines} lines in "
            f"{', '.join(sorted(s.unconverted_by_currency))} have no exchange rate and are "
            "left out"
        ]
    status = "no_data" if s.lines == 0 else ("partial" if fx_note else "complete")
    cost_cov = coverage(s.costed_net, s.net) if s.net else Decimal(1)
    cost_status = (
        "no_data" if s.lines == 0 else ("partial" if (cost_cov < 1 or fx_note) else "complete")
    )
    cost_note = (
        [f"Unit cost is missing for items worth {(1 - cost_cov) * 100:.1f}% of net sales"]
        if cost_cov < 1
        else []
    )
    common = {"row_count": s.lines}
    return [
        KpiValue(
            "gross_sales",
            "Gross sales",
            "money",
            quantize(s.gross, dp),
            status,
            fx_cov,
            notes=fx_note,
            **common,
        ),
        KpiValue(
            "discounts",
            "Discounts",
            "money",
            quantize(s.discounts, dp),
            status,
            fx_cov,
            notes=fx_note,
            **common,
        ),
        KpiValue(
            "returns",
            "Returns",
            "money",
            quantize(s.returns, dp),
            status,
            fx_cov,
            notes=fx_note,
            **common,
        ),
        KpiValue(
            "net_sales",
            "Net sales",
            "money",
            quantize(s.net, dp),
            status,
            fx_cov,
            notes=fx_note,
            **common,
        ),
        KpiValue("transactions", "Transactions", "count", s.transactions, status, fx_cov, **common),
        KpiValue(
            "avg_ticket",
            "Average ticket",
            "money",
            quantize(safe_div(s.net, s.transactions), dp),
            status,
            fx_cov,
            notes=fx_note,
            **common,
        ),
        KpiValue(
            "cogs",
            "Cost of goods sold",
            "money",
            quantize(s.cogs, dp),
            cost_status,
            cost_cov,
            notes=cost_note + fx_note,
            **common,
        ),
        KpiValue(
            "gross_profit",
            "Gross profit",
            "money",
            quantize(s.net - s.cogs, dp),
            cost_status,
            cost_cov,
            notes=cost_note + fx_note,
            **common,
        ),
        KpiValue(
            "gross_margin",
            "Gross margin",
            "ratio",
            gross_margin(s.net, s.cogs),
            cost_status,
            cost_cov,
            notes=cost_note + fx_note,
            **common,
        ),
    ]


def expense_kpis(e: ExpenseAgg, dp: int) -> list[KpiValue]:
    cov = coverage(Decimal(e.rows - e.unconverted_rows), Decimal(e.rows)) if e.rows else 1
    status = "no_data" if e.rows == 0 else ("partial" if e.unconverted_rows else "complete")
    notes = (
        [f"{e.unconverted_rows} expenses have no exchange rate and are left out"]
        if e.unconverted_rows
        else []
    )
    return [
        KpiValue(
            "operating_expenses",
            "Operating expenses",
            "money",
            quantize(e.total, dp),
            status,
            Decimal(cov),
            e.rows,
            notes,
        )
    ]


def inventory_kpis(i: InventoryAgg, dp: int) -> list[KpiValue]:
    cov = coverage(Decimal(i.rows - i.uncosted_rows), Decimal(i.rows)) if i.rows else 1
    status = "no_data" if i.rows == 0 else ("partial" if i.uncosted_rows else "complete")
    notes = [f"{i.uncosted_rows} counted items have no unit cost"] if i.uncosted_rows else []
    return [
        KpiValue(
            "inventory_value",
            "Inventory value",
            "money",
            quantize(i.value, dp),
            status,
            Decimal(cov),
            i.rows,
            notes,
        )
    ]


def as_json(v: Decimal | int | None) -> Any:
    if v is None:
        return None
    return str(v) if isinstance(v, Decimal) else v
