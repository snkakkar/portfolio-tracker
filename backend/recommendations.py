"""
Buy/Sell recommendation engine.

Scoring factors (total ~100 pts):
  1. Alpha vs S&P 500 since purchase date        — 35 pts
  2. Price position in 52-week range              — 20 pts
  3. P/E ratio (growth vs value heuristic)        — 15 pts
  4. Momentum — today's % change                  — 10 pts
  5. Beta (risk-adjusted factor)                  — 10 pts
  6. Market cap (liquidity/stability)             —  5 pts
  7. Distance from 52-week high (downside buffer) —  5 pts
"""

from typing import Optional


def score_holding(
    ticker: str,
    gain_pct: float,            # total gain ratio since purchase (decimal, e.g. 0.5 = +50%)
    alpha: float,               # outperformance vs S&P (decimal ratio)
    price: float,
    week_52_high: Optional[float],
    week_52_low: Optional[float],
    pe_ratio: Optional[float],
    beta: Optional[float],
    change_pct: float,          # today's % change
    market_cap: Optional[float] = None,
) -> dict:
    score = 0.0
    reasons: list[str] = []

    # ─── 1. Alpha signal (35 pts max) ─────────────────────────────────────────
    if alpha > 1.5:
        score += 35
        reasons.append(f"Extraordinary alpha: outperformed S&P by {alpha*100:.0f}pp")
    elif alpha > 1.0:
        score += 28
        reasons.append(f"Exceptional alpha vs S&P 500 (+{alpha*100:.0f}pp)")
    elif alpha > 0.5:
        score += 22
        reasons.append(f"Strong alpha vs S&P 500 (+{alpha*100:.0f}pp)")
    elif alpha > 0.15:
        score += 14
        reasons.append(f"Outperforming S&P 500 (+{alpha*100:.0f}pp)")
    elif alpha > 0.0:
        score += 6
        reasons.append("Slightly ahead of S&P 500 benchmark")
    elif alpha > -0.15:
        score -= 5
        reasons.append("Marginally trailing S&P 500")
    elif alpha > -0.35:
        score -= 14
        reasons.append(f"Underperforming S&P 500 by {abs(alpha)*100:.0f}pp")
    elif alpha > -0.6:
        score -= 22
        reasons.append(f"Significantly underperforming S&P 500 ({abs(alpha)*100:.0f}pp behind)")
    else:
        score -= 35
        reasons.append(f"Severely trailing S&P 500 by {abs(alpha)*100:.0f}pp")

    # ─── 2. 52-week price position (20 pts max) ────────────────────────────────
    if week_52_high and week_52_low and week_52_high > week_52_low:
        range_size = week_52_high - week_52_low
        pos = (price - week_52_low) / range_size  # 0 = at low, 1 = at high
        if pos < 0.15:
            score += 20
            reasons.append(f"Deeply oversold — only {pos*100:.0f}% from 52-week low")
        elif pos < 0.30:
            score += 14
            reasons.append(f"Near 52-week low ({pos*100:.0f}% of range) — potential value")
        elif pos < 0.50:
            score += 8
            reasons.append("In lower half of 52-week range")
        elif pos < 0.70:
            score += 2
            reasons.append("Mid 52-week range")
        elif pos < 0.88:
            score -= 6
            reasons.append(f"In upper range ({pos*100:.0f}%) — limited upside near-term")
        else:
            score -= 12
            reasons.append(f"Near 52-week high ({pos*100:.0f}%) — potential overextension")

    # ─── 3. P/E ratio (15 pts max) ────────────────────────────────────────────
    if pe_ratio is not None and pe_ratio > 0:
        if pe_ratio < 12:
            score += 15
            reasons.append(f"Deep value P/E of {pe_ratio:.1f}x — potentially undervalued")
        elif pe_ratio < 20:
            score += 10
            reasons.append(f"Attractive P/E of {pe_ratio:.1f}x relative to market")
        elif pe_ratio < 30:
            score += 5
            reasons.append(f"Reasonable P/E of {pe_ratio:.1f}x — modest growth premium")
        elif pe_ratio < 45:
            score += 0
            reasons.append(f"Elevated P/E of {pe_ratio:.1f}x — priced for strong growth")
        elif pe_ratio < 70:
            score -= 7
            reasons.append(f"High P/E of {pe_ratio:.1f}x — execution risk if growth slows")
        else:
            score -= 12
            reasons.append(f"Very high P/E of {pe_ratio:.1f}x — priced for perfection")
    elif pe_ratio is not None and pe_ratio < 0:
        score -= 5
        reasons.append("Negative earnings — company not yet profitable")

    # ─── 4. Momentum (10 pts max) ─────────────────────────────────────────────
    if change_pct > 5:
        score += 10
        reasons.append(f"Very strong momentum today (+{change_pct:.1f}%)")
    elif change_pct > 2:
        score += 7
        reasons.append(f"Solid positive momentum today (+{change_pct:.1f}%)")
    elif change_pct > 0.5:
        score += 4
        reasons.append(f"Mild positive momentum today (+{change_pct:.1f}%)")
    elif change_pct > -0.5:
        score += 1
        reasons.append("Roughly flat today")
    elif change_pct > -2:
        score -= 4
        reasons.append(f"Pulling back today ({change_pct:.1f}%)")
    elif change_pct > -5:
        score -= 7
        reasons.append(f"Significant sell-off today ({change_pct:.1f}%)")
    else:
        score -= 10
        reasons.append(f"Sharp decline today ({change_pct:.1f}%) — watch for reversal")

    # ─── 5. Beta / volatility (10 pts max) ────────────────────────────────────
    if beta is not None:
        if beta <= 0.5:
            score += 8
            reasons.append(f"Low beta ({beta:.2f}) — defensive, low market correlation")
        elif beta <= 0.8:
            score += 5
            reasons.append(f"Below-market beta ({beta:.2f}) — relatively stable")
        elif beta <= 1.2:
            score += 3
            reasons.append(f"Market-like beta ({beta:.2f}) — moves with the market")
        elif beta <= 1.7:
            score -= 3
            reasons.append(f"Elevated beta ({beta:.2f}) — higher volatility than market")
        elif beta <= 2.5:
            score -= 7
            reasons.append(f"High beta ({beta:.2f}) — significant volatility, higher risk")
        else:
            score -= 10
            reasons.append(f"Very high beta ({beta:.2f}) — extremely volatile")

    # ─── 6. Market cap stability (5 pts max) ──────────────────────────────────
    if market_cap:
        if market_cap > 200e9:
            score += 5
            reasons.append("Mega-cap — high liquidity and institutional backing")
        elif market_cap > 10e9:
            score += 3
            reasons.append("Large/mid-cap — solid liquidity profile")
        elif market_cap > 2e9:
            score += 1
            reasons.append("Mid-cap — moderate liquidity")
        else:
            score -= 4
            reasons.append("Small/micro-cap — limited liquidity, higher risk")

    # ─── 7. Distance-from-52W-high buffer (5 pts max) ─────────────────────────
    if week_52_high and week_52_high > 0:
        gap = (week_52_high - price) / week_52_high  # 0 = at high, 1 = far below
        if gap > 0.30:
            score += 5
            reasons.append(f"Trades {gap*100:.0f}% below 52-week high — room to recover")
        elif gap > 0.15:
            score += 3
            reasons.append(f"Trades {gap*100:.0f}% below 52-week high")
        elif gap < 0.03:
            score -= 2
            reasons.append("At or near 52-week high — limited near-term upside buffer")

    # ─── Map to recommendation ─────────────────────────────────────────────────
    # Score range is roughly -75 to +75; thresholds below calibrated accordingly
    if score >= 55:
        rec   = "STRONG BUY"
        color = "emerald"
    elif score >= 28:
        rec   = "BUY"
        color = "green"
    elif score >= -8:
        rec   = "HOLD"
        color = "amber"
    elif score >= -28:
        rec   = "SELL"
        color = "orange"
    else:
        rec   = "STRONG SELL"
        color = "red"

    return {
        "recommendation": rec,
        "score": round(score, 1),
        "color": color,
        "reasons": reasons,
    }
