"""Run the assistant eval set against a running EOS API and score it.

    uv run python ../eval/run_eval.py --base http://localhost:8000/api/v1 \
        --token <supabase access token> --org <org id with the demo company loaded>

Needs ANTHROPIC_API_KEY on the server. Prints a per-question table and a summary, writes
eval/results/<timestamp>.json, and exits non-zero when the pass threshold is not met.

Grading (see questions.yaml): every expected figure must appear exactly in the answer
(thousands separators allowed; ratios may be given as percentages), the server-side
verifier must report zero unverified figures, and guard questions follow their own rule.
"""

import argparse
import json
import re
import sys
import time
from datetime import UTC, datetime
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

import httpx
import yaml

HERE = Path(__file__).resolve().parent


def figure_forms(value) -> set[str]:
    """Strings that count as 'the figure appears': the exact value, with or without
    thousands separators; for ratios in (0, 10), also the percentage with 1-2 decimals."""
    if isinstance(value, bool) or value is None:
        return set()
    if isinstance(value, (int, float, str)) and re.fullmatch(r"-?\d+(\.\d+)?", str(value)):
        d = Decimal(str(value))
        plain = format(d, "f")
        out = {plain, f"{d:,}"}
        if 0 < abs(d) < 10 and d != d.to_integral_value():
            for places in (1, 2):
                p = (d * 100).quantize(Decimal(1).scaleb(-places), rounding=ROUND_HALF_UP)
                out.add(f"{p}%")
                out.add(f"{p} %")
        return out
    return {str(value)}


def contains_figure(answer: str, value) -> bool:
    """Whole-token match: '418,364.517' must not be satisfied by '1,418,364.5170'."""
    for f in figure_forms(value):
        if re.search(rf"(?<![\d.,]){re.escape(f)}(?![\d])", answer):
            return True
    return False


def ask(client: httpx.Client, base: str, headers: dict, question: str) -> dict:
    conv = client.post(f"{base}/assistant/conversations", json={}, headers=headers)
    conv.raise_for_status()
    cid = conv.json()["id"]
    text, done, error = [], None, None
    with client.stream(
        "POST", f"{base}/assistant/conversations/{cid}/messages",
        json={"content": question}, headers=headers, timeout=180,
    ) as r:
        r.raise_for_status()
        buf = ""
        for chunk in r.iter_text():
            buf += chunk
            while "\n\n" in buf:
                block, buf = buf.split("\n\n", 1)
                data = next((ln[6:] for ln in block.splitlines() if ln.startswith("data: ")), None)
                if not data:
                    continue
                ev = json.loads(data)
                if ev["type"] == "text":
                    text.append(ev["text"])
                elif ev["type"] == "done":
                    done = ev
                elif ev["type"] == "error":
                    error = ev
    return {"conversation_id": cid, "answer": "".join(text), "done": done, "error": error}


def grade(q: dict, result: dict) -> tuple[bool, list[str]]:
    reasons = []
    if result["error"]:
        return False, [f"error: {result['error']['message']}"]
    ans = result["answer"]
    done = result["done"] or {}
    if done.get("unverified_numbers"):
        reasons.append(f"unverified figures: {done['unverified_numbers']}")
    exp = q["expect"]
    kind = q.get("kind", "numeric")
    if kind == "guard":
        if exp.get("no_data"):
            if re.search(r"\b(no|isn't any|aren't any|don't have|do not have)\b.*\b(data|sales|records)\b",
                         ans, re.I | re.S) is None:
                reasons.append("did not say there is no data")
            if re.search(r"\d{1,3}(,\d{3})+(\.\d+)?|\d{4,}\.\d+", ans):
                reasons.append("stated a figure for a period with no data")
        for bad in exp.get("must_not_contain", []):
            if bad in ans:
                reasons.append(f"contains forbidden text {bad!r}")
        if "unconverted_lines" in exp:
            if not re.search(r"\b(no|none|all|every)\b", ans, re.I):
                reasons.append("did not state that all sales converted")
    else:
        for key, value in exp.items():
            if key in ("status", "branch", "category"):
                if str(value).lower() not in ans.lower():
                    reasons.append(f"missing {key}={value}")
            elif key in ("previous_value", "change_abs", "change_pct") and kind == "compare":
                continue  # accepted either as tool figures or these; checked via verifier
            elif not contains_figure(ans, value):
                reasons.append(f"missing {key}={value}")
    return (not reasons), reasons


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:8000/api/v1")
    ap.add_argument("--token", required=True, help="Supabase access token of a member")
    ap.add_argument("--org", required=True, help="Organisation id with the demo data loaded")
    ap.add_argument("--only", help="Comma-separated question ids")
    args = ap.parse_args()

    spec = yaml.safe_load((HERE / "questions.yaml").read_text())
    questions = spec["questions"]
    if args.only:
        wanted = set(args.only.split(","))
        questions = [q for q in questions if q["id"] in wanted]
    headers = {"Authorization": f"Bearer {args.token}", "X-Org-Id": args.org}
    rows = []
    with httpx.Client() as client:
        status = client.get(f"{args.base}/assistant/status", headers=headers).json()
        print(f"model: {status.get('model')}  configured: {status.get('configured')}\n")
        for q in questions:
            t0 = time.perf_counter()
            res = ask(client, args.base, headers, q["question"])
            ok, reasons = grade(q, res)
            secs = time.perf_counter() - t0
            rows.append({"id": q["id"], "kind": q.get("kind", "numeric"), "pass": ok,
                         "reasons": reasons, "seconds": round(secs, 1),
                         "question": q["question"], "answer": res["answer"],
                         "done": res["done"], "error": res["error"]})
            mark = "PASS" if ok else "FAIL"
            print(f"{mark}  {q['id']:<12} {secs:5.1f}s  {'; '.join(reasons)}")

    numeric = [r for r in rows if r["kind"] != "guard"]
    guards = [r for r in rows if r["kind"] == "guard"]
    num_pct = 100 * sum(r["pass"] for r in numeric) / max(len(numeric), 1)
    unverified = sum(1 for r in rows if (r["done"] or {}).get("unverified_numbers"))
    threshold = spec["pass_threshold"]
    passed = (num_pct >= threshold["numeric_exact_pct"]
              and unverified <= threshold["unverified_figures_allowed"]
              and all(r["pass"] for r in guards))
    print(f"\nnumeric exact: {num_pct:.0f}% ({sum(r['pass'] for r in numeric)}/{len(numeric)})"
          f"  guards: {sum(r['pass'] for r in guards)}/{len(guards)}"
          f"  answers with unverified figures: {unverified}"
          f"\nRESULT: {'PASS' if passed else 'FAIL'} "
          f"(threshold {threshold['numeric_exact_pct']}% exact, "
          f"{threshold['unverified_figures_allowed']} unverified)")
    out_dir = HERE / "results"
    out_dir.mkdir(exist_ok=True)
    out = out_dir / f"{datetime.now(UTC):%Y%m%dT%H%M%SZ}.json"
    out.write_text(json.dumps({"summary": {"numeric_exact_pct": num_pct, "unverified": unverified,
                                           "passed": passed, "model": status.get("model")},
                               "rows": rows}, indent=2))
    print(f"written {out}")
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
