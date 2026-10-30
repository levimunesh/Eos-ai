import csv
import hashlib
import io
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.audit import service as audit
from app.core.errors import AppError, Conflict, Forbidden, NotFound
from app.core.tenancy import OrgContext
from app.ingest.convert import ParseOptions
from app.ingest.models import Import, ImportErrorRow, ImportFile, ImportMapping, ImportStatus
from app.ingest.parsing import (
    FileReadError,
    Table,
    header_signature,
    profile,
    read_table,
    suggest_mapping,
)
from app.ingest.specs import ENTITIES, EntitySpec
from app.orgs.models import Organisation, Role

PREVIEW_ROWS = 20
DATE_FORMATS = ("DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD")
THOUSANDS = (None, ",", " ", ".", "'")


def spec_for(ctx: OrgContext, entity_type: str) -> EntitySpec:
    spec = ENTITIES.get(entity_type)
    if spec is None:
        raise AppError(f"Unknown import type '{entity_type}'", code="unknown_entity")
    if spec.owner_only and ctx.role != Role.owner:
        raise Forbidden(f"Only owners can import {spec.label.lower()}")
    return spec


async def _org(ctx: OrgContext) -> Organisation:
    return (
        await ctx.session.execute(select(Organisation).where(Organisation.id == ctx.org_id))
    ).scalar_one()


def parse_options(org: Organisation, options: dict[str, Any]) -> ParseOptions:
    return ParseOptions(
        date_format=options.get("date_format") or org.date_format,
        thousands_separator=options.get("thousands_separator"),
        decimal_separator=options.get("decimal_separator") or ".",
        default_currency=org.base_currency,
    )


def _read(content: bytes, imp: Import) -> Table:
    try:
        return read_table(
            content,
            imp.file_name,
            sheet=imp.options.get("sheet"),
            header_row=imp.options.get("header_row"),
        )
    except FileReadError as e:
        raise AppError(e.message, code=e.code) from e


def _preview(table: Table, spec: EntitySpec, opts: ParseOptions) -> dict[str, Any]:
    return {
        "headers": table.headers,
        "rows": [[None if c is None else str(c) for c in r] for r in table.rows[:PREVIEW_ROWS]],
        "row_count": len(table.rows),
        "header_row": table.header_row_index,
        "sheet": table.sheet,
        "sheets": table.sheets,
        "encoding": table.encoding,
        "delimiter": table.delimiter,
        "columns": profile(table, opts),
        "signature": header_signature(table.headers),
    }


async def create_import(
    ctx: OrgContext, *, entity_type: str, file_name: str, content: bytes
) -> Import:
    spec = spec_for(ctx, entity_type)
    org = await _org(ctx)
    file_hash = hashlib.sha256(content).hexdigest()
    imp = Import(
        org_id=ctx.org_id,
        entity_type=entity_type,
        file_name=file_name[:300],
        file_hash=file_hash,
        file_size=len(content),
        status=ImportStatus.uploaded,
        options={},
        created_by=ctx.user_id,
    )
    table = _read(content, imp)
    opts = parse_options(org, {})
    preview = _preview(table, spec, opts)
    imp.options = {
        "header_row": table.header_row_index,
        "sheet": table.sheet,
        "date_format": org.date_format,
        "thousands_separator": None,
    }

    saved = (
        await ctx.session.execute(
            select(ImportMapping).where(
                ImportMapping.org_id == ctx.org_id,
                ImportMapping.entity_type == entity_type,
                ImportMapping.header_signature == preview["signature"],
            )
        )
    ).scalar_one_or_none()
    suggestions = suggest_mapping(spec, table.headers)
    if saved:
        imp.column_map = {k: v for k, v in saved.column_map.items() if v in table.headers}
        imp.options = {
            **imp.options,
            **{
                k: v
                for k, v in saved.options.items()
                if k in ("date_format", "thousands_separator")
            },
        }
        preview["mapping_source"] = "saved"
    else:
        imp.column_map = {k: s["column"] for k, s in suggestions.items() if s["column"]}
        preview["mapping_source"] = "suggested"
    preview["suggestions"] = suggestions

    hints = {c["date_order_hint"] for c in preview["columns"] if c["date_order_hint"]}
    if len(hints) == 1 and (hint := hints.pop()) != imp.options["date_format"]:
        preview["date_format_hint"] = hint

    previous = (
        await ctx.session.execute(
            select(Import.id, Import.created_at, Import.status).where(
                Import.org_id == ctx.org_id, Import.file_hash == file_hash
            )
        )
    ).all()
    preview["same_file_imported_before"] = [
        {"id": str(i), "created_at": c.isoformat(), "status": s.value} for i, c, s in previous
    ]
    imp.preview = preview

    ctx.session.add(imp)
    await ctx.session.flush()
    ctx.session.add(ImportFile(import_id=imp.id, org_id=ctx.org_id, content=content))
    await audit.record(
        ctx.session,
        org_id=ctx.org_id,
        user_id=ctx.user_id,
        action="import.uploaded",
        entity="import",
        entity_id=imp.id,
        meta={"entity_type": entity_type, "file_name": imp.file_name, "rows": len(table.rows)},
    )
    await ctx.session.flush()
    await ctx.session.refresh(imp)
    return imp


