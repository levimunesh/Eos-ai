import enum
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, LargeBinary, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.core.models_base import IdMixin, OrgMixin, TimestampMixin


class ImportStatus(enum.StrEnum):
    uploaded = "uploaded"  # file stored, preview and suggestions ready
    mapped = "mapped"  # user confirmed column mapping
    validating = "validating"  # dry run queued or running
    validated = "validated"  # quality report ready, nothing written
    importing = "importing"  # commit queued or running
    done = "done"
    failed = "failed"


import_status_enum = Enum(
    ImportStatus,
    name="import_status",
    schema="eos",
    values_callable=lambda e: [m.value for m in e],
)


class Import(IdMixin, OrgMixin, TimestampMixin, Base):
    __tablename__ = "imports"

    entity_type: Mapped[str] = mapped_column(String(40), nullable=False)
    file_name: Mapped[str] = mapped_column(String(300), nullable=False)
    file_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[ImportStatus] = mapped_column(import_status_enum, nullable=False)
    options: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    column_map: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    preview: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    quality_report: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    conflict_mode: Mapped[str | None] = mapped_column(String(10))
    rows_total: Mapped[int | None] = mapped_column(Integer)
    rows_imported: Mapped[int | None] = mapped_column(Integer)
    rows_rejected: Mapped[int | None] = mapped_column(Integer)
    rows_duplicate: Mapped[int | None] = mapped_column(Integer)
    job_kind: Mapped[str | None] = mapped_column(String(10))
    queued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_error: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[UUID | None] = mapped_column(ForeignKey("eos.users.id"))


class ImportFile(OrgMixin, Base):
    __tablename__ = "import_files"

    import_id: Mapped[UUID] = mapped_column(
        ForeignKey("eos.imports.id", ondelete="CASCADE"), primary_key=True
    )
    content: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)


class ImportErrorRow(IdMixin, OrgMixin, Base):
    __tablename__ = "import_errors"

    import_id: Mapped[UUID] = mapped_column(ForeignKey("eos.imports.id", ondelete="CASCADE"))
    row_number: Mapped[int] = mapped_column(Integer, nullable=False)
    column_name: Mapped[str | None] = mapped_column(String(200))
    error_code: Mapped[str] = mapped_column(String(50), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    raw_row: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)


class ImportMapping(IdMixin, OrgMixin, TimestampMixin, Base):
    __tablename__ = "import_mappings"

    entity_type: Mapped[str] = mapped_column(String(40), nullable=False)
    header_signature: Mapped[str] = mapped_column(String(64), nullable=False)
    column_map: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    options: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
