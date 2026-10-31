"""Insights: what changed, what drove it, and what needs attention. Every statement is
computed from the same aggregates as the dashboard; nothing is estimated or generated.

Each insight carries `kind`, `severity` (info | notice | warning), a plain-language
`text`, the `figures` it is built from (so the UI can show them as checkable chips), and
`evidence` with the exact query scope. The assistant exposes this as a tool too, so its
"possible reasons" are grounded in the same arithmetic.
"""

from dataclasses import asdict, dataclass, field
from datetime import date, timedelta
from decimal import Decimal
from statistics import median
from typing import Any
from uuid import UUID

from sqlalchemy import select

from app.core import currency
from app.core.tenancy import OrgContext
from app.kpi import engine, service
from app.kpi.definitions import change_pct, quantize
from app.orgs.models import Organisation

SIGNIFICANT = Decimal("0.05")  # 5% move before we call it a change
DRIVER_SHARE = Decimal("0.5")  # a branch/category "drove" a move when it explains >= 50%
DAY_OUTLIER = Decimal("0.35")  # a day is unusual at 35% below/above the median


@dataclass
class Insight:
    kind: str
    severity: str
    text: str
    figures: dict[str, Any] = field(default_factory=dict)
    evidence: dict[str, Any] = field(default_factory=dict)


def _pct(v: Decimal | None) -> str:
    return "—" if v is None else f"{v * 100:+.1f}%"


def _money(v: Decimal, dp: int, ccy: str) -> str:
    return f"{quantize(v, dp):,} {ccy}"


