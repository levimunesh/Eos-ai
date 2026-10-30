"""Request context: who is calling, for which organisation, with what access.

Every org-scoped endpoint depends on `get_org_context`. It verifies membership before any
business query runs and sets the RLS variables for the request's transaction.
"""

from collections.abc import AsyncIterator, Callable, Coroutine
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from fastapi import Depends, Header
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import AuthUser, get_auth_user
from app.core.db import session_scope, set_tenant_vars
from app.core.errors import Forbidden, NotFound
from app.orgs.models import ROLE_RANK, Membership, MembershipBranch, Role


@dataclass
class UserSession:
    session: AsyncSession
    user: AuthUser


@dataclass
class OrgContext:
    session: AsyncSession
    user: AuthUser
    org_id: UUID
    membership_id: UUID
    role: Role
    all_branches: bool
    branch_ids: frozenset[UUID] = field(default_factory=frozenset)

    @property
    def user_id(self) -> UUID:
        return self.user.id

    def can_see_branch(self, branch_id: UUID) -> bool:
        return self.all_branches or branch_id in self.branch_ids

    def has_role(self, minimum: Role) -> bool:
        return ROLE_RANK[self.role] >= ROLE_RANK[minimum]


async def _ensure_user(session: AsyncSession, user: AuthUser) -> None:
    await session.execute(
        text(
            """
            insert into eos.users (id, email) values (:id, :email)
            on conflict (id) do update set email = excluded.email
            where eos.users.email is distinct from excluded.email
            """
        ),
        {"id": user.id, "email": user.email},
    )


async def get_user_session(
    user: AuthUser = Depends(get_auth_user),
) -> AsyncIterator[UserSession]:
    async for session in session_scope():
        await set_tenant_vars(session, user_id=user.id, org_id=None)
        await _ensure_user(session, user)
        yield UserSession(session=session, user=user)


async def get_org_context(
    x_org_id: UUID = Header(..., alias="X-Org-Id"),
    us: UserSession = Depends(get_user_session),
) -> OrgContext:
    session = us.session
    await set_tenant_vars(session, user_id=us.user.id, org_id=x_org_id)
    membership = (
        await session.execute(
            select(Membership).where(
                Membership.org_id == x_org_id, Membership.user_id == us.user.id
            )
        )
    ).scalar_one_or_none()
    if membership is None:
        # 404 rather than 403: do not reveal whether the organisation exists.
        raise NotFound("Organisation not found")

    branch_ids: frozenset[UUID] = frozenset()
    if not membership.all_branches:
        rows = await session.execute(
            select(MembershipBranch.branch_id).where(
                MembershipBranch.membership_id == membership.id
            )
        )
        branch_ids = frozenset(rows.scalars().all())

    return OrgContext(
        session=session,
        user=us.user,
        org_id=x_org_id,
        membership_id=membership.id,
        role=membership.role,
        all_branches=membership.all_branches,
        branch_ids=branch_ids,
    )


def require_role(minimum: Role) -> Callable[..., Coroutine[Any, Any, OrgContext]]:
    async def dependency(ctx: OrgContext = Depends(get_org_context)) -> OrgContext:
        if not ctx.has_role(minimum):
            raise Forbidden(f"Requires {minimum.value} role")
        return ctx

    return dependency
