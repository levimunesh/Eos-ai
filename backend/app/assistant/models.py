from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.core.models_base import IdMixin, OrgMixin, TimestampMixin


class Created:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Conversation(IdMixin, OrgMixin, TimestampMixin, Base):
    __tablename__ = "ai_conversations"
    user_id: Mapped[UUID] = mapped_column(ForeignKey("eos.users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(200), nullable=False, default="New conversation")


class Message(IdMixin, OrgMixin, Created, Base):
    __tablename__ = "ai_messages"
    conversation_id: Mapped[UUID] = mapped_column(
        ForeignKey("eos.ai_conversations.id", ondelete="CASCADE")
    )
    role: Mapped[str] = mapped_column(String(10), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    verified: Mapped[bool | None] = mapped_column(Boolean)
    unverified_numbers: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    error: Mapped[str | None] = mapped_column(Text)


class ToolCallRow(IdMixin, OrgMixin, Created, Base):
    __tablename__ = "ai_tool_calls"
    message_id: Mapped[UUID] = mapped_column(ForeignKey("eos.ai_messages.id", ondelete="CASCADE"))
    seq: Mapped[int] = mapped_column(Integer, nullable=False)
    tool_name: Mapped[str] = mapped_column(String(60), nullable=False)
    args: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    result: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    is_error: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    duration_ms: Mapped[int | None] = mapped_column(Integer)


class Usage(IdMixin, OrgMixin, Created, Base):
    __tablename__ = "ai_usage"
    user_id: Mapped[UUID | None] = mapped_column(ForeignKey("eos.users.id", ondelete="SET NULL"))
    message_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("eos.ai_messages.id", ondelete="SET NULL")
    )
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    input_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cost_usd: Mapped[Decimal | None] = mapped_column(Numeric(12, 6))
    latency_ms: Mapped[int | None] = mapped_column(Integer)
    rounds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    tools_called: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
