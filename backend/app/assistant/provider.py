"""Model providers behind one small interface (ADR 0004).

`stream_round` sends the conversation so far and yields text as it arrives, then a final
`RoundResult` with any tool calls. Swapping providers means implementing this one method.
"""

from collections.abc import AsyncIterator, Sequence
from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass
class ToolCall:
    id: str
    name: str
    input: dict[str, Any]


@dataclass
class RoundResult:
    stop_reason: str  # "tool_use" | "end_turn" | "max_tokens" | ...
    content: list[dict[str, Any]]  # assistant content blocks, replayed in the next round
    tool_calls: list[ToolCall] = field(default_factory=list)
    input_tokens: int = 0
    output_tokens: int = 0


class Provider(Protocol):
    model: str

    def stream_round(
        self,
        *,
        system: str,
        messages: Sequence[dict[str, Any]],
        tools: Sequence[dict[str, Any]],
        max_tokens: int,
    ) -> AsyncIterator[str | RoundResult]: ...


class AnthropicProvider:
    def __init__(self, api_key: str, model: str):
        from anthropic import AsyncAnthropic

        self.client = AsyncAnthropic(api_key=api_key)
        self.model = model

    async def stream_round(self, *, system, messages, tools, max_tokens):
        async with self.client.messages.stream(
            model=self.model,
            max_tokens=max_tokens,
            system=system,
            messages=list(messages),
            tools=list(tools),
        ) as stream:
            async for event in stream:
                if event.type == "text":
                    yield event.text
            final = await stream.get_final_message()
        content: list[dict[str, Any]] = []
        calls: list[ToolCall] = []
        for block in final.content:
            if block.type == "text":
                content.append({"type": "text", "text": block.text})
            elif block.type == "tool_use":
                content.append(
                    {"type": "tool_use", "id": block.id, "name": block.name, "input": block.input}
                )
                calls.append(ToolCall(block.id, block.name, dict(block.input or {})))
        yield RoundResult(
            stop_reason=final.stop_reason or "end_turn",
            content=content,
            tool_calls=calls,
            input_tokens=final.usage.input_tokens,
            output_tokens=final.usage.output_tokens,
        )


@dataclass
class ScriptedRound:
    text: str = ""
    tool_calls: list[tuple[str, dict[str, Any]]] = field(default_factory=list)


class FakeProvider:
    """Deterministic provider for tests: plays back scripted rounds and records what it was
    sent, so tests can assert on the system prompt, tools and tool results."""

    model = "fake-model"

    def __init__(self, rounds: list[ScriptedRound]):
        self.rounds = list(rounds)
        self.calls: list[dict[str, Any]] = []

    async def stream_round(self, *, system, messages, tools, max_tokens):
        self.calls.append(
            {"system": system, "messages": [dict(m) for m in messages], "tools": list(tools)}
        )
        r = self.rounds.pop(0) if self.rounds else ScriptedRound("(no more script)")
        for word in r.text.split(" "):
            if word:
                yield word + " "
        content: list[dict[str, Any]] = []
        if r.text:
            content.append({"type": "text", "text": r.text})
        calls = []
        for i, (name, args) in enumerate(r.tool_calls):
            tid = f"toolu_{len(self.calls)}_{i}"
            content.append({"type": "tool_use", "id": tid, "name": name, "input": args})
            calls.append(ToolCall(tid, name, args))
        yield RoundResult(
            stop_reason="tool_use" if calls else "end_turn",
            content=content,
            tool_calls=calls,
            input_tokens=100,
            output_tokens=20,
        )
