import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from sqlalchemy import delete, func, select, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit import service as audit
from app.catalog.models import Branch
from app.core import currency
from app.core.db import set_tenant_vars
from app.core.errors import AppError, Conflict, NotFound
from app.core.tenancy import OrgContext, UserSession
from app.orgs.models import Invitation, Membership, MembershipBranch, Organisation, Role, User
from app.orgs.schemas import (
    InvitationCreate,
    MemberOut,
    MembershipSummary,
    MemberUpdate,
    MeOut,
    OrgCreate,
    OrgOut,
    OrgSettingsUpdate,
)

INVITE_TTL = timedelta(days=7)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def org_out(org: Organisation) -> OrgOut:
    return OrgOut(
        id=org.id,
        name=org.name,
        base_currency=org.base_currency,
        currency_decimals=currency.minor_units(org.base_currency),
        timezone=org.timezone,
        fiscal_year_start_month=org.fiscal_year_start_month,
        tax_rate=org.tax_rate,
        prices_include_tax=org.prices_include_tax,
        date_format=org.date_format,
        is_demo=org.is_demo,
        created_at=org.created_at,
    )


async def get_me(us: UserSession) -> MeOut:
    s = us.session
    user = (await s.execute(select(User).where(User.id == us.user.id))).scalar_one()
    rows = await s.execute(
        select(Membership.org_id, Organisation.name, Membership.role, Organisation.is_demo)
        .join(Organisation, Organisation.id == Membership.org_id)
        .where(Membership.user_id == us.user.id, Organisation.deleted_at.is_(None))
        .order_by(Organisation.name)
    )
    return MeOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        memberships=[
            MembershipSummary(org_id=r[0], org_name=r[1], role=r[2], is_demo=r[3]) for r in rows
        ],
    )


async def create_org(us: UserSession, data: OrgCreate, *, is_demo: bool = False) -> OrgOut:
    s = us.session
    org_id = uuid4()
    # RLS only lets us insert an org whose id is the current org context.
    await set_tenant_vars(s, user_id=us.user.id, org_id=org_id)
    org = Organisation(id=org_id, is_demo=is_demo, **data.model_dump())
    s.add(org)
    await s.flush()
    s.add(Membership(org_id=org_id, user_id=us.user.id, role=Role.owner, all_branches=True))
    await audit.record(
        s,
        org_id=org_id,
        user_id=us.user.id,
        action="org.created",
        entity="organisation",
        entity_id=org_id,
        meta={"base_currency": data.base_currency},
    )
    await s.flush()
    await s.refresh(org)
    return org_out(org)


async def get_org(ctx: OrgContext) -> OrgOut:
    org = (
        await ctx.session.execute(select(Organisation).where(Organisation.id == ctx.org_id))
    ).scalar_one()
    return org_out(org)


async def update_settings(ctx: OrgContext, data: OrgSettingsUpdate) -> OrgOut:
    org = (
        await ctx.session.execute(select(Organisation).where(Organisation.id == ctx.org_id))
    ).scalar_one()
    changes = data.model_dump(exclude_unset=True, exclude_none=True)
    for key, value in changes.items():
        setattr(org, key, value)
    await audit.record(
        ctx.session,
        org_id=ctx.org_id,
        user_id=ctx.user_id,
        action="org.settings_updated",
        entity="organisation",
        entity_id=ctx.org_id,
        meta={k: str(v) for k, v in changes.items()},
    )
    await ctx.session.flush()
    await ctx.session.refresh(org)
    return org_out(org)


async def _validate_branch_ids(ctx: OrgContext, branch_ids: list[UUID]) -> list[UUID]:
    unique = list(dict.fromkeys(branch_ids))
    if not unique:
        return []
    found = await ctx.session.execute(
        select(Branch.id).where(Branch.org_id == ctx.org_id, Branch.id.in_(unique))
    )
    found_ids = set(found.scalars().all())
    missing = [str(b) for b in unique if b not in found_ids]
    if missing:
        raise AppError("Unknown branch ids", details={"branch_ids": missing}, code="unknown_branch")
    return unique


async def list_members(ctx: OrgContext) -> list[MemberOut]:
    s = ctx.session
    rows = (
        await s.execute(
            select(Membership, User)
            .join(User, User.id == Membership.user_id)
            .where(Membership.org_id == ctx.org_id)
            .order_by(User.email)
        )
    ).all()
    branch_rows = await s.execute(
        select(MembershipBranch.membership_id, MembershipBranch.branch_id).where(
            MembershipBranch.org_id == ctx.org_id
        )
    )
    by_member: dict[UUID, list[UUID]] = {}
    for mid, bid in branch_rows:
        by_member.setdefault(mid, []).append(bid)
    return [
        MemberOut(
            membership_id=m.id,
            user_id=u.id,
            email=u.email,
            full_name=u.full_name,
            role=m.role,
            all_branches=m.all_branches,
            branch_ids=sorted(by_member.get(m.id, []), key=str),
        )
        for m, u in rows
    ]


async def _owner_count(s: AsyncSession, org_id: UUID) -> int:
    return (
        await s.execute(
            select(func.count()).where(Membership.org_id == org_id, Membership.role == Role.owner)
        )
    ).scalar_one()


