"""The demo generator is the source of truth for the eval set, so it gets its own checks:
determinism, internal consistency, and a recomputation of key answers straight from the
CSV files with no shared code."""

import csv
import importlib.util
import json
import sys
from collections import defaultdict
from decimal import Decimal
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "generate_demo_data.py"


def _load():
    spec = importlib.util.spec_from_file_location("gen", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    sys.modules["gen"] = mod  # dataclasses resolve annotations via sys.modules
    assert spec.loader
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture(scope="module")
def generated(tmp_path_factory):
    gen = _load()
    out = tmp_path_factory.mktemp("demo")
    manifest = gen.run(out, seed=20251)
    answers = json.loads((out / "expected" / "answers.json").read_text())
    return out, manifest, answers


def test_deterministic(generated, tmp_path):
    _, manifest, _ = generated
    again = _load().run(tmp_path, seed=20251)
    assert again["sha256"] == manifest["sha256"]


def test_different_seed_differs(generated, tmp_path):
    _, manifest, _ = generated
    other = _load().run(tmp_path, seed=7)
    assert other["sha256"]["sales.csv"] != manifest["sha256"]["sales.csv"]


def test_labelled_as_demo(generated):
    out, manifest, answers = generated
    assert manifest["demo"] is True and answers["demo"] is True
    with (out / "branches.csv").open() as f:
        assert all(r["Note"] == "DEMO DATA" for r in csv.DictReader(f))


def test_net_sales_identity(generated):
    _, _, a = generated
    for m in [a["year"], *a["by_month"].values()]:
        g, d, r, n = (Decimal(m[k]) for k in ("gross_sales", "discounts", "returns", "net_sales"))
        assert abs((g - d - r) - n) <= Decimal("0.002")


def test_months_add_up_to_year(generated):
    _, _, a = generated
    total = sum(Decimal(m["net_sales"]) for m in a["by_month"].values())
    assert abs(total - Decimal(a["year"]["net_sales"])) <= Decimal("0.012")
    assert sum(m["transactions"] for m in a["by_month"].values()) == a["year"]["transactions"]


def test_recompute_net_sales_and_transactions_from_csv(generated):
    """Independent of the generator's own accumulators: re-read the export."""
    out, _, a = generated
    net = Decimal(0)
    receipts: set[str] = set()
    by_month = defaultdict(Decimal)
    with (out / "sales.csv").open() as f:
        for row in csv.DictReader(f):
            if row["Status"] == "VOID":
                continue
            line_net = Decimal(row["Qty"]) * Decimal(row["Unit Price"]) - Decimal(row["Discount"])
            net += line_net
            dd, mm, yyyy = row["Date"][:10].split("/")
            by_month[f"{yyyy}-{mm}"] += line_net
            if row["Status"] == "COMPLETED":
                receipts.add(row["Receipt No"])
    assert abs(net - Decimal(a["year"]["net_sales"])) <= Decimal("0.01")
    assert len(receipts) == a["year"]["transactions"]
    assert abs(by_month["2025-03"] - Decimal(a["by_month"]["2025-03"]["net_sales"])) <= Decimal(
        "0.002"
    )


def test_ramadan_lifts_march_sales(generated):
    _, _, a = generated
    feb, mar = (Decimal(a["by_month"][m]["net_sales"]) for m in ("2025-02", "2025-03"))
    assert mar > feb * Decimal("1.1")


def test_multicurrency_present(generated):
    out, _, _ = generated
    with (out / "purchases.csv").open() as f:
        currencies = {r["Currency"] for r in csv.DictReader(f)}
    assert {"OMR", "USD", "AED"} <= currencies
    with (out / "expenses.csv").open() as f:
        assert "AED" in {r["Currency"] for r in csv.DictReader(f)}


def test_gross_profit_marked_partial_when_costs_missing(generated):
    _, _, a = generated
    assert a["year"]["gross_profit_status"] == "partial"
    assert Decimal("0.80") < Decimal(a["year"]["cogs_coverage"]) < Decimal("1")


def test_messy_file_has_known_problems(generated):
    out, _, _ = generated
    with (out / "messy" / "sales_messy.csv").open() as f:
        rows = list(csv.DictReader(f))
    text = json.dumps(rows)
    assert "IGNORE ALL PREVIOUS INSTRUCTIONS" in text
    assert "31/02/2025 10:00" in text
    assert any(r["Qty"] == "two" for r in rows)
    assert any(r["Receipt No"] == "" for r in rows)
