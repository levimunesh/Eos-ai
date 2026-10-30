# ADR 0004: AI reads data only through typed tools; answers are number-checked

Status: proposed · 2026-10-30

## Decision
- Claude is called through a small provider interface (`assistant/provider/base.py`) with one Anthropic implementation.
- The model gets typed tools (Pydantic args and results). No SQL generation, no direct DB access, no write tools in the MVP.
- Tools receive the caller's `OrgContext` from the server, never from model arguments.
- After each answer, a verifier checks every number in the text against that turn's tool results. Unmatched numbers are flagged in the UI and logged.
- Plain tool-use loop, max 8 rounds per question. No LangGraph in the MVP.

## Why
The product's credibility rests on correct numbers. Typed tools keep calculations deterministic and permission checks in code. The verifier turns "never invent figures" from a prompt instruction into a check.

## Revisit when
Multi-agent orchestration or approval-gated actions are in scope.
