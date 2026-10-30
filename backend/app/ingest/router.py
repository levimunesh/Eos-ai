from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, Query, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field

from app.core.config import get_settings
from app.core.errors import AppError
from app.core.tenancy import OrgContext, require_role
from app.ingest import jobs, service
from app.ingest.parsing import MAX_FILE_BYTES
from app.ingest.specs import ENTITIES
from app.orgs.models import Role

router = APIRouter(prefix="/imports", tags=["imports"])
manager_up = require_role(Role.manager)


class FieldOut(BaseModel):
    key: str
    label: str
    kind: str
    required: bool
    help: str


class EntityOut(BaseModel):
    key: str
    label: str
    description: str
    owner_only: bool
    depends_on: list[str]
    fields: list[FieldOut]


class ImportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    entity_type: str
    file_name: str
    file_size: int
    status: str
    options: dict[str, Any]
    column_map: dict[str, Any]
    preview: dict[str, Any]
    quality_report: dict[str, Any] | None
    conflict_mode: str | None
    rows_total: int | None
    rows_imported: int | None
    rows_rejected: int | None
    rows_duplicate: int | None
    queued_at: datetime | None
    started_at: datetime | None
    finished_at: datetime | None
    last_error: str | None
    created_at: datetime


class ImportSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    entity_type: str
    file_name: str
    status: str
    rows_total: int | None
    rows_imported: int | None
    rows_rejected: int | None
    rows_duplicate: int | None
    created_at: datetime
    finished_at: datetime | None


class MappingIn(BaseModel):
    column_map: dict[str, str | None]
    options: dict[str, Any] = Field(default_factory=dict)


class CommitIn(BaseModel):
    conflict_mode: Literal["skip", "replace"] = "skip"


def _kick(bg: BackgroundTasks) -> None:
    if get_settings().inline_jobs:
        bg.add_task(jobs.run_soon)


@router.get("/entities", response_model=list[EntityOut])
async def entities(_: OrgContext = Depends(manager_up)) -> list[EntityOut]:
    return [
        EntityOut(
            key=s.key,
            label=s.label,
            description=s.description,
            owner_only=s.owner_only,
            depends_on=list(s.depends_on),
            fields=[
                FieldOut(key=f.key, label=f.label, kind=f.kind, required=f.required, help=f.help)
                for f in s.fields
            ],
        )
        for s in ENTITIES.values()
    ]


@router.post("", response_model=ImportOut, status_code=201)
async def upload(
    entity_type: str = Form(...),
    file: UploadFile = File(...),
    ctx: OrgContext = Depends(manager_up),
) -> ImportOut:
    content = await file.read(MAX_FILE_BYTES + 1)
    if len(content) > MAX_FILE_BYTES:
        raise AppError("Files are limited to 25 MB", code="file_too_large")
    imp = await service.create_import(
        ctx, entity_type=entity_type, file_name=file.filename or "upload", content=content
    )
    return ImportOut.model_validate(imp)


@router.get("", response_model=list[ImportSummary])
async def list_imports(
    limit: int = Query(50, ge=1, le=200), ctx: OrgContext = Depends(manager_up)
) -> list[ImportSummary]:
    return [ImportSummary.model_validate(i) for i in await service.list_imports(ctx, limit)]


@router.get("/{import_id}", response_model=ImportOut)
async def get_import(import_id: UUID, ctx: OrgContext = Depends(manager_up)) -> ImportOut:
    return ImportOut.model_validate(await service.get_import(ctx, import_id))


@router.put("/{import_id}/mapping", response_model=ImportOut)
async def set_mapping(
    import_id: UUID, body: MappingIn, ctx: OrgContext = Depends(manager_up)
) -> ImportOut:
    imp = await service.set_mapping(ctx, import_id, body.column_map, body.options)
    return ImportOut.model_validate(imp)


@router.post("/{import_id}/validate", response_model=ImportOut, status_code=202)
async def validate(
    import_id: UUID, bg: BackgroundTasks, ctx: OrgContext = Depends(manager_up)
) -> ImportOut:
    imp = await service.enqueue(ctx, import_id, "validate")
    _kick(bg)
    return ImportOut.model_validate(imp)


@router.post("/{import_id}/commit", response_model=ImportOut, status_code=202)
async def commit(
    import_id: UUID, body: CommitIn, bg: BackgroundTasks, ctx: OrgContext = Depends(manager_up)
) -> ImportOut:
    imp = await service.enqueue(ctx, import_id, "commit", body.conflict_mode)
    _kick(bg)
    return ImportOut.model_validate(imp)


@router.get("/{import_id}/errors.csv")
async def errors_csv(import_id: UUID, ctx: OrgContext = Depends(manager_up)) -> Response:
    body, name = await service.errors_csv(ctx, import_id)
    return Response(
        content="﻿" + body,  # BOM so Excel opens UTF-8 (Arabic) correctly
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )
