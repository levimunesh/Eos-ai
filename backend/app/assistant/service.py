"""Answer a question: stream the model's text, run its tool calls under the caller's access,
verify every figure against the tool results, then store the answer, tool calls and usage.

Database work happens in short transactions between model rounds, so no connection is held
open while the model is thinking.
"""

import json
import time
from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import replace
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import select

from app.assistant import prompts, tools
from app.assistant.models import Conversation, Message, ToolCallRow, Usage
from app.assistant.provider import Provider, RoundResult
from app.assistant.verify import verify
from app.catalog.models import Branch
from app.core import currency
from app.core.config import Settings
from app.core.db import get_sessionmaker, set_tenant_vars
from app.core.errors import NotFound
from app.core.tenancy import OrgContext
from app.orgs.models import Organisation

HISTORY_MESSAGES = 10


async def in_tx[T](ctx: OrgContext, fn: Callable[[OrgContext], Awaitable[T]]) -> T:
    """Run fn in a fresh, committed transaction carrying the caller's tenant context."""
    async with get_sessionmaker()() as session, session.begin():
        await set_tenant_vars(session, user_id=ctx.user_id, org_id=ctx.org_id)
        return await fn(replace(ctx, session=session))


async def get_conversation(ctx: OrgContext, conversation_id: UUID) -> Conversation:
    conv = (
        await ctx.session.execute(
            select(Conversation).where(
                Conversation.id == conversation_id,
                Conversation.org_id == ctx.org_id,
                Conversation.user_id == ctx.user_id,
            )
        )
    ).scalar_one_or_none()
    if conv is None:
        raise NotFound("Conversation not found")
    return conv


async def conversation_detail(ctx: OrgContext, conversation_id: UUID) -> dict[str, Any]:
    conv = await get_conversation(ctx, conversation_id)
    msgs = (
        (
            await ctx.session.execute(
                select(Message)
                .where(Message.conversation_id == conv.id)
                .order_by(Message.created_at)
            )
        )
        .scalars()
        .all()
    )
    calls = (
        (
            await ctx.session.execute(
                select(ToolCallRow)
                .where(ToolCallRow.message_id.in_([m.id for m in msgs] or [None]))
                .order_by(ToolCallRow.seq)
            )
        )
        .scalars()
        .all()
    )
    by_msg: dict[UUID, list[ToolCallRow]] = {}
    for c in calls:
        by_msg.setdefault(c.message_id, []).append(c)
    return {
        "id": str(conv.id),
        "title": conv.title,
        "created_at": conv.created_at.isoformat(),
        "messages": [
            {
                "id": str(m.id),
                "role": m.role,
                "content": m.content,
                "verified": m.verified,
                "unverified_numbers": m.unverified_numbers,
                "error": m.error,
                "created_at": m.created_at.isoformat(),
                "tool_calls": [
                    {
                        "seq": c.seq,
                        "name": c.tool_name,
                        "args": c.args,
                        "result": c.result,
                        "is_error": c.is_error,
                        "duration_ms": c.duration_ms,
                    }
                    for c in by_msg.get(m.id, [])
                ],
            }
            for m in msgs
        ],
    }


def _summary(name: str, result: dict[str, Any], is_error: bool) -> str:
    if is_error:
        return str(result.get("error", "Error"))
    if name == "get_kpis":
        p = result["period"]
        return f"{len(result.get('kpis', []))} KPIs for {p['from']} to {p['to']}"
    if name == "get_sales_breakdown":
        return f"{len(result.get('rows', []))} rows by {result.get('dimension')}"
    if name == "get_expense_breakdown":
        return f"{len(result.get('by_category', {}))} expense categories"
    if name == "list_branches":
        return f"{len(result.get('branches', []))} branches"
    return "Done"


def _cost(settings: Settings, tin: int, tout: int) -> Decimal | None:
    if settings.ai_price_input_per_mtok is None or settings.ai_price_output_per_mtok is None:
        return None
    return (
        Decimal(str(settings.ai_price_input_per_mtok)) * tin
        + Decimal(str(settings.ai_price_output_per_mtok)) * tout
    ) / Decimal(1_000_000)


