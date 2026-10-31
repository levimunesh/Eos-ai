from datetime import date
from typing import Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response

from app.core.tenancy import OrgContext, get_org_context
from app.reports import service

router = APIRouter(prefix="/reports", tags=["reports"])


def _branches(branch_ids: str | None) -> list[UUID] | None:
    return [UUID(b) for b in branch_ids.split(",") if b.strip()] if branch_ids else None


@router.get("/sales")
async def sales_report(
    start: date = Query(..., alias="from"),
    end: date = Query(..., alias="to"),
    branch_ids: str | None = None,
    ctx: OrgContext = Depends(get_org_context),
) -> dict[str, Any]:
    return await service.build(ctx, start, end, _branches(branch_ids))


@router.get("/sales/export")
async def sales_report_export(
    format: Literal["xlsx", "pdf"],
    start: date = Query(..., alias="from"),
    end: date = Query(..., alias="to"),
    branch_ids: str | None = None,
    ctx: OrgContext = Depends(get_org_context),
) -> Response:
    report = await service.build(ctx, start, end, _branches(branch_ids))
    stem = f"eos-sales-{start.isoformat()}" + ("" if start == end else f"_{end.isoformat()}")
    if format == "xlsx":
        body = service.to_xlsx(report)
        media = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    else:
        body = service.to_pdf(report)
        media = "application/pdf"
    return Response(
        content=body,
        media_type=media,
        headers={"Content-Disposition": f'attachment; filename="{stem}.{format}"'},
    )
