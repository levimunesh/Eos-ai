from datetime import datetime
from decimal import Decimal
from uuid import UUID
from zoneinfo import available_timezones

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.core import currency
from app.orgs.models import Role

DATE_FORMATS = ("DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD")
_TIMEZONES = available_timezones()


def _check_timezone(v: str) -> str:
    if v not in _TIMEZONES:
        raise ValueError("Unknown timezone (use an IANA name such as Asia/Muscat)")
    return v


def _check_date_format(v: str) -> str:
    if v not in DATE_FORMATS:
        raise ValueError(f"date_format must be one of {', '.join(DATE_FORMATS)}")
    return v


class OrgCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    base_currency: str = Field(min_length=3, max_length=3)
    timezone: str
    fiscal_year_start_month: int = Field(default=1, ge=1, le=12)
    tax_rate: Decimal = Field(default=Decimal("0"), ge=0, lt=1)
    prices_include_tax: bool = False
    date_format: str = "DD/MM/YYYY"

    @field_validator("base_currency")
    @classmethod
    def _currency(cls, v: str) -> str:
        v = v.upper()
        if not currency.is_supported(v):
            raise ValueError("Unsupported currency code")
        return v

    @field_validator("timezone")
    @classmethod
    def _tz(cls, v: str) -> str:
        return _check_timezone(v)

    @field_validator("date_format")
    @classmethod
    def _df(cls, v: str) -> str:
        return _check_date_format(v)


class OrgSettingsUpdate(BaseModel):
    """Base currency is fixed at creation: changing it would silently restate every figure."""

    name: str | None = Field(default=None, min_length=2, max_length=200)
    timezone: str | None = None
    fiscal_year_start_month: int | None = Field(default=None, ge=1, le=12)
    tax_rate: Decimal | None = Field(default=None, ge=0, lt=1)
    prices_include_tax: bool | None = None
    date_format: str | None = None

    @field_validator("timezone")
    @classmethod
    def _tz(cls, v: str | None) -> str | None:
        return None if v is None else _check_timezone(v)

    @field_validator("date_format")
    @classmethod
    def _df(cls, v: str | None) -> str | None:
        return None if v is None else _check_date_format(v)


class OrgOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    base_currency: str
    currency_decimals: int
    timezone: str
    fiscal_year_start_month: int
    tax_rate: Decimal
    prices_include_tax: bool
    date_format: str
    is_demo: bool
    created_at: datetime


class MembershipSummary(BaseModel):
    org_id: UUID
    org_name: str
    role: Role
    is_demo: bool


class MeOut(BaseModel):
    id: UUID
    email: str
    full_name: str | None
    memberships: list[MembershipSummary]


class MemberOut(BaseModel):
    membership_id: UUID
    user_id: UUID
    email: str
    full_name: str | None
    role: Role
    all_branches: bool
    branch_ids: list[UUID]


class MemberUpdate(BaseModel):
    role: Role | None = None
    all_branches: bool | None = None
    branch_ids: list[UUID] | None = None


class InvitationCreate(BaseModel):
    email: EmailStr
    role: Role
    all_branches: bool = True
    branch_ids: list[UUID] = Field(default_factory=list)


class InvitationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    role: Role
    all_branches: bool
    branch_ids: list[UUID]
    expires_at: datetime
    accepted_at: datetime | None
    revoked_at: datetime | None
    created_at: datetime


class InvitationCreated(InvitationOut):
    token: str = Field(
        description="Shown once. Share it with the invitee; only its hash is stored."
    )


class InvitationAccept(BaseModel):
    token: str = Field(min_length=20, max_length=200)


class AcceptedOut(BaseModel):
    org_id: UUID
