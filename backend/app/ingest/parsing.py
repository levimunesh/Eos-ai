"""Read uploaded CSV/Excel files into rows of raw cell values, profile them, and suggest a
column mapping. Everything here is pure: no database access.
"""

import csv
import hashlib
import io
import re
from collections import Counter
from dataclasses import dataclass, field
from datetime import date, datetime
from difflib import SequenceMatcher
from typing import Any

from app.ingest.convert import CellError, ParseOptions, is_blank, to_date, to_decimal
from app.ingest.specs import EntitySpec, normalise_header

MAX_FILE_BYTES = 25 * 1024 * 1024
MAX_ROWS = 500_000
CSV_ENCODINGS = ("utf-8-sig", "cp1256", "latin-1")  # cp1256: Arabic Windows exports
EXCEL_EXT = (".xlsx", ".xlsm")


class FileReadError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass
class Table:
    headers: list[str]
    rows: list[list[Any]]  # data rows only, already aligned to headers
    header_row_index: int  # 0-based index of the header in the sheet/file
    sheet: str | None = None
    sheets: list[str] = field(default_factory=list)
    encoding: str | None = None
    delimiter: str | None = None

    def file_row_number(self, data_index: int) -> int:
        """1-based row number as the user sees it in Excel or a text editor."""
        return self.header_row_index + 2 + data_index


# ---- reading ---------------------------------------------------------------------


def _cell(v: Any) -> Any:
    if v is None:
        return None
    if isinstance(v, datetime):
        return v.isoformat(sep=" ")
    if isinstance(v, date):
        return v.isoformat()
    if isinstance(v, bool):
        return str(v)
    if isinstance(v, int):
        return str(v)
    if isinstance(v, float):
        return str(int(v)) if v.is_integer() else repr(v)
    return str(v)


def _read_csv(content: bytes) -> tuple[list[list[Any]], str, str]:
    for enc in CSV_ENCODINGS:
        try:
            text = content.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:  # pragma: no cover - latin-1 always decodes
        raise FileReadError("encoding", "Could not read the file's text encoding")
    sample = text[:20000]
    try:
        delimiter = csv.Sniffer().sniff(sample, delimiters=",;\t|").delimiter
    except csv.Error:
        delimiter = ","
    rows = list(csv.reader(io.StringIO(text), delimiter=delimiter))
    return rows, enc, delimiter


def _read_excel(content: bytes, sheet: str | None) -> tuple[list[list[Any]], str, list[str]]:
    import openpyxl

    try:
        wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    except Exception as exc:  # openpyxl raises many types for corrupt files
        raise FileReadError("unreadable_excel", "This Excel file could not be opened") from exc
    names = wb.sheetnames
    name = sheet if sheet in names else names[0]
    rows = [[_cell(c) for c in r] for r in wb[name].iter_rows(values_only=True)]
    wb.close()
    return rows, name, names


def detect_header_row(rows: list[list[Any]], scan: int = 15) -> int:
    """First row in the top `scan` rows that looks like headers: mostly non-empty text,
    not numbers, and followed by a row with a similar width."""
    best, best_score = 0, -1.0
    for i, row in enumerate(rows[:scan]):
        cells = [c for c in row if not is_blank(c)]
        if len(cells) < 2:
            continue
        texty = sum(1 for c in cells if not re.fullmatch(r"[\d.,\-/: ]+", str(c).strip()))
        score = len(cells) * (texty / len(cells))
        if texty / len(cells) >= 0.6 and score > best_score:
            best, best_score = i, score
            if texty == len(cells):
                break
    return best


def read_table(
    content: bytes, file_name: str, *, sheet: str | None = None, header_row: int | None = None
) -> Table:
    if len(content) == 0:
        raise FileReadError("empty_file", "The file is empty")
    if len(content) > MAX_FILE_BYTES:
        raise FileReadError("file_too_large", "Files are limited to 25 MB")
    lower = file_name.lower()
    encoding = delimiter = None
    sheets: list[str] = []
    if lower.endswith(EXCEL_EXT):
        raw, sheet_name, sheets = _read_excel(content, sheet)
    elif lower.endswith((".csv", ".txt", ".tsv")):
        raw, encoding, delimiter = _read_csv(content)
        sheet_name = None
    elif lower.endswith(".xls"):
        raise FileReadError("old_excel", "Old .xls files aren't supported; save as .xlsx or CSV")
    else:
        raise FileReadError("unsupported_type", "Upload a CSV or Excel (.xlsx) file")

    if not any(any(not is_blank(c) for c in r) for r in raw):
        raise FileReadError("empty_file", "The file has no data")
    h = detect_header_row(raw) if header_row is None else header_row
    if h >= len(raw):
        raise FileReadError("bad_header_row", "Header row is beyond the end of the file")

    headers = []
    seen: Counter[str] = Counter()
    for i, c in enumerate(raw[h]):
        name = str(c).strip() if not is_blank(c) else f"Column {i + 1}"
        seen[name] += 1
        headers.append(name if seen[name] == 1 else f"{name} ({seen[name]})")
    width = len(headers)
    data = []
    for r in raw[h + 1 :]:
        r = list(r[:width]) + [None] * (width - len(r))
        data.append(r)
    # Trailing fully-blank rows are layout, not data.
    while data and all(is_blank(c) for c in data[-1]):
        data.pop()
    if len(data) > MAX_ROWS:
        raise FileReadError("too_many_rows", f"Files are limited to {MAX_ROWS:,} rows")
    return Table(headers, data, h, sheet_name, sheets, encoding, delimiter)


