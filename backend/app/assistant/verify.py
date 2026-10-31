"""Check that every figure in an answer came from a tool result in the same turn (ADR 0004).

A number in the answer counts as verified when it equals, after normalising, a number in
any tool result, that number rounded to 0-4 decimals, its absolute value, or (for ratios)
the same value expressed as a percentage with 0-2 decimals.

Deliberately ignored, because they are not business figures: dates, years 1900-2100,
codes like EOS-01 or SKU-0012, citation markers like [2], and bare whole numbers up to
31 (days, list sizes such as "top 5"). This is a guard against invented figures, not a
proof of correctness; it is tested against both honest and fabricated answers.
"""

import re
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from typing import Any

_NUMERIC = re.compile(r"^-?\d+(\.\d+)?$")
_DATES = re.compile(
    r"\b\d{4}-\d{1,2}-\d{1,2}\b|\b\d{1,2}/\d{1,2}/\d{2,4}\b|"
    r"\b\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:\s+\d{4})?\b|"
    r"\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:,?\s+\d{4})?\b",
    re.IGNORECASE,
)
_CODES = re.compile(r"\b[A-Za-z]+[-_]\d+[A-Za-z0-9-]*\b")
_CITES = re.compile(r"\[\d+(?:\s*,\s*\d+)*\]")
_NUMBER = re.compile(r"(?<![\w.])-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?%?")


def _norm(d: Decimal) -> str:
    d = d.normalize()
    s = format(d, "f")
    return "0" if s in ("-0", "0") else s


def _variants(d: Decimal) -> set[str]:
    out = {_norm(d), _norm(abs(d))}
    for places in range(5):
        q = d.quantize(Decimal(1).scaleb(-places), rounding=ROUND_HALF_UP)
        out |= {_norm(q), _norm(abs(q))}
    if abs(d) <= 10 and d != d.to_integral_value():  # ratios -> percentages
        pct = d * 100
        for places in range(3):
            q = pct.quantize(Decimal(1).scaleb(-places), rounding=ROUND_HALF_UP)
            out |= {_norm(q), _norm(abs(q))}
    return out


def _collect(obj: Any, acc: set[str]) -> None:
    if isinstance(obj, dict):
        for v in obj.values():
            _collect(v, acc)
    elif isinstance(obj, list):
        for v in obj:
            _collect(v, acc)
    elif isinstance(obj, bool) or obj is None:
        return
    elif isinstance(obj, (int, float, Decimal)):
        acc |= _variants(Decimal(str(obj)))
    elif isinstance(obj, str) and _NUMERIC.match(obj.strip()):
        try:
            acc |= _variants(Decimal(obj.strip()))
        except InvalidOperation:
            pass


def allowed_numbers(tool_results: list[Any]) -> set[str]:
    acc: set[str] = set()
    for r in tool_results:
        _collect(r, acc)
    return acc


def numbers_in(answer: str) -> list[str]:
    cleaned = _CITES.sub(" ", answer)
    cleaned = _DATES.sub(" ", cleaned)
    cleaned = _CODES.sub(" ", cleaned)
    found = []
    for m in _NUMBER.finditer(cleaned):
        raw = m.group(0)
        is_pct = raw.endswith("%")
        digits = raw.rstrip("%").replace(",", "")
        value = Decimal(digits)
        whole = "." not in digits
        if whole and not is_pct and "," not in raw:
            if 1900 <= value <= 2100 or abs(value) <= 31:
                continue
        found.append(raw)
    return found


def verify(answer: str, tool_results: list[Any]) -> tuple[bool, list[str]]:
    allowed = allowed_numbers(tool_results)
    unverified = []
    for raw in numbers_in(answer):
        value = _norm(Decimal(raw.rstrip("%").replace(",", "")))
        if value not in allowed and _norm(abs(Decimal(value))) not in allowed:
            unverified.append(raw)
    return (not unverified), list(dict.fromkeys(unverified))
