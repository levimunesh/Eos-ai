import json
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.assistant import service
from app.assistant.models import Conversation
from app.assistant.provider import AnthropicProvider, Provider
from app.core.config import get_settings
from app.core.errors import AppError
from app.core.tenancy import OrgContext, get_org_context

router = APIRouter(prefix="/assistant", tags=["assistant"])


class NotConfigured(AppError):
    status_code = 503
    code = "ai_not_configured"


def get_provider() -> Provider:
    s = get_settings()
    if not s.anthropic_api_key:
        raise NotConfigured("The AI assistant isn't set up yet: the server has no Claude API key.")
    return AnthropicProvider(s.anthropic_api_key, s.ai_model)


class ConversationIn(BaseModel):
    title: str | None = Field(default=None, max_length=200)


class QuestionIn(BaseModel):
    content: str = Field(min_length=1, max_length=4000)


@router.get("/status")
async def status(_: OrgContext = Depends(get_org_context)) -> dict[str, Any]:
    s = get_settings()
    return {"configured": bool(s.anthropic_api_key), "model": s.ai_model}


@router.post("/conversations", status_code=201)
async def create_conversation(
    body: ConversationIn, ctx: OrgContext = Depends(get_org_context)
) -> dict[str, Any]:
    conv = Conversation(
        org_id=ctx.org_id, user_id=ctx.user_id, title=body.title or "New conversation"
    )
    ctx.session.add(conv)
    await ctx.session.flush()
    await ctx.session.refresh(conv)
    return {
        "id": str(conv.id),
        "title": conv.title,
        "created_at": conv.created_at.isoformat(),
        "updated_at": conv.updated_at.isoformat(),
    }


@router.get("/conversations")
async def list_conversations(ctx: OrgContext = Depends(get_org_context)) -> list[dict[str, Any]]:
    rows = await ctx.session.execute(
        select(Conversation)
        .where(Conversation.org_id == ctx.org_id, Conversation.user_id == ctx.user_id)
        .order_by(Conversation.updated_at.desc())
        .limit(100)
    )
    return [
        {
            "id": str(c.id),
            "title": c.title,
            "created_at": c.created_at.isoformat(),
            "updated_at": c.updated_at.isoformat(),
        }
        for c in rows.scalars()
    ]


@router.get("/conversations/{conversation_id}")
async def get_conversation(
    conversation_id: UUID, ctx: OrgContext = Depends(get_org_context)
) -> dict[str, Any]:
    return await service.conversation_detail(ctx, conversation_id)


@router.post("/conversations/{conversation_id}/messages")
async def ask(
    conversation_id: UUID,
    body: QuestionIn,
    ctx: OrgContext = Depends(get_org_context),
    provider: Provider = Depends(get_provider),
) -> StreamingResponse:
    """Server-sent events: start, text (many), tool_call, tool_result, done | error.

    The request's own transaction is released before streaming starts (the dependency
    scope ends with this function). `service.answer` opens short transactions of its own,
    so no database connection is held while the model is thinking.
    """
    await service.get_conversation(ctx, conversation_id)  # 404 before streaming starts
    await ctx.session.commit()
    settings = get_settings()

    async def events():
        async for ev in service.answer(ctx, conversation_id, body.content, provider, settings):
            yield f"event: {ev['type']}\ndata: {json.dumps(ev, default=str)}\n\n"

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
