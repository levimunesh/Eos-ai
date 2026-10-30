from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.audit import service as audit
from app.catalog.models import Branch
from app.core.errors import Conflict, NotFound
from app.core.tenancy import OrgContext, get_org_context, require_role
from app.orgs.models import Role

router = APIRouter(tags=["branches"])
owner_only = require_role(Role.owner)


class BranchIn(BaseModel):
    code: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=200)
    city: str | None = Field(default=None, max_length=100)


class BranchUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    city: str | None = Field(default=None, max_length=100)
    is_active: bool | None = None


class BranchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    code: str
    name: str
    city: str | None
    is_active: bool
    created_at: datetime


def _scoped(ctx: OrgContext):
    q = select(Branch).where(Branch.org_id == ctx.org_id)
    if not ctx.all_branches:
        q = q.where(Branch.id.in_(ctx.branch_ids or [None]))
    return q


@router.get("/branches", response_model=list[BranchOut])
async def list_branches(ctx: OrgContext = Depends(get_org_context)) -> list[Branch]:
    rows = await ctx.session.execute(_scoped(ctx).order_by(Branch.code))
    return list(rows.scalars().all())


@router.post("/branches", response_model=BranchOut, status_code=status.HTTP_201_CREATED)
async def create_branch(data: BranchIn, ctx: OrgContext = Depends(owner_only)) -> Branch:
    branch = Branch(
        org_id=ctx.org_id, code=data.code.strip(), name=data.name.strip(), city=data.city
    )
    ctx.session.add(branch)
    try:
        async with ctx.session.begin_nested():
            await ctx.session.flush()
    except IntegrityError as exc:
        raise Conflict(f"Branch code '{data.code}' already exists", code="duplicate_code") from exc
    await ctx.session.refresh(branch)
    await audit.record(
        ctx.session,
        org_id=ctx.org_id,
        user_id=ctx.user_id,
        action="branch.created",
        entity="branch",
        entity_id=branch.id,
        meta={"code": branch.code},
    )
    return branch


@router.patch("/branches/{branch_id}", response_model=BranchOut)
async def update_branch(
    branch_id: UUID, data: BranchUpdate, ctx: OrgContext = Depends(owner_only)
) -> Branch:
    branch = (
        await ctx.session.execute(_scoped(ctx).where(Branch.id == branch_id))
    ).scalar_one_or_none()
    if branch is None:
        raise NotFound("Branch not found")
    changes = data.model_dump(exclude_unset=True)
    for k, v in changes.items():
        setattr(branch, k, v)
    await audit.record(
        ctx.session,
        org_id=ctx.org_id,
        user_id=ctx.user_id,
        action="branch.updated",
        entity="branch",
        entity_id=branch.id,
        meta=changes,
    )
    await ctx.session.flush()
    await ctx.session.refresh(branch)
    return branch
