from uuid import UUID

from fastapi import APIRouter, Depends, Response, status

from app.core.tenancy import (
    OrgContext,
    UserSession,
    get_org_context,
    get_user_session,
    require_role,
)
from app.orgs import service
from app.orgs.models import Role
from app.orgs.schemas import (
    AcceptedOut,
    InvitationAccept,
    InvitationCreate,
    InvitationCreated,
    InvitationOut,
    MemberOut,
    MemberUpdate,
    MeOut,
    OrgCreate,
    OrgOut,
    OrgSettingsUpdate,
)

router = APIRouter()
owner_only = require_role(Role.owner)
manager_up = require_role(Role.manager)


@router.get("/me", response_model=MeOut, tags=["me"])
async def me(us: UserSession = Depends(get_user_session)) -> MeOut:
    return await service.get_me(us)


@router.post("/orgs", response_model=OrgOut, status_code=status.HTTP_201_CREATED, tags=["orgs"])
async def create_org(data: OrgCreate, us: UserSession = Depends(get_user_session)) -> OrgOut:
    return await service.create_org(us, data)


@router.get("/org", response_model=OrgOut, tags=["orgs"])
async def get_org(ctx: OrgContext = Depends(get_org_context)) -> OrgOut:
    return await service.get_org(ctx)


@router.patch("/org/settings", response_model=OrgOut, tags=["orgs"])
async def update_settings(data: OrgSettingsUpdate, ctx: OrgContext = Depends(owner_only)) -> OrgOut:
    return await service.update_settings(ctx, data)


@router.get("/members", response_model=list[MemberOut], tags=["members"])
async def list_members(ctx: OrgContext = Depends(manager_up)) -> list[MemberOut]:
    return await service.list_members(ctx)


@router.patch("/members/{membership_id}", response_model=MemberOut, tags=["members"])
async def update_member(
    membership_id: UUID, data: MemberUpdate, ctx: OrgContext = Depends(owner_only)
) -> MemberOut:
    return await service.update_member(ctx, membership_id, data)


@router.delete("/members/{membership_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["members"])
async def remove_member(membership_id: UUID, ctx: OrgContext = Depends(owner_only)) -> Response:
    await service.remove_member(ctx, membership_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/invitations", response_model=list[InvitationOut], tags=["members"])
async def list_invitations(ctx: OrgContext = Depends(owner_only)) -> list[InvitationOut]:
    return [InvitationOut.model_validate(i) for i in await service.list_invitations(ctx)]


@router.post(
    "/invitations",
    response_model=InvitationCreated,
    status_code=status.HTTP_201_CREATED,
    tags=["members"],
)
async def create_invitation(
    data: InvitationCreate, ctx: OrgContext = Depends(owner_only)
) -> InvitationCreated:
    inv, token = await service.create_invitation(ctx, data)
    return InvitationCreated(**InvitationOut.model_validate(inv).model_dump(), token=token)


@router.delete(
    "/invitations/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["members"]
)
async def revoke_invitation(invitation_id: UUID, ctx: OrgContext = Depends(owner_only)) -> Response:
    await service.revoke_invitation(ctx, invitation_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/invitations/accept", response_model=AcceptedOut, tags=["members"])
async def accept_invitation(
    data: InvitationAccept, us: UserSession = Depends(get_user_session)
) -> AcceptedOut:
    return AcceptedOut(org_id=await service.accept_invitation(us, data.token))