async def answer(
    ctx: OrgContext,
    conversation_id: UUID,
    question: str,
    provider: Provider,
    settings: Settings,
) -> AsyncIterator[dict[str, Any]]:
    started = time.perf_counter()

    async def prepare(c: OrgContext):
        conv = await get_conversation(c, conversation_id)
        org = (
            await c.session.execute(select(Organisation).where(Organisation.id == c.org_id))
        ).scalar_one()
        history = list(
            reversed(
                (
                    await c.session.execute(
                        select(Message)
                        .where(Message.conversation_id == conv.id, Message.error.is_(None))
                        .order_by(Message.created_at.desc())
                        .limit(HISTORY_MESSAGES)
                    )
                )
                .scalars()
                .all()
            )
        )
        user_msg = Message(org_id=c.org_id, conversation_id=conv.id, role="user", content=question)
        c.session.add(user_msg)
        if conv.title == "New conversation":
            conv.title = question.strip()[:80] or conv.title
        await c.session.flush()
        codes = None
        if not c.all_branches:
            rows = await c.session.execute(
                select(Branch.code).where(
                    Branch.org_id == c.org_id, Branch.id.in_(list(c.branch_ids) or [None])
                )
            )
            codes = sorted(rows.scalars())
        system = prompts.system_prompt(
            org_name=org.name,
            today=datetime.now(ZoneInfo(org.timezone)).date(),
            timezone=org.timezone,
            currency=org.base_currency,
            decimals=currency.minor_units(org.base_currency),
            branch_codes=codes,
        )
        past = [{"role": m.role, "content": m.content} for m in history]
        return user_msg.id, system, past

    user_msg_id, system, past = await in_tx(ctx, prepare)
    yield {"type": "start", "user_message_id": str(user_msg_id)}

    messages: list[dict[str, Any]] = [*past, {"role": "user", "content": question}]
    schemas = tools.schemas()
    text_parts: list[str] = []
    calls: list[dict[str, Any]] = []
    tin = tout = rounds = 0
    error: str | None = None

    try:
        for _ in range(settings.ai_max_rounds):
            rounds += 1
            final: RoundResult | None = None
            async for ev in provider.stream_round(
                system=system, messages=messages, tools=schemas, max_tokens=settings.ai_max_tokens
            ):
                if isinstance(ev, str):
                    text_parts.append(ev)
                    yield {"type": "text", "text": ev}
                else:
                    final = ev
            assert final is not None
            tin += final.input_tokens
            tout += final.output_tokens
            messages.append({"role": "assistant", "content": final.content})
            if final.stop_reason != "tool_use" or not final.tool_calls:
                break
            results = []
            for tc in final.tool_calls:
                seq = len(calls) + 1
                yield {"type": "tool_call", "seq": seq, "name": tc.name, "args": tc.input}
                t0 = time.perf_counter()
                result, is_error = await in_tx(
                    ctx, lambda c, tc=tc: tools.run_tool(c, tc.name, tc.input)
                )
                ms = int((time.perf_counter() - t0) * 1000)
                calls.append(
                    {
                        "seq": seq,
                        "name": tc.name,
                        "args": tc.input,
                        "result": result,
                        "is_error": is_error,
                        "duration_ms": ms,
                    }
                )
                yield {
                    "type": "tool_result",
                    "seq": seq,
                    "name": tc.name,
                    "is_error": is_error,
                    "summary": _summary(tc.name, result, is_error),
                }
                results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": tc.id,
                        "is_error": is_error,
                        # Wrapped as data; the system prompt says this is never instructions.
                        "content": json.dumps({"call": seq, "data": result}, default=str),
                    }
                )
            messages.append({"role": "user", "content": results})
        else:
            text_parts.append(
                "\n\n(I stopped after the maximum number of lookups for one question. "
                "Try asking something narrower.)"
            )
    except Exception as exc:  # provider or network failure: record it, tell the user
        error = f"{exc.__class__.__name__}: {exc}"[:500]

    content = "".join(text_parts).strip()
    verified, unverified = verify(content, [c["result"] for c in calls if not c["is_error"]])
    latency = int((time.perf_counter() - started) * 1000)

    async def store(c: OrgContext):
        msg = Message(
            org_id=c.org_id,
            conversation_id=conversation_id,
            role="assistant",
            content=content or ("" if error else "(no answer)"),
            verified=None if error else verified,
            unverified_numbers=unverified,
            error=error,
        )
        c.session.add(msg)
        await c.session.flush()
        for call in calls:
            c.session.add(
                ToolCallRow(
                    org_id=c.org_id,
                    message_id=msg.id,
                    seq=call["seq"],
                    tool_name=call["name"],
                    args=call["args"],
                    result=json.loads(json.dumps(call["result"], default=str)),
                    is_error=call["is_error"],
                    duration_ms=call["duration_ms"],
                )
            )
        c.session.add(
            Usage(
                org_id=c.org_id,
                user_id=c.user_id,
                message_id=msg.id,
                model=provider.model,
                input_tokens=tin,
                output_tokens=tout,
                cost_usd=_cost(settings, tin, tout),
                latency_ms=latency,
                rounds=rounds,
                tools_called=[x["name"] for x in calls],
            )
        )
        conv = await get_conversation(c, conversation_id)
        conv.updated_at = datetime.now(UTC)
        await c.session.flush()
        return msg.id

    message_id = await in_tx(ctx, store)
    if error:
        yield {
            "type": "error",
            "message_id": str(message_id),
            "message": "The assistant couldn't finish this answer. Please try again.",
        }
        return
    yield {
        "type": "done",
        "message_id": str(message_id),
        "verified": verified,
        "unverified_numbers": unverified,
        "tool_calls": [
            {"seq": c["seq"], "name": c["name"], "args": c["args"], "is_error": c["is_error"]}
            for c in calls
        ],
        "usage": {
            "input_tokens": tin,
            "output_tokens": tout,
            "rounds": rounds,
            "latency_ms": latency,
        },
    }
