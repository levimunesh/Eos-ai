import enum
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Numeric,
    SmallInteger,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.core.models_base import IdMixin, OrgMixin, TimestampMixin


class Role(enum.StrEnum):
    owner = "owner"
    manager = "manager"
    viewer = "viewer"


ROLE_RANK = {Role.viewer: 1, Role.manager: 2, Role.owner: 3}

role_enum = Enum(
    Role, name="member_role", schema="eos", values_callable=lambda e: [m.value for m in e]
)


class Organisation(IdMixin, TimestampMixin, Base):
    __tablename__ = "organisations"
    __table_args__ = (
        CheckConstraint("fiscal_year_start_month between 1 and 12", name="fiscal_month"),
        CheckConstraint("tax_rate >= 0 and tax_rate < 1", name="tax_rate"),
        CheckConstraint("char_length(base_currency) = 3", name="currency_len"),
    )

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    base_currency: Mapped[str] = mapped_column(String(3), nullable=False)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False)
    fiscal_year_start_month: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)
    tax_rate: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False, default=Decimal("0"))
    prices_include_tax: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    date_format: Mapped[str] = mapped_column(String(16), nullable=False, default="DD/MM/YYYY")
    is_demo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class User(TimestampMixin, Base):
    """Mirror of a Supabase Auth user, created on first authenticated request."""

    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(320), nullable=False, unique=True)
    full_name: Mapped[str | None] = mapped_column(String(200))


class Membership(IdMixin, OrgMixin, TimestampMixin, Base):
    __tablename__ = "memberships"
    __table_args__ = (UniqueConstraint("org_id", "user_id"),)

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("eos.users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    role: Mapped[Role] = mapped_column(role_enum, nullable=False)
    all_branches: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class MembershipBranch(OrgMixin, Base):
    __tablename__ = "membership_branches"

    membership_id: Mapped[UUID] = mapped_column(
        ForeignKey("eos.memberships.id", ondelete="CASCADE"), primary_key=True
    )
    branch_id: Mapped[UUID] = mapped_column(
        ForeignKey("eos.branches.id", ondelete="CASCADE"), primary_key=True
    )


class Invitation(IdMixin, OrgMixin, TimestampMixin, Base):
    __tablename__ = "invitations"

    email: Mapped[str] = mapped_column(String(320), nullable=False)
    role: Mapped[Role] = mapped_column(role_enum, nullable=False)
    all_branches: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    branch_ids: Mapped[list[UUID]] = mapped_column(
        ARRAY(PG_UUID(as_uuid=True)),
        nullable=False,
        default=list,
    )
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    invited_by: Mapped[UUID] = mapped_column(ForeignKey("eos.users.id"), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
