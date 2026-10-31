"""The eval grader itself must be right, or the eval proves nothing."""

import importlib.util
from pathlib import Path

import yaml

EVAL = Path(__file__).resolve().parents[2].parent / "eval"


def _grader():
    spec = importlib.util.spec_from_file_location("run_eval", EVAL / "run_eval.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_questions_file_is_well_formed():
    doc = yaml.safe_load((EVAL / "questions.yaml").read_text())
    assert doc["demo"] is True and len(doc["questions"]) >= 30
    ids = [q["id"] for q in doc["questions"]]
    assert len(ids) == len(set(ids))
    for q in doc["questions"]:
        assert q["question"] and q["expect"] and q["period"]


def test_figure_forms_accept_separators_and_percentages():
    g = _grader()
    assert "418,364.517" in g.figure_forms("418364.517")
    assert "48,475" in g.figure_forms(48475)
    assert "36.3%" in g.figure_forms("0.3631") and "36.31%" in g.figure_forms("0.3631")
    assert g.contains_figure("Net sales were OMR 418,364.517 [1].", "418364.517")
    assert not g.contains_figure("Net sales were OMR 418,364.52 [1].", "418364.517")


def test_grade_numeric_and_guard_questions():
    g = _grader()
    q = {"kind": "numeric", "expect": {"net_sales": "418364.517", "transactions": 48475}}
    ok, why = g.grade(
        q,
        {
            "error": None,
            "answer": "OMR 418,364.517 across 48,475 receipts",
            "done": {"unverified_numbers": []},
        },
    )
    assert ok, why
    ok, why = g.grade(
        q,
        {
            "error": None,
            "answer": "OMR 418,364.517 across 48,475 receipts",
            "done": {"unverified_numbers": ["12%"]},
        },
    )
    assert not ok and "unverified" in why[0]
    guard = {"kind": "guard", "expect": {"no_data": True}}
    ok, _ = g.grade(
        guard,
        {
            "error": None,
            "done": {},
            "answer": "There is no sales data for 2024; records start 2025-01-01.",
        },
    )
    assert ok
    ok, why = g.grade(
        guard, {"error": None, "done": {}, "answer": "2024 net sales were 380,000.000 OMR."}
    )
    assert not ok
