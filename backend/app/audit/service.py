from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.audit.models import AuditLog


async def record(
    session: AsyncSession,
    *,
    org_id: UUID,
    user_id: UUID | None,
    action: str,
    entity: str,
    entity_id: UUID | None = None,
    meta: dict[str, Any] | None = None,
) -> None:
    session.add(
        AuditLog(
            org_id=org_id,
            user_id=user_id,
            action=action,
            entity=entity,
            entity_id=entity_id,
            meta=meta or {},
        )
    )