def header_signature(headers: list[str]) -> str:
    return hashlib.sha256("|".join(normalise_header(h) for h in headers).encode()).hexdigest()


# ---- profiling ---------------------------------------------------------------------


def _infer(values: list[Any], opts: ParseOptions) -> str:
    if not values:
        return "empty"
    counts = Counter()
    for v in values:
        for kind, fn in (
            ("number", lambda x: to_decimal(x, opts)),
            ("date", lambda x: to_date(x, opts)),
        ):
            try:
                fn(v)
                counts[kind] += 1
                break
            except CellError:
                continue
        else:
            counts["text"] += 1
    kind, n = counts.most_common(1)[0]
    return kind if n / len(values) >= 0.9 else "mixed"


def _date_order_hint(values: list[Any]) -> str | None:
    """If any value has a first part > 12 it must be the day; second part > 12, the month."""
    day_first = month_first = False
    for v in values:
        m = re.match(r"^\s*(\d{1,2})[/.\-](\d{1,2})[/.\-]\d{2,4}", str(v))
        if not m:
            continue
        a, b = int(m[1]), int(m[2])
        day_first |= a > 12
        month_first |= b > 12
    if day_first and not month_first:
        return "DD/MM/YYYY"
    if month_first and not day_first:
        return "MM/DD/YYYY"
    return None


def profile(table: Table, opts: ParseOptions, sample: int = 2000) -> list[dict[str, Any]]:
    rows = table.rows[:sample]
    out = []
    for i, name in enumerate(table.headers):
        col = [r[i] for r in rows]
        present = [v for v in col if not is_blank(v)]
        out.append(
            {
                "name": name,
                "inferred_type": _infer(present[:500], opts),
                "blank_pct": round(1 - len(present) / len(col), 4) if col else 1.0,
                "distinct": len(set(map(str, present))),
                "samples": [str(v) for v in list(dict.fromkeys(map(str, present)))[:5]],
                "date_order_hint": _date_order_hint(present[:500]),
            }
        )
    return out


# ---- mapping suggestions ----------------------------------------------------------------


def suggest_mapping(spec: EntitySpec, headers: list[str]) -> dict[str, dict[str, Any]]:
    """For each field, the best-matching header and a confidence in [0, 1].

    Exact synonym match = 1.0, header containing a synonym = 0.8, close spelling >= 0.85
    similarity = that ratio. A header is used for at most one field (best score wins).
    """
    norm = {h: normalise_header(h) for h in headers}
    candidates: list[tuple[float, str, str]] = []
    for f in spec.fields:
        syns = {normalise_header(s) for s in (*f.synonyms, f.key, f.label)}
        for h, nh in norm.items():
            if not nh:
                continue
            if nh in syns:
                score = 1.0
            elif any(len(s) >= 5 and s in nh for s in syns):
                score = 0.8
            else:
                score = max(SequenceMatcher(None, nh, s).ratio() for s in syns)
                if score < 0.85:
                    continue
            # Prefer required fields slightly when scores tie.
            candidates.append((score + (0.01 if f.required else 0), f.key, h))
    candidates.sort(reverse=True)
    used_fields: set[str] = set()
    used_headers: set[str] = set()
    result: dict[str, dict[str, Any]] = {
        f.key: {"column": None, "confidence": 0.0} for f in spec.fields
    }
    for score, fkey, h in candidates:
        if fkey in used_fields or h in used_headers:
            continue
        result[fkey] = {"column": h, "confidence": round(min(score, 1.0), 2)}
        used_fields.add(fkey)
        used_headers.add(h)
    return result
