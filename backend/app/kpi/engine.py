"""SQL aggregation for KPIs and breakdowns. All arithmetic happens in Postgres numeric;
nothing here uses floats, and nothing is estimated.
"""

from datetime import date, timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import bindparam, text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.ext.asyncio import AsyncSession

from app.kpi.definitions import ExpenseAgg, InventoryAgg, SalesAgg

BRANCHES = bindparam("branches", type_=ARRAY(PG_UUID(as_uuid=True)))


def _fx(alias_currency: str, alias_date: str) -> str:
    """Rate to base for a currency on a date: latest rate on or before that date."""
    return (
        f"CASE WHEN {alias_currency} = :base THEN 1::numeric ELSE ("
        f"SELECT f.rate_to_base FROM eos.fx_rates f WHERE f.org_id = :org "
        f"AND f.currency = {alias_currency} AND f.rate_date <= {alias_date} "
        f"ORDER BY f.rate_date DESC LIMIT 1) END"
    )


# Cost and exchange-rate lookups use validity ranges built once per query and joined by
# date, rather than a lookup per line: the same answer as "latest on or before the date",
# at a fraction of the cost on large periods.
SALES_LINES_CTE = """
WITH fx_ranges AS (
  SELECT currency, rate_to_base, rate_date AS valid_from,
         coalesce(lead(rate_date) OVER (PARTITION BY currency ORDER BY rate_date),
                  'infinity'::date) AS valid_to
    FROM eos.fx_rates WHERE org_id = :org
), cost_ranges AS (
  SELECT product_id, currency, unit_cost, effective_from AS valid_from,
         coalesce(lead(effective_from) OVER (PARTITION BY product_id ORDER BY effective_from),
                  'infinity'::date) AS valid_to
    FROM eos.product_costs WHERE org_id = :org
), lines AS (
  SELECT s.id AS sale_id, s.status, s.branch_id, s.business_date, s.currency,
         l.id AS line_id, l.product_id, l.qty, l.discount,
         (l.qty * l.unit_price - l.discount
            - CASE WHEN :incl_tax THEN l.tax ELSE 0 END) AS net_ccy,
         CASE WHEN s.currency = :base THEN 1::numeric ELSE fs.rate_to_base END AS rate,
         round(cr.unit_cost
               * CASE WHEN cr.currency = :base THEN 1::numeric ELSE fc.rate_to_base END, 4)
           AS unit_cost_base
    FROM eos.sales s
    JOIN eos.sale_lines l ON l.sale_id = s.id AND l.org_id = :org
    LEFT JOIN fx_ranges fs
      ON fs.currency = s.currency
     AND s.business_date >= fs.valid_from AND s.business_date < fs.valid_to
    LEFT JOIN cost_ranges cr
      ON cr.product_id = l.product_id
     AND s.business_date >= cr.valid_from AND s.business_date < cr.valid_to
    LEFT JOIN fx_ranges fc
      ON fc.currency = cr.currency
     AND s.business_date >= fc.valid_from AND s.business_date < fc.valid_to
   WHERE s.org_id = :org
     AND s.business_date BETWEEN :start AND :end
     AND s.status <> 'voided'
     AND (:all_branches OR s.branch_id = ANY(:branches))
)
"""

SALES_AGG_SQL = (
    SALES_LINES_CTE
    + """
SELECT
  coalesce(sum(CASE WHEN status = 'completed' THEN (net_ccy + discount) * rate END), 0) AS gross,
  coalesce(sum(CASE WHEN status = 'completed' THEN discount * rate END), 0) AS discounts,
  coalesce(-sum(CASE WHEN status = 'refund' THEN net_ccy * rate END), 0) AS returns,
  coalesce(sum(net_ccy * rate), 0) AS net,
  count(DISTINCT sale_id) FILTER (WHERE rate IS NOT NULL) AS transactions,
  coalesce(sum(round(qty * unit_cost_base, 4)) FILTER (WHERE rate IS NOT NULL), 0) AS cogs,
  coalesce(sum(net_ccy * rate) FILTER (WHERE unit_cost_base IS NOT NULL), 0) AS costed_net,
  count(*) AS lines,
  count(*) FILTER (WHERE rate IS NULL) AS unconverted
FROM lines
"""
)

UNCONVERTED_SQL = (
    SALES_LINES_CTE
    + "SELECT currency, sum(net_ccy) FROM lines WHERE rate IS NULL GROUP BY currency"
)

DIMENSIONS = {
    "day": ("business_date::text", "business_date::text"),
    "month": ("to_char(business_date, 'YYYY-MM')", "to_char(business_date, 'YYYY-MM')"),
    "branch": ("b.code", "b.code"),
    "category": ("coalesce(p.category, 'Uncategorised')", "coalesce(p.category, 'Uncategorised')"),
    "product": ("coalesce(p.sku, '?') || ' · ' || coalesce(p.name, '')", "coalesce(p.sku, '?')"),
}


def params(
    *,
    org_id: UUID,
    base: str,
    incl_tax: bool,
    start: date,
    end: date,
    branch_ids: frozenset[UUID] | None,
) -> dict[str, Any]:
    return {
        "org": org_id,
        "base": base,
        "incl_tax": incl_tax,
        "start": start,
        "end": end,
        "all_branches": branch_ids is None,
        "branches": list(branch_ids or []),
    }


