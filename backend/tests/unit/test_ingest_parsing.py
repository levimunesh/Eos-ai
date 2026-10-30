import io
from datetime import date, datetime
from decimal import Decimal

import openpyxl
import pytest

from app.ingest.convert import (
    CellError,
    ParseOptions,
    to_code,
    to_currency,
    to_date,
    to_datetime,
    to_decimal,
    to_status,
)
from app.ingest.parsing import FileReadError, read_table, suggest_mapping
from app.ingest.specs import ENTITIES

DMY = ParseOptions(date_format="DD/MM/YYYY")
MDY = ParseOptions(date_format="MM/DD/YYYY")


@pytest.mark.parametrize(
    "raw,expected",
    [("12.5", "12.5"), ("-3", "-3"), ("(4.25)", "-4.25"), (" 7 ", "7"), (".5", "0.5"), (3, "3")],
)
def test_decimals(raw, expected):
    assert to_decimal(raw, DMY) == Decimal(expected)


@pytest.mark.parametrize(
    "raw,code",
    [
        ("1,250", "ambiguous_number"),
        ("two", "not_a_number"),
        ("OMR 5", "not_a_number"),
        ("1.2.3", "not_a_number"),
    ],
)
def test_bad_decimals(raw, code):
    with pytest.raises(CellError) as e:
        to_decimal(raw, DMY)
    assert e.value.code == code


def test_thousands_separator_when_declared():
    assert to_decimal("1,250.50", ParseOptions(thousands_separator=",")) == Decimal("1250.50")
    eu = ParseOptions(thousands_separator=".", decimal_separator=",")
    assert to_decimal("1.250,50", eu) == Decimal("1250.50")


def test_float_from_excel_keeps_exact_digits():
    assert to_decimal(0.1, DMY) == Decimal("0.1")


def test_day_month_order_follows_setting():
    assert to_date("03/04/2025", DMY) == date(2025, 4, 3)
    assert to_date("03/04/2025", MDY) == date(2025, 3, 4)
    assert to_date("2025-04-03", MDY) == date(2025, 4, 3)  # ISO always accepted


@pytest.mark.parametrize("raw", ["31/02/2025", "2025-13-01", "hello", "32/01/2025"])
def test_impossible_dates(raw):
    with pytest.raises(CellError):
        to_date(raw, DMY)


def test_iso_only_rejects_slashes():
    with pytest.raises(CellError) as e:
        to_date("03/04/2025", ParseOptions(date_format="YYYY-MM-DD"))
    assert e.value.code == "unexpected_date_format"


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("05/01/2025 14:30", datetime(2025, 1, 5, 14, 30)),
        ("05/01/2025 2:30 PM", datetime(2025, 1, 5, 14, 30)),
        ("05/01/2025 12:05 am", datetime(2025, 1, 5, 0, 5)),
        ("2025-01-05T09:00:15", datetime(2025, 1, 5, 9, 0, 15)),
        ("05/01/2025", datetime(2025, 1, 5)),
    ],
)
def test_datetimes(raw, expected):
    assert to_datetime(raw, DMY) == expected


def test_codes_lose_excel_float_tail():
    assert to_code("00123") == "00123"
    assert to_code("123.0") == "123"


def test_currency_and_status():
    assert to_currency("usd", DMY) == "USD"
    assert to_currency("", ParseOptions(default_currency="KWD")) == "KWD"
    with pytest.raises(CellError):
        to_currency("XYZ", DMY)
    assert to_status("RETURN") == "refund"
    assert to_status("Cancelled") == "voided"
    assert to_status("paid") == "completed"


def _xlsx(rows: list[list]) -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Sales"
    for r in rows:
        ws.append(r)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_excel_with_title_rows_finds_header_and_keeps_dates():
    content = _xlsx(
        [
            ["Eos Trading Co. - Sales report"],
            [],
            ["Bill No", "Store", "Date", "Item", "Quantity", "Price"],
            ["B1", "EOS-01", datetime(2025, 3, 1, 10, 15), "SKU-1", 2, 1.5],
            ["B2", "EOS-01", datetime(2025, 3, 1, 11, 0), "SKU-2", 1, 0.1],
        ]
    )
    t = read_table(content, "report.xlsx")
    assert t.header_row_index == 2
    assert t.headers[:3] == ["Bill No", "Store", "Date"]
    assert t.file_row_number(0) == 4
    assert t.rows[0][2] == "2025-03-01 10:15:00"
    assert to_decimal(t.rows[1][5], DMY) == Decimal("0.1")
    m = suggest_mapping(ENTITIES["sales"], t.headers)
    assert m["receipt_no"]["column"] == "Bill No"
    assert m["branch_code"]["column"] == "Store"
    assert m["qty"]["column"] == "Quantity"


def test_arabic_windows_csv_is_decoded():
    text = "رقم الفاتورة,الفرع\nR1,EOS-01\n"
    t = read_table(text.encode("cp1256"), "ar.csv")
    assert t.headers == ["رقم الفاتورة", "الفرع"]
    assert t.encoding == "cp1256"
    m = suggest_mapping(ENTITIES["sales"], t.headers)
    assert m["receipt_no"]["column"] == "رقم الفاتورة"
    assert m["branch_code"]["column"] == "الفرع"


def test_semicolon_csv():
    t = read_table(b"Item Code;Item Description\nA1;Tea\nA2;Coffee\n", "p.csv")
    assert t.delimiter == ";" and t.headers == ["Item Code", "Item Description"]


@pytest.mark.parametrize(
    "name,content,code",
    [
        ("a.csv", b"", "empty_file"),
        ("a.xls", b"xx", "old_excel"),
        ("a.json", b"{}", "unsupported_type"),
        ("a.xlsx", b"not excel", "unreadable_excel"),
    ],
)
def test_file_errors(name, content, code):
    with pytest.raises(FileReadError) as e:
        read_table(content, name)
    assert e.value.code == code


def test_line_total_is_not_mistaken_for_line_number():
    m = suggest_mapping(ENTITIES["sales"], ["Receipt No", "Line Total", "Qty"])
    assert m["line_no"]["column"] is None
