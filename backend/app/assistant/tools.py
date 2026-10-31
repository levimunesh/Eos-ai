"""Typed, read-only tools the model may call. Each runs with the caller's OrgContext, so
organisation and branch access are enforced here, never taken from model arguments.
"""

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import select, text

from app.catalog.models import Branch
from app.core import currency
from app.core.errors import AppError
from app.core.tenancy import OrgContext
from app.kpi import engine, service
from app.kpi.definitions import quantize
from app.orgs.models import Organisation


class ToolError(Exception):
    pass


class Period(BaseModel):
    start: date = Field(description="First day, inclusive (YYYY-MM-DD)")
    end: date = Field(description="Last day, inclusive (YYYY-MM-DD)")
    branch_codes: list[str] | None = Field(
        default=None, description="Limit to these branch codes; omit for all branches"
    )


class KpiArgs(Period):
    compare_previous: bool = Field(
        default=True, description="Also return the previous period of equal length"
    )


class BreakdownArgs(Period):
    dimension: Literal["day", "month", "branch", "category", "product"]
    order: Literal["net", "gross_profit", "qty", "key"] = "net"
    limit: int = Field(default=10, ge=1, le=50)


class NoArgs(BaseModel):
    pass


async def _branch_ids(ctx: OrgContext, codes: list[str] | None) -> list[UUID] | None:
    if not codes:
        return None
    rows = (
        await ctx.session.execute(select(Branch.code, Branch.id).where(Branch.org_id == ctx.org_id))
    ).all()
    by_code = {c.casefold(): i for c, i in rows if ctx.can_see_branch(i)}
    unknown = [c for c in codes if c.casefold() not in by_code]
    if unknown:
        visible = sorted(c for c, i in rows if ctx.can_see_branch(i))
        raise ToolError(
            f"Unknown or not permitted branch codes: {', '.join(unknown)}. "
            f"Available: {', '.join(visible)}"
        )
    return [by_code[c.casefold()] for c in codes]


async def get_kpis(ctx: OrgContext, a: KpiArgs) -> dict[str, Any]:
    out = await service.kpis(
        ctx, a.start, a.end, await _branch_ids(ctx, a.branch_codes), a.compare_previous
    )
    keep = (
        "key",
        "label",
        "unit",
        "value",
        "previous_value",
        "change_pct",
        "status",
        "coverage_pct",
        "notes",
    )
    kpis = []
    for k in out["kpis"]:
        item = {f: k[f] for f in keep}
        if k["unit"] != "ratio" and k["value"] is not None and k["previous_value"] is not None:
            item["change_abs"] = str(Decimal(str(k["value"])) - Decimal(str(k["previous_value"])))
        kpis.append(item)
    return {
        "currency": out["currency"],
        "period": out["period"],
        "previous_period": out["previous_period"],
        "branch_codes": a.branch_codes,
        "kpis": kpis,
    }


async def get_sales_breakdown(ctx: OrgContext, a: BreakdownArgs) -> dict[str, Any]:
    out = await service.breakdown(
        ctx, a.start, a.end, await _branch_ids(ctx, a.branch_codes), a.dimension, a.limit, a.order
    )
    return {**out, "branch_codes": a.branch_codes}


async def get_expense_breakdown(ctx: OrgContext, a: Period) -> dict[str, Any]:
    service.check_range(a.start, a.end)
    org = (
        await ctx.session.execute(select(Organisation).where(Organisation.id == ctx.org_id))
    ).scalar_one()
    dp = currency.minor_units(org.base_currency)
    p = engine.params(
        org_id=ctx.org_id,
        base=org.base_currency,
        incl_tax=org.prices_include_tax,
        start=a.start,
        end=a.end,
        branch_ids=service.scope(ctx, await _branch_ids(ctx, a.branch_codes)),
    )
    e = await engine.expense_agg(ctx.session, p)
    return {
        "currency": org.base_currency,
        "period": {"from": a.start.isoformat(), "to": a.end.isoformat()},
        "branch_codes": a.branch_codes,
        "total": str(quantize(e.total, dp)),
        "by_category": {
            c: str(quantize(v, dp)) for c, v in sorted(e.by_category.items(), key=lambda x: -x[1])
        },
        "rows": e.rows,
        "rows_without_exchange_rate": e.unconverted_rows,
        "note": "Head-office expenses are excluded when branches are specified."
        if a.branch_codes
        else None,
    }