async def get_import(ctx: OrgContext, import_id: UUID) -> Import:
    imp = (
        await ctx.session.execute(
            select(Import).where(Import.id == import_id, Import.org_id == ctx.org_id)
        )
    ).scalar_one_or_none()
    if imp is None:
        raise NotFound("Import not found")
    return imp


async def list_imports(ctx: OrgContext, limit: int = 50) -> list[Import]:
    rows = await ctx.session.execute(
        select(Import)
        .where(Import.org_id == ctx.org_id)
        .order_by(Import.created_at.desc())
        .limit(limit)
    )
    return list(rows.scalars())


async def set_mapping(
    ctx: OrgContext, import_id: UUID, column_map: dict[str, str | None], options: dict[str, Any]
) -> Import:
    imp = await get_import(ctx, import_id)
    spec = spec_for(ctx, imp.entity_type)
    if imp.status in (ImportStatus.validating, ImportStatus.importing, ImportStatus.done):
        raise Conflict(
            f"Import is {imp.status.value}; mapping can't change now", code="import_locked"
        )
    unknown = [k for k in column_map if k not in {f.key for f in spec.fields}]
    if unknown:
        raise AppError(
            "Unknown fields in mapping", details={"fields": unknown}, code="unknown_field"
        )
    if options.get("date_format") not in (None, *DATE_FORMATS):
        raise AppError("Unsupported date format", code="bad_option")
    if options.get("thousands_separator") not in THOUSANDS:
        raise AppError("Unsupported thousands separator", code="bad_option")

    new_options = {**imp.options}
    for k in ("date_format", "thousands_separator", "sheet", "header_row"):
        if k in options:
            new_options[k] = options[k]
    org = await _org(ctx)
    content = await _content(ctx, imp)
    imp.options = new_options
    table = _read(content, imp)

    clean = {k: v for k, v in column_map.items() if v}
    missing_cols = sorted({v for v in clean.values() if v not in table.headers})
    if missing_cols:
        raise AppError(
            "Mapped columns not found in the file",
            details={"columns": missing_cols},
            code="unknown_column",
        )
    missing_req = [f.label for f in spec.fields if f.required and f.key not in clean]
    if missing_req:
        raise AppError(
            "Required fields are not mapped",
            details={"fields": missing_req},
            code="missing_required",
        )

    imp.column_map = clean
    imp.preview = {
        **_preview(table, spec, parse_options(org, new_options)),
        "suggestions": imp.preview.get("suggestions"),
        "same_file_imported_before": imp.preview.get("same_file_imported_before", []),
        "mapping_source": "user",
    }
    imp.status = ImportStatus.mapped
    imp.quality_report = None

    stmt = pg_insert(ImportMapping).values(
        org_id=ctx.org_id,
        entity_type=imp.entity_type,
        header_signature=imp.preview["signature"],
        column_map=clean,
        options={k: new_options.get(k) for k in ("date_format", "thousands_separator")},
    )
    await ctx.session.execute(
        stmt.on_conflict_do_update(
            constraint="uq_import_mappings_sig",
            set_={"column_map": stmt.excluded.column_map, "options": stmt.excluded.options},
        )
    )
    await ctx.session.flush()
    await ctx.session.refresh(imp)
    return imp


async def _content(ctx: OrgContext, imp: Import) -> bytes:
    return (
        await ctx.session.execute(select(ImportFile.content).where(ImportFile.import_id == imp.id))
    ).scalar_one()


async def enqueue(
    ctx: OrgContext, import_id: UUID, kind: str, conflict_mode: str | None = None
) -> Import:
    imp = await get_import(ctx, import_id)
    spec_for(ctx, imp.entity_type)
    if kind == "validate":
        if imp.status not in (ImportStatus.mapped, ImportStatus.validated, ImportStatus.failed):
            raise Conflict("Confirm the column mapping before validating", code="not_mapped")
        imp.status = ImportStatus.validating
    else:
        if imp.status != ImportStatus.validated:
            raise Conflict(
                "Validate the file and review the report before importing", code="not_validated"
            )
        imp.status = ImportStatus.importing
    imp.job_kind = kind
    imp.conflict_mode = conflict_mode or imp.conflict_mode or "skip"
    imp.queued_at = datetime.now(UTC)
    imp.started_at = None
    imp.finished_at = None
    imp.attempts = 0
    imp.last_error = None
    await audit.record(
        ctx.session,
        org_id=ctx.org_id,
        user_id=ctx.user_id,
        action=f"import.{kind}_queued",
        entity="import",
        entity_id=imp.id,
        meta={"conflict_mode": imp.conflict_mode},
    )
    await ctx.session.flush()
    await ctx.session.refresh(imp)
    return imp


async def errors_csv(ctx: OrgContext, import_id: UUID) -> tuple[str, str]:
    imp = await get_import(ctx, import_id)
    rows = (
        (
            await ctx.session.execute(
                select(ImportErrorRow)
                .where(ImportErrorRow.import_id == imp.id)
                .order_by(ImportErrorRow.row_number)
            )
        )
        .scalars()
        .all()
    )
    headers = imp.preview.get("headers", [])
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Row", "Column", "Error", "Message", *headers])
    for e in rows:
        w.writerow(
            [
                e.row_number,
                e.column_name or "",
                e.error_code,
                e.message,
                *[e.raw_row.get(h) or "" for h in headers],
            ]
        )
    stem = imp.file_name.rsplit(".", 1)[0]
    return buf.getvalue(), f"{stem}-errors.csv"