async def sales_agg(s: AsyncSession, p: dict[str, Any]) -> SalesAgg:
    r = (await s.execute(text(SALES_AGG_SQL).bindparams(BRANCHES), p)).one()
    agg = SalesAgg(
        gross=r.gross,
        discounts=r.discounts,
        returns=r.returns,
        net=r.net,
        transactions=r.transactions,
        cogs=r.cogs,
        costed_net=r.costed_net,
        lines=r.lines,
        unconverted_lines=r.unconverted,
    )
    if agg.unconverted_lines:
        rows = await s.execute(text(UNCONVERTED_SQL).bindparams(BRANCHES), p)
        agg.unconverted_by_currency = {c: v for c, v in rows}
    return agg


async def expense_agg(s: AsyncSession, p: dict[str, Any]) -> ExpenseAgg:
    sql = f"""
    SELECT category, count(*) AS n,
           sum(round(amount * rate, 4)) AS total,
           count(*) FILTER (WHERE rate IS NULL) AS unconverted
      FROM (SELECT e.category, e.amount, {_fx("e.currency", "e.incurred_on")} AS rate
              FROM eos.expenses e
             WHERE e.org_id = :org AND e.incurred_on BETWEEN :start AND :end
               AND (:all_branches OR e.branch_id = ANY(:branches))) x
     GROUP BY category ORDER BY category
    """
    agg = ExpenseAgg()
    for cat, n, total, unconverted in await s.execute(text(sql).bindparams(BRANCHES), p):
        agg.rows += n
        agg.unconverted_rows += unconverted
        agg.by_category[cat] = total or Decimal(0)
        agg.total += total or Decimal(0)
    return agg


async def inventory_agg(s: AsyncSession, p: dict[str, Any]) -> InventoryAgg:
    """Latest stock count on or before the period end, per branch. Count unit costs are in
    base currency (the count file states its cost column)."""
    sql = """
    WITH latest AS (
      SELECT branch_id, max(count_date) AS d FROM eos.inventory_counts
       WHERE org_id = :org AND count_date <= :end
         AND (:all_branches OR branch_id = ANY(:branches))
       GROUP BY branch_id)
    SELECT b.code, latest.d, count(*) AS n,
           coalesce(sum(round(ic.qty * ic.unit_cost, 4)), 0) AS value,
           count(*) FILTER (WHERE ic.unit_cost IS NULL) AS uncosted
      FROM latest
      JOIN eos.inventory_counts ic
        ON ic.org_id = :org AND ic.branch_id = latest.branch_id AND ic.count_date = latest.d
      JOIN eos.branches b ON b.id = ic.branch_id
     GROUP BY b.code, latest.d ORDER BY b.code
    """
    agg = InventoryAgg()
    for code, d, n, value, uncosted in await s.execute(text(sql).bindparams(BRANCHES), p):
        agg.rows += n
        agg.uncosted_rows += uncosted
        agg.value += value
        agg.as_of_by_branch[code] = d.isoformat()
    return agg


async def sales_breakdown(
    s: AsyncSession, p: dict[str, Any], dimension: str, limit: int, order: str = "net"
) -> list[dict[str, Any]]:
    label, key = DIMENSIONS[dimension]
    order_sql = {
        "net": "net DESC",
        "key": "key ASC",
        "gross_profit": "gross_profit DESC",
        "qty": "qty DESC",
    }[order]
    sql = (
        SALES_LINES_CTE
        + f"""
    SELECT {key} AS key, {label} AS label,
           coalesce(sum(net_ccy * rate), 0) AS net,
           count(DISTINCT sale_id) FILTER (WHERE rate IS NOT NULL) AS transactions,
           coalesce(sum(qty), 0) AS qty,
           coalesce(sum(round(qty * unit_cost_base, 4)), 0) AS cogs,
           coalesce(sum(net_ccy * rate) FILTER (WHERE unit_cost_base IS NOT NULL), 0)
             AS costed_net,
           coalesce(sum(net_ccy * rate), 0)
             - coalesce(sum(round(qty * unit_cost_base, 4)), 0) AS gross_profit
      FROM lines
      LEFT JOIN eos.branches b ON b.id = lines.branch_id
      LEFT JOIN eos.products p ON p.id = lines.product_id
     GROUP BY 1, 2
     ORDER BY {order_sql}
     LIMIT :limit
    """
    )
    rows = await s.execute(text(sql).bindparams(BRANCHES), {**p, "limit": limit})
    return [dict(r._mapping) for r in rows]


async def last_imports(s: AsyncSession, org_id: UUID) -> dict[str, str]:
    rows = await s.execute(
        text(
            "SELECT entity_type, max(finished_at) FROM eos.imports "
            "WHERE org_id = :org AND status = 'done' GROUP BY entity_type"
        ),
        {"org": org_id},
    )
    return {e: t.isoformat() for e, t in rows if t}


def previous_period(start: date, end: date) -> tuple[date, date]:
    days = (end - start).days + 1
    return start - timedelta(days=days), start - timedelta(days=1)