async def compute(
    ctx: OrgContext, start: date, end: date, branch_ids: list[UUID] | None
) -> dict[str, Any]:
    service.check_range(start, end)
    org = (
        await ctx.session.execute(select(Organisation).where(Organisation.id == ctx.org_id))
    ).scalar_one()
    dp = currency.minor_units(org.base_currency)
    ccy = org.base_currency
    scope = service.scope(ctx, branch_ids)
    base = dict(org_id=ctx.org_id, base=ccy, incl_tax=org.prices_include_tax, branch_ids=scope)
    p_now = engine.params(start=start, end=end, **base)
    prev_start, prev_end = engine.previous_period(start, end)
    p_prev = engine.params(start=prev_start, end=prev_end, **base)

    now = await engine.sales_agg(ctx.session, p_now)
    prev = await engine.sales_agg(ctx.session, p_prev)
    insights: list[Insight] = []
    period = {"from": start.isoformat(), "to": end.isoformat()}
    prev_period = {"from": prev_start.isoformat(), "to": prev_end.isoformat()}

    if now.lines == 0:
        return {
            "period": period,
            "insights": [
                asdict(
                    Insight("no_data", "info", "No sales in this period.", {}, {"period": period})
                )
            ],
        }

    # 1. Headline move and its biggest driver -------------------------------------------
    net_change = change_pct(now.net, prev.net) if prev.lines else None
    if net_change is not None and abs(net_change) >= SIGNIFICANT:
        delta = now.net - prev.net
        direction = "up" if delta > 0 else "down"
        figures = {
            "net_sales": str(quantize(now.net, dp)),
            "previous_net_sales": str(quantize(prev.net, dp)),
            "change_pct": str(net_change),
            "change_abs": str(quantize(delta, dp)),
        }
        text = (
            f"Net sales {direction} {_pct(net_change)} to {_money(now.net, dp, ccy)} "
            f"({_money(delta, dp, ccy)} vs the previous period)."
        )
        # Driver: which branch (or category when one branch) explains most of the move.
        dim = "branch" if (scope is None or len(scope) > 1) else "category"
        rows_now = {
            r["key"]: r for r in await engine.sales_breakdown(ctx.session, p_now, dim, 100, "net")
        }
        rows_prev = {
            r["key"]: r for r in await engine.sales_breakdown(ctx.session, p_prev, dim, 100, "net")
        }
        moves = []
        for key in set(rows_now) | set(rows_prev):
            a = rows_now.get(key, {}).get("net", Decimal(0))
            b = rows_prev.get(key, {}).get("net", Decimal(0))
            moves.append((key, a - b, a, b))
        moves.sort(key=lambda m: abs(m[1]), reverse=True)
        if moves and delta != 0:
            key, d, a, b = moves[0]
            share = d / delta if delta else Decimal(0)
            if share >= DRIVER_SHARE and (d > 0) == (delta > 0):
                share_q = quantize(share, 2)
                text += (
                    f" {key} drove {share_q * 100:.0f}% of the move "
                    f"({_money(b, dp, ccy)} → {_money(a, dp, ccy)})."
                )
                figures.update(
                    {
                        "driver": key,
                        "driver_share": str(share_q),
                        "driver_now": str(quantize(a, dp)),
                        "driver_previous": str(quantize(b, dp)),
                    }
                )
        insights.append(
            Insight(
                "headline_change",
                "notice",
                text,
                figures,
                {"period": period, "previous_period": prev_period, "dimension": dim},
            )
        )

    # 2. Margin pressure: discounts or returns growing faster than sales -------------------
    if prev.lines:
        for label, a, b in (
            ("Discounts", now.discounts, prev.discounts),
            ("Returns", now.returns, prev.returns),
        ):
            c = change_pct(a, b)
            if c is not None and net_change is not None and c - net_change >= SIGNIFICANT and a > 0:
                insights.append(
                    Insight(
                        "margin_pressure",
                        "warning",
                        f"{label} rose {_pct(c)} while net sales moved {_pct(net_change)}: "
                        f"{_money(a, dp, ccy)} this period vs {_money(b, dp, ccy)} before.",
                        {
                            label.lower(): str(quantize(a, dp)),
                            f"previous_{label.lower()}": str(quantize(b, dp)),
                            "change_pct": str(c),
                            "net_change_pct": str(net_change),
                        },
                        {"period": period, "previous_period": prev_period},
                    )
                )

    # 3. Unusual days (needs at least 14 days) --------------------------------------------
    if (end - start).days + 1 >= 14:
        days = await engine.sales_breakdown(ctx.session, p_now, "day", 1000, "key")
        values = [r["net"] for r in days if r["net"] > 0]
        if len(values) >= 10:
            med = Decimal(str(median(values)))
            if med > 0:
                for r in days:
                    dev = (r["net"] - med) / med
                    if abs(dev) >= DAY_OUTLIER:
                        word = "below" if dev < 0 else "above"
                        insights.append(
                            Insight(
                                "unusual_day",
                                "notice" if dev < 0 else "info",
                                f"{r['label']}: net sales {_money(r['net'], dp, ccy)}, "
                                f"{abs(dev) * 100:.0f}% {word} the period's typical day "
                                f"({_money(med, dp, ccy)}).",
                                {
                                    "date": r["label"],
                                    "net_sales": str(quantize(r["net"], dp)),
                                    "median_day": str(quantize(med, dp)),
                                    "deviation_pct": str(quantize(dev, 4)),
                                },
                                {"period": period, "dimension": "day"},
                            )
                        )
            # keep the 3 largest deviations only
            unusual = [i for i in insights if i.kind == "unusual_day"]
            if len(unusual) > 3:
                unusual.sort(key=lambda i: abs(Decimal(i.figures["deviation_pct"])), reverse=True)
                insights = [i for i in insights if i.kind != "unusual_day"] + unusual[:3]

    # 4. Data quality ------------------------------------------------------------------------
    if now.net and now.costed_net < now.net:
        missing = Decimal(1) - now.costed_net / now.net
        if missing >= Decimal("0.01"):
            insights.append(
                Insight(
                    "missing_costs",
                    "warning",
                    f"Gross profit is partial: items worth {missing * 100:.1f}% of net sales have "
                    "no unit cost. Import product costs to complete it.",
                    {"missing_cost_share": str(quantize(missing, 4))},
                    {"period": period, "fix": "import product_costs"},
                )
            )
    if now.unconverted_lines:
        insights.append(
            Insight(
                "missing_fx",
                "warning",
                f"{now.unconverted_lines} sales lines in "
                f"{', '.join(sorted(now.unconverted_by_currency))} have no exchange rate and are "
                "left out of all totals. Import exchange rates to include them.",
                {"unconverted_lines": now.unconverted_lines},
                {"period": period, "fix": "import fx_rates"},
            )
        )

    # 5. Branch laggard: a branch whose change is far behind the whole -----------------------
    if (scope is None or len(scope) > 1) and prev.lines and net_change is not None:
        rows_now = {
            r["key"]: r
            for r in await engine.sales_breakdown(ctx.session, p_now, "branch", 100, "net")
        }
        rows_prev = {
            r["key"]: r
            for r in await engine.sales_breakdown(ctx.session, p_prev, "branch", 100, "net")
        }
        for key, r in rows_now.items():
            b = rows_prev.get(key, {}).get("net")
            if not b:
                continue
            c = change_pct(r["net"], b)
            if c is not None and net_change - c >= Decimal("0.10"):
                insights.append(
                    Insight(
                        "branch_lagging",
                        "notice",
                        f"{key} moved {_pct(c)} while the whole business moved "
                        f"{_pct(net_change)} ({_money(b, dp, ccy)} → {_money(r['net'], dp, ccy)}).",
                        {
                            "branch": key,
                            "change_pct": str(c),
                            "net_change_pct": str(net_change),
                            "now": str(quantize(r["net"], dp)),
                            "previous": str(quantize(b, dp)),
                        },
                        {"period": period, "previous_period": prev_period},
                    )
                )

    order = {"warning": 0, "notice": 1, "info": 2}
    insights.sort(key=lambda i: order[i.severity])
    return {
        "period": period,
        "previous_period": prev_period,
        "currency": ccy,
        "insights": [asdict(i) for i in insights],
    }


def default_period(today: date) -> tuple[date, date]:
    """Last 30 full days ending yesterday."""
    end = today - timedelta(days=1)
    return end - timedelta(days=29), end
