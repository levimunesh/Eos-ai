from datetime import date
from decimal import Decimal
from typing import Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import bindparam, text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from app.core import currency
from app.core.errors import NotFound
from app.core.tenancy import OrgContext, get_org_context
from app.kpi import insights, service
from app.kpi.definitions import quantize

router = APIRouter(tags=["analytics"])
BRANCHES = bindparam("branches", type_=ARRAY(PG_UUID(as_uuid=True)))


def _money(v: Decimal, ccy: str) -> str:
    return str(quantize(v, currency.minor_units(ccy) if currency.is_supported(ccy) else 4))


def _branch_list(branch_ids: str | None) -> list[UUID] | None:
    if not branch_ids:
        return None
    return [UUID(b) for b in branch_ids.split(",") if b.strip()]


@router.get("/kpis")
async def kpis(
    start: date = Query(..., alias="from"),
    end: date = Query(..., alias="to"),
    branch_ids: str | None = Query(None, description="Comma-separated branch ids"),
    compare: Literal["previous_period", "none"] = "previous_period",
    ctx: OrgContext = Depends(get_org_context),
) -> dict[str, Any]:
    return await service.kpis(
        ctx, start, end, _branch_list(branch_ids), compare == "previous_period"
    )


@router.get("/insights")
async def get_insights(
    start: date = Query(..., alias="from"),
    end: date = Query(..., alias="to"),
    branch_ids: str | None = None,
    ctx: OrgContext = Depends(get_org_context),
) -> dict[str, Any]:
    """What changed, what drove it and what needs attention; computed, never generated."""
    return await insights.compute(ctx, start, end, _branch_list(branch_ids))


@router.get("/analytics/sales")
async def sales_breakdown(
    dimension: Literal["day", "month", "branch", "category", "product"],
    start: date = Query(..., alias="from"),
    end: date = Query(..., alias="to"),
    branch_ids: str | None = None,
    limit: int = Query(100, ge=1, le=1000),
    order: Literal["net", "key", "gross_profit", "qty"] = "net",
    ctx: OrgContext = Depends(get_org_context),
) -> dict[str, Any]:
    return await service.breakdown(
        ctx, start, end, _branch_list(branch_ids), dimension, limit, order
    )


@router.get("/records/sales")
async def sales_records(
    start: date = Query(..., alias="from"),
    end: date = Query(..., alias="to"),
    branch_ids: str | None = None,
    status: Literal["completed", "refund", "voided"] | None = None,
    receipt: str | None = Query(None, max_length=100),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    ctx: OrgContext = Depends(get_org_context),
) -> dict[str, Any]:
    service.check_range(start, end)
    branches = service.scope(ctx, _branch_list(branch_ids))
    p = {
        "org": ctx.org_id,
        "start": start,
        "end": end,
        "all_branches": branches is None,
        "branches": list(branches or []),
        "status": status,
        "receipt": f"%{receipt.strip()}%" if receipt else None,
        "limit": limit,
        "offset": offset,
    }
    where = """
      s.org_id = :org AND s.business_date BETWEEN :start AND :end
      AND (:all_branches OR s.branch_id = ANY(:branches))
      AND (cast(:status as text) IS NULL OR s.status::text = :status)
      AND (cast(:receipt as text) IS NULL OR s.receipt_no ILIKE :receipt)
    """
    total = (
        await ctx.session.execute(
            text(f"SELECT count(*) FROM eos.sales s WHERE {where}").bindparams(BRANCHES),
            p,
        )
    ).scalar_one()
    rows = await ctx.session.execute(
        text(
            f"""
            SELECT s.id, s.receipt_no, b.code AS branch_code, s.sold_at, s.business_date,
                   s.status::text AS status, s.currency, s.ref_receipt_no,
                   count(l.id) AS lines,
                   coalesce(sum(l.qty * l.unit_price - l.discount), 0) AS net,
                   s.source_import_id, s.source_row_number, i.file_name
              FROM eos.sales s
              JOIN eos.branches b ON b.id = s.branch_id
              LEFT JOIN eos.sale_lines l ON l.sale_id = s.id
              LEFT JOIN eos.imports i ON i.id = s.source_import_id
             WHERE {where}
             GROUP BY s.id, b.code, i.file_name
             ORDER BY s.sold_at DESC, s.receipt_no
             LIMIT :limit OFFSET :offset
            """
        ).bindparams(BRANCHES),
        p,
    )
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "rows": [
            {
                "id": str(r.id),
                "receipt_no": r.receipt_no,
                "branch_code": r.branch_code,
                "sold_at": r.sold_at.isoformat(),
                "business_date": r.business_date.isoformat(),
                "status": r.status,
                "currency": r.currency,
                "ref_receipt_no": r.ref_receipt_no,
                "lines": r.lines,
                "net": _money(r.net, r.currency),
                "source": {
                    "import_id": str(r.source_import_id) if r.source_import_id else None,
                    "file_name": r.file_name,
                    "row": r.source_row_number,
                },
            }
            for r in rows
        ],
    }


@router.get("/records/sales/{sale_id}")
async def sale_detail(sale_id: UUID, ctx: OrgContext = Depends(get_org_context)) -> dict[str, Any]:
    head = (
        await ctx.session.execute(
            text(
                """
                SELECT s.id, s.receipt_no, s.branch_id, b.code AS branch_code, s.sold_at,
                       s.business_date, s.status::text AS status, s.currency, s.ref_receipt_no,
                       s.customer_ref, s.source_import_id, i.file_name
                  FROM eos.sales s JOIN eos.branches b ON b.id = s.branch_id
                  LEFT JOIN eos.imports i ON i.id = s.source_import_id
                 WHERE s.id = :id AND s.org_id = :org
                """
            ),
            {"id": sale_id, "org": ctx.org_id},
        )
    ).one_or_none()
    if head is None or not ctx.can_see_branch(head.branch_id):
        raise NotFound("Sale not found")
    lines = await ctx.session.execute(
        text(
            """
            SELECT l.id, p.sku, p.name, l.description, l.qty, l.unit_price, l.discount, l.tax,
                   l.qty * l.unit_price - l.discount AS net, l.source_row_number
              FROM eos.sale_lines l LEFT JOIN eos.products p ON p.id = l.product_id
             WHERE l.sale_id = :id AND l.org_id = :org
             ORDER BY l.source_row_number
            """
        ),
        {"id": sale_id, "org": ctx.org_id},
    )
    return {
        "id": str(head.id),
        "receipt_no": head.receipt_no,
        "branch_code": head.branch_code,
        "sold_at": head.sold_at.isoformat(),
        "business_date": head.business_date.isoformat(),
        "status": head.status,
        "currency": head.currency,
        "ref_receipt_no": head.ref_receipt_no,
        "customer_ref": head.customer_ref,
        "source": {
            "import_id": str(head.source_import_id) if head.source_import_id else None,
            "file_name": head.file_name,
        },
        "lines": [
            {
                "id": str(r.id),
                "sku": r.sku,
                "name": r.name,
                "description": r.description,
                "qty": str(r.qty),
                "unit_price": str(r.unit_price),
                "discount": str(r.discount),
                "tax": str(r.tax),
                "net": _money(r.net, head.currency),
                "source_row": r.source_row_number,
            }
            for r in lines
        ],
    }