async def _get_membership(ctx: OrgContext, membership_id: UUID) -> Membership:
    m = (
        await ctx.session.execute(
            select(Membership).where(
                Membership.id == membership_id, Membership.org_id == ctx.org_id
            )
        )
    ).scalar_one_or_none()
    if m is None:
        raise NotFound("Member not found")
    return m


async def update_member(ctx: OrgContext, membership_id: UUID, data: MemberUpdate) -> MemberOut:
    s = ctx.session
    m = await _get_membership(ctx, membership_id)
    if data.role is not None and m.role == Role.owner and data.role != Role.owner:
        if await _owner_count(s, ctx.org_id) <= 1:
            raise Conflict("An organisation needs at least one owner", code="last_owner")
    if data.role is not None:
        m.role = data.role
    if data.all_branches is not None:
        m.all_branches = data.all_branches
    if data.branch_ids is not None or data.all_branches is not None:
        await s.execute(delete(MembershipBranch).where(MembershipBranch.membership_id == m.id))
        if not m.all_branches:
            ids = await _validate_branch_ids(ctx, data.branch_ids or [])
            if not ids:
                raise AppError(
                    "Pick at least one branch, or give access to all branches",
                    code="no_branches",
                )
            for bid in ids:
                s.add(MembershipBranch(membership_id=m.id, branch_id=bid, org_id=ctx.org_id))
    await audit.record(
        s,
        org_id=ctx.org_id,
        user_id=ctx.user_id,
        action="member.updated",
        entity="membership",
        entity_id=m.id,
        meta=data.model_dump(mode="json", exclude_unset=True),
    )
    await s.flush()
    members = await list_members(ctx)
    return next(x for x in members if x.membership_id == m.id)


async def remove_member(ctx: OrgContext, membership_id: UUID) -> None:
    s = ctx.session
    m = await _get_membership(ctx, membership_id)
    if m.role == Role.owner and await _owner_count(s, ctx.org_id) <= 1:
        raise Conflict("An organisation needs at least one owner", code="last_owner")
    await s.delete(m)
    await audit.record(
        s,
        org_id=ctx.org_id,
        user_id=ctx.user_id,
        action="member.removed",
        entity="membership",
        entity_id=m.id,
        meta={"user_id": str(m.user_id)},
    )


async def create_invitation(ctx: OrgContext, data: InvitationCreate) -> tuple[Invitation, str]:
    s = ctx.session
    email = data.email.lower()
    existing_member = await s.execute(
        select(Membership.id)
        .join(User, User.id == Membership.user_id)
        .where(Membership.org_id == ctx.org_id, func.lower(User.email) == email)
    )
    if existing_member.first():
        raise Conflict("That person is already a member", code="already_member")
    branch_ids = [] if data.all_branches else await _validate_branch_ids(ctx, data.branch_ids)
    if not data.all_branches and not branch_ids:
        raise AppError(
            "Pick at least one branch, or give access to all branches", code="no_branches"
        )
    token = secrets.token_urlsafe(32)
    inv = Invitation(
        org_id=ctx.org_id,
        email=email,
        role=data.role,
        all_branches=data.all_branches,
        branch_ids=branch_ids,
        token_hash=hash_token(token),
        invited_by=ctx.user_id,
        expires_at=datetime.now(UTC) + INVITE_TTL,
    )
    s.add(inv)
    await s.flush()
    await s.refresh(inv)
    await audit.record(
        s,
        org_id=ctx.org_id,
        user_id=ctx.user_id,
        action="invitation.created",
        entity="invitation",
        entity_id=inv.id,
        meta={"email": email, "role": data.role.value},
    )
    return inv, token


async def list_invitations(ctx: OrgContext) -> list[Invitation]:
    rows = await ctx.session.execute(
        select(Invitation)
        .where(Invitation.org_id == ctx.org_id)
        .order_by(Invitation.created_at.desc())
    )
    return list(rows.scalars().all())


async def revoke_invitation(ctx: OrgContext, invitation_id: UUID) -> None:
    inv = (
        await ctx.session.execute(
            select(Invitation).where(
                Invitation.id == invitation_id, Invitation.org_id == ctx.org_id
            )
        )
    ).scalar_one_or_none()
    if inv is None:
        raise NotFound("Invitation not found")
    if inv.accepted_at is not None:
        raise Conflict("Invitation already accepted", code="already_accepted")
    inv.revoked_at = datetime.now(UTC)
    await audit.record(
        ctx.session,
        org_id=ctx.org_id,
        user_id=ctx.user_id,
        action="invitation.revoked",
        entity="invitation",
        entity_id=inv.id,
    )


_ACCEPT_ERRORS = {
    "invalid_invitation": (NotFound, "Invitation is invalid, expired or already used"),
    "email_mismatch": (AppError, "This invitation was sent to a different email address"),
    "already_member": (Conflict, "You are already a member of this organisation"),
}


async def accept_invitation(us: UserSession, token: str) -> UUID:
    try:
        org_id = (
            await us.session.execute(
                text("select eos.accept_invitation(:h, :e)"),
                {"h": hash_token(token), "e": us.user.email},
            )
        ).scalar_one()
    except DBAPIError as exc:
        msg = str(exc.orig)
        for key, (cls, human) in _ACCEPT_ERRORS.items():
            if key in msg:
                raise cls(human, code=key) from exc
        raise
    return org_id
