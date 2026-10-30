"""Strict cell converters. A value either converts unambiguously or raises CellError.

Nothing is guessed: "1,250" is rejected unless the import says commas are thousands
separators, and day/month order comes from the organisation or import settings.
"""

import re
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from app.core import currency as ccy
from app.ingest.specs import STATUS_WORDS, normalise_header


class CellError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass(frozen=True)
class ParseOptions:
    date_format: str = "DD/MM/YYYY"  # DD/MM/YYYY | MM/DD/YYYY | YYYY-MM-DD
    thousands_separator: str | None = None  # None | "," | " " | "."
    decimal_separator: str = "."
    default_currency: str = "OMR"


_NUM = re.compile(r"^[+-]?(\d+(\.\d*)?|\.\d+)$")
_ISO_DATE = re.compile(r"^(\d{4})-(\d{1,2})-(\d{1,2})")
_DMY = re.compile(r"^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})")
_TIME = re.compile(r"(?:[T\s]+)(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*([AaPp][Mm])?\s*$")


def is_blank(v: object) -> bool:
    return v is None or (isinstance(v, str) and v.strip() == "")


def to_text(v: object, max_len: int = 1000) -> str:
    s = str(v).strip()
    if len(s) > max_len:
        raise CellError("too_long", f"Longer than {max_len} characters")
    return s


def to_code(v: object) -> str:
    s = to_text(v, 100)
    # Excel often turns codes like 00123 into 123.0; undo the float tail only.
    if re.fullmatch(r"\d+\.0", s):
        s = s[:-2]
    return s


def to_decimal(v: object, opts: ParseOptions) -> Decimal:
    if isinstance(v, (int, Decimal)):
        return Decimal(v)
    if isinstance(v, float):
        return Decimal(repr(v))
    s = str(v).strip().replace(" ", " ")
    negative = False
    if s.startswith("(") and s.endswith(")"):  # accounting negatives
        negative, s = True, s[1:-1].strip()
    if opts.thousands_separator:
        s = s.replace(opts.thousands_separator, "")
    if opts.decimal_separator != ".":
        if "." in s:
            raise CellError("ambiguous_number", f"'{v}' mixes decimal separators")
        s = s.replace(opts.decimal_separator, ".")
    if "," in s:
        raise CellError(
            "ambiguous_number",
            f"'{v}' contains a comma; set the thousands separator if that is what it is",
        )
    if not _NUM.match(s):
        raise CellError("not_a_number", f"'{v}' is not a number")
    try:
        d = Decimal(s)
    except InvalidOperation as exc:
        raise CellError("not_a_number", f"'{v}' is not a number") from exc
    return -d if negative else d


def _make_date(y: int, m: int, d: int, raw: object) -> date:
    if y < 100:
        y += 2000
    try:
        return date(y, m, d)
    except ValueError as exc:
        raise CellError("invalid_date", f"'{raw}' is not a real date") from exc


def _parse_date_part(s: str, opts: ParseOptions, raw: object) -> tuple[date, str]:
    m = _ISO_DATE.match(s)
    if m:
        return _make_date(int(m[1]), int(m[2]), int(m[3]), raw), s[m.end() :]
    m = _DMY.match(s)
    if m:
        a, b, y = int(m[1]), int(m[2]), int(m[3])
        if opts.date_format == "MM/DD/YYYY":
            month, day = a, b
        elif opts.date_format == "DD/MM/YYYY":
            day, month = a, b
        else:
            raise CellError("unexpected_date_format", f"'{raw}' does not match {opts.date_format}")
        return _make_date(y, month, day, raw), s[m.end() :]
    raise CellError("invalid_date", f"'{raw}' is not a recognised date")


def to_date(v: object, opts: ParseOptions) -> date:
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    s = str(v).strip()
    d, rest = _parse_date_part(s, opts, v)
    if rest.strip() and not _TIME.fullmatch(rest):
        raise CellError("invalid_date", f"'{v}' has unexpected text after the date")
    return d


def to_datetime(v: object, opts: ParseOptions) -> datetime:
    """Naive local datetime; the caller attaches the organisation's timezone."""
    if isinstance(v, datetime):
        return v.replace(tzinfo=None)
    if isinstance(v, date):
        return datetime(v.year, v.month, v.day)
    s = str(v).strip()
    d, rest = _parse_date_part(s, opts, v)
    if not rest.strip():
        return datetime(d.year, d.month, d.day)
    m = _TIME.fullmatch(rest)
    if not m:
        raise CellError("invalid_datetime", f"'{v}' has an unrecognised time")
    hour, minute, sec = int(m[1]), int(m[2]), int(m[3] or 0)
    ampm = (m[4] or "").lower()
    if ampm == "pm" and hour < 12:
        hour += 12
    elif ampm == "am" and hour == 12:
        hour = 0
    if hour > 23 or minute > 59 or sec > 59:
        raise CellError("invalid_datetime", f"'{v}' has an impossible time")
    return datetime(d.year, d.month, d.day, hour, minute, sec)


def to_currency(v: object, opts: ParseOptions) -> str:
    if is_blank(v):
        return opts.default_currency
    s = str(v).strip().upper()
    if not ccy.is_supported(s):
        raise CellError("unknown_currency", f"'{v}' is not a supported currency code")
    return s


_STATUS_LOOKUP = {
    normalise_header(word): status for status, words in STATUS_WORDS.items() for word in words
}


def to_status(v: object) -> str:
    key = normalise_header(str(v))
    if key not in _STATUS_LOOKUP:
        raise CellError("unknown_status", f"'{v}' is not a known sale status")
    return _STATUS_LOOKUP[key]


def convert(kind: str, v: object, opts: ParseOptions):
    if kind == "text":
        return to_text(v)
    if kind == "code":
        return to_code(v)
    if kind == "decimal":
        return to_decimal(v, opts)
    if kind == "date":
        return to_date(v, opts)
    if kind == "datetime":
        return to_datetime(v, opts)
    if kind == "currency":
        return to_currency(v, opts)
    if kind == "status":
        return to_status(v)
    raise ValueError(f"unknown kind {kind}")