async def get_data_coverage(ctx: OrgContext, _: NoArgs) -> dict[str, Any]:
    scope = None if ctx.all_branches else list(ctx.branch_ids)
    r = (
        await ctx.session.execute(
            text(
                """
        SELECT min(business_date) AS first, max(business_date) AS last, count(*) AS receipts
          FROM eos.sales WHERE org_id = :org
           AND (cast(:scope as uuid[]) IS NULL OR branch_id = ANY(cast(:scope as uuid[])))
        """
            ),
            {"org": ctx.org_id, "scope": scope},
        )
    ).one()
    imports = await engine.last_imports(ctx.session, ctx.org_id)
    return {
        "sales_first_date": r.first.isoformat() if r.first else None,
        "sales_last_date": r.last.isoformat() if r.last else None,
        "receipts": r.receipts,
        "last_import_by_type": imports,
    }


async def list_branches(ctx: OrgContext, _: NoArgs) -> dict[str, Any]:
    rows = (
        await ctx.session.execute(
            select(Branch).where(Branch.org_id == ctx.org_id).order_by(Branch.code)
        )
    ).scalars()
    return {
        "branches": [
            {"code": b.code, "name": b.name, "city": b.city, "active": b.is_active}
            for b in rows
            if ctx.can_see_branch(b.id)
        ]
    }


@dataclass(frozen=True)
class Tool:
    name: str
    description: str
    args: type[BaseModel]
    fn: Callable[[OrgContext, Any], Awaitable[dict[str, Any]]]

    def schema(self) -> dict[str, Any]:
        s = self.args.model_json_schema()
        s.pop("title", None)
        return {"name": self.name, "description": self.description, "input_schema": s}


TOOLS = {
    t.name: t
    for t in [
        Tool(
            "get_kpis",
            "Headline KPIs for a date range: gross sales, discounts, returns, net sales, "
            "transactions, average ticket, COGS, gross profit, gross margin, operating "
            "expenses, inventory value. Includes the previous period, change, data status "
            "and notes about missing data.",
            KpiArgs,
            get_kpis,
        ),
        Tool(
            "get_sales_breakdown",
            "Net sales, transactions, quantity, COGS and gross profit grouped by day, month, "
            "branch, category or product, sorted and limited.",
            BreakdownArgs,
            get_sales_breakdown,
        ),
        Tool(
            "get_expense_breakdown",
            "Operating expenses by category for a date range, in base currency.",
            Period,
            get_expense_breakdown,
        ),
        Tool(
            "get_data_coverage",
            "Which dates have sales data and when each data type was last imported. Use it "
            "before saying data is missing.",
            NoArgs,
            get_data_coverage,
        ),
        Tool(
            "list_branches",
            "The branches this user can see, with codes and names.",
            NoArgs,
            list_branches,
        ),
    ]
}


def schemas() -> list[dict[str, Any]]:
    return [t.schema() for t in TOOLS.values()]


async def run_tool(ctx: OrgContext, name: str, raw_args: dict[str, Any]) -> tuple[dict, bool]:
    """Returns (result, is_error). Errors are returned to the model, not raised."""
    tool = TOOLS.get(name)
    if tool is None:
        return {"error": f"There is no tool called {name}"}, True
    try:
        args = tool.args.model_validate(raw_args or {})
    except ValidationError as e:
        return {
            "error": "Invalid arguments",
            "details": e.errors(include_url=False, include_context=False),
        }, True
    try:
        return await tool.fn(ctx, args), False
    except (ToolError, AppError) as e:
        return {"error": str(getattr(e, "message", e))}, True
