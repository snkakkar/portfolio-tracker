"""
Buy/Sell recommendation engine.

Scoring factors (max absolute contribution):
  1. Alpha vs S&P 500 since purchase date   — ±35 pts
  2. Price position in 52-week range         — ±20 pts
  3. P/E ratio (value vs growth heuristic)   — ±15 pts
  4. Momentum — today's % change             — ±10 pts
  5. Beta (volatility / risk)                — ±10 pts
  6. Market cap (liquidity / stability)      —  ±5 pts
  7. Distance from 52-week high (buffer)     —  ±5 pts

  Total possible range: roughly −75 to +75

Score thresholds:
  ≥ 55  →  STRONG BUY
  ≥ 28  →  BUY
  ≥ −8  →  HOLD
  ≥ −28 →  SELL
  < −28 →  STRONG SELL
"""

from typing import Optional

# Tickers that ARE the S&P 500 — alpha comparison and 52W range penalties
# are not meaningful for index trackers.
SP500_TRACKERS = {"VOO", "SPY", "IVV", "SPLG", "VFINX", "FXAIX", "SWPPX"}

# Maximum points each factor can contribute (for normalisation in the UI)
FACTOR_MAX = {
    "Alpha vs S&P 500":        35,
    "52-Week Range Position":  20,
    "P/E Ratio":               15,
    "Today's Momentum":        10,
    "Beta / Volatility":       10,
    "Market Cap":               5,
    "52W High Distance":        5,
}

THRESHOLDS = {
    "STRONG BUY":  55,
    "BUY":         28,
    "HOLD":        -8,
    "SELL":       -28,
    # below -28 → STRONG SELL
}


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
    breakdown: dict[str, dict] = {}   # factor → {points, max, reason}

    is_index_tracker = ticker.upper() in SP500_TRACKERS

    # ─── 1. Alpha signal (±35 pts) ────────────────────────────────────────────
    factor = "Alpha vs S&P 500"
    pts = 0.0
    if is_index_tracker:
        # S&P trackers ARE the benchmark — comparison is N/A
        pts = 0
        reason = "Tracks the S&P 500 — benchmark comparison not applicable"
    elif alpha > 1.5:
        pts = 35
        reason = f"Extraordinary alpha: outperformed S&P by {alpha*100:.0f}pp"
    elif alpha > 1.0:
        pts = 28
        reason = f"Exceptional alpha vs S&P 500 (+{alpha*100:.0f}pp)"
    elif alpha > 0.5:
        pts = 22
        reason = f"Strong alpha vs S&P 500 (+{alpha*100:.0f}pp)"
    elif alpha > 0.15:
        pts = 14
        reason = f"Outperforming S&P 500 (+{alpha*100:.0f}pp)"
    elif alpha >= 0.0:
        pts = 4
        reason = "Roughly in line with or slightly ahead of S&P 500"
    elif alpha > -0.15:
        pts = -5
        reason = "Marginally trailing S&P 500"
    elif alpha > -0.35:
        pts = -14
        reason = f"Underperforming S&P 500 by {abs(alpha)*100:.0f}pp"
    elif alpha > -0.6:
        pts = -22
        reason = f"Significantly underperforming S&P 500 ({abs(alpha)*100:.0f}pp behind)"
    else:
        pts = -35
        reason = f"Severely trailing S&P 500 by {abs(alpha)*100:.0f}pp"
    score += pts
    reasons.append(reason)
    breakdown[factor] = {"points": pts, "max": FACTOR_MAX[factor], "reason": reason}

    # ─── 2. 52-week price position (±20 pts) ──────────────────────────────────
    factor = "52-Week Range Position"
    pts = 0.0
    reason = "52-week range data unavailable"
    if week_52_high and week_52_low and week_52_high > week_52_low:
        range_size = week_52_high - week_52_low
        pos = (price - week_52_low) / range_size
        if is_index_tracker:
            # For index ETFs, being near 52W high reflects market strength — neutral to positive
            if pos >= 0.75:
                pts = 4
                reason = f"Near 52-week high ({pos*100:.0f}%) — index near all-time highs, market strength"
            elif pos >= 0.40:
                pts = 2
                reason = f"Mid-to-upper 52-week range ({pos*100:.0f}%)"
            else:
                pts = -4
                reason = f"In lower portion of 52-week range ({pos*100:.0f}%) — market in pullback"
        else:
            if pos < 0.15:
                pts = 20
                reason = f"Deeply oversold — only {pos*100:.0f}% from 52-week low"
            elif pos < 0.30:
                pts = 14
                reason = f"Near 52-week low ({pos*100:.0f}% of range) — potential value"
            elif pos < 0.50:
                pts = 8
                reason = "In lower half of 52-week range"
            elif pos < 0.70:
                pts = 2
                reason = "Mid 52-week range"
            elif pos < 0.88:
                pts = -6
                reason = f"In upper range ({pos*100:.0f}%) — limited upside near-term"
            else:
                pts = -12
                reason = f"Near 52-week high ({pos*100:.0f}%) — potential overextension"
    score += pts
    reasons.append(reason)
    breakdown[factor] = {"points": pts, "max": FACTOR_MAX[factor], "reason": reason}

    # ─── 3. P/E ratio (±15 pts) ───────────────────────────────────────────────
    factor = "P/E Ratio"
    pts = 0.0
    reason = "P/E ratio data unavailable"
    if pe_ratio is not None and pe_ratio > 0:
        if pe_ratio < 12:
            pts = 15
            reason = f"Deep value P/E of {pe_ratio:.1f}x — potentially undervalued"
        elif pe_ratio < 20:
            pts = 10
            reason = f"Attractive P/E of {pe_ratio:.1f}x relative to market"
        elif pe_ratio < 30:
            pts = 5
            reason = f"Reasonable P/E of {pe_ratio:.1f}x — modest growth premium"
        elif pe_ratio < 45:
            pts = 0
            reason = f"Elevated P/E of {pe_ratio:.1f}x — priced for strong growth"
        elif pe_ratio < 70:
            pts = -7
            reason = f"High P/E of {pe_ratio:.1f}x — execution risk if growth slows"
        else:
            pts = -12
            reason = f"Very high P/E of {pe_ratio:.1f}x — priced for perfection"
    elif pe_ratio is not None and pe_ratio < 0:
        pts = -5
        reason = "Negative earnings — company not yet profitable"
    score += pts
    reasons.append(reason)
    breakdown[factor] = {"points": pts, "max": FACTOR_MAX[factor], "reason": reason}

    # ─── 4. Momentum (±10 pts) ────────────────────────────────────────────────
    factor = "Today's Momentum"
    if change_pct > 5:
        pts = 10
        reason = f"Very strong momentum today (+{change_pct:.1f}%)"
    elif change_pct > 2:
        pts = 7
        reason = f"Solid positive momentum today (+{change_pct:.1f}%)"
    elif change_pct > 0.5:
        pts = 4
        reason = f"Mild positive momentum today (+{change_pct:.1f}%)"
    elif change_pct > -0.5:
        pts = 1
        reason = "Roughly flat today"
    elif change_pct > -2:
        pts = -4
        reason = f"Pulling back today ({change_pct:.1f}%)"
    elif change_pct > -5:
        pts = -7
        reason = f"Significant sell-off today ({change_pct:.1f}%)"
    else:
        pts = -10
        reason = f"Sharp decline today ({change_pct:.1f}%) — watch for reversal"
    score += pts
    reasons.append(reason)
    breakdown[factor] = {"points": pts, "max": FACTOR_MAX[factor], "reason": reason}

    # ─── 5. Beta / volatility (±10 pts) ───────────────────────────────────────
    factor = "Beta / Volatility"
    pts = 0.0
    reason = "Beta data unavailable"
    if beta is not None:
        if beta <= 0.5:
            pts = 8
            reason = f"Low beta ({beta:.2f}) — defensive, low market correlation"
        elif beta <= 0.8:
            pts = 5
            reason = f"Below-market beta ({beta:.2f}) — relatively stable"
        elif beta <= 1.2:
            pts = 3
            reason = f"Market-like beta ({beta:.2f}) — moves with the market"
        elif beta <= 1.7:
            pts = -3
            reason = f"Elevated beta ({beta:.2f}) — higher volatility than market"
        elif beta <= 2.5:
            pts = -7
            reason = f"High beta ({beta:.2f}) — significant volatility, higher risk"
        else:
            pts = -10
            reason = f"Very high beta ({beta:.2f}) — extremely volatile"
    score += pts
    reasons.append(reason)
    breakdown[factor] = {"points": pts, "max": FACTOR_MAX[factor], "reason": reason}

    # ─── 6. Market cap stability (±5 pts) ─────────────────────────────────────
    factor = "Market Cap"
    pts = 0.0
    reason = "Market cap data unavailable"
    if market_cap:
        if market_cap > 200e9:
            pts = 5
            reason = "Mega-cap — high liquidity and institutional backing"
        elif market_cap > 10e9:
            pts = 3
            reason = "Large/mid-cap — solid liquidity profile"
        elif market_cap > 2e9:
            pts = 1
            reason = "Mid-cap — moderate liquidity"
        else:
            pts = -4
            reason = "Small/micro-cap — limited liquidity, higher risk"
    score += pts
    reasons.append(reason)
    breakdown[factor] = {"points": pts, "max": FACTOR_MAX[factor], "reason": reason}

    # ─── 7. Distance-from-52W-high buffer (±5 pts) ────────────────────────────
    factor = "52W High Distance"
    pts = 0.0
    reason = "52-week high data unavailable"
    if week_52_high and week_52_high > 0:
        gap = (week_52_high - price) / week_52_high
        if gap > 0.30:
            pts = 5
            reason = f"Trades {gap*100:.0f}% below 52-week high — room to recover"
        elif gap > 0.15:
            pts = 3
            reason = f"Trades {gap*100:.0f}% below 52-week high"
        elif gap > 0.05:
            pts = 1
            reason = f"Within {gap*100:.0f}% of 52-week high"
        elif gap < 0.03:
            pts = -2
            reason = "At or near 52-week high — limited near-term upside buffer"
        else:
            pts = 0
            reason = f"Near 52-week high ({gap*100:.0f}% below)"
    score += pts
    reasons.append(reason)
    breakdown[factor] = {"points": pts, "max": FACTOR_MAX[factor], "reason": reason}

    # ─── Map to recommendation ─────────────────────────────────────────────────
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

    # Points needed to reach next tier
    next_tier = None
    next_pts_needed = None
    if score < 55:
        tiers = [("STRONG BUY", 55), ("BUY", 28), ("HOLD", -8), ("SELL", -28)]
        for tier_name, threshold in tiers:
            if score < threshold:
                next_tier = tier_name
                next_pts_needed = round(threshold - score, 1)
                break

    return {
        "recommendation": rec,
        "score": round(score, 1),
        "color": color,
        "reasons": reasons,
        "breakdown": breakdown,
        "next_tier": next_tier,
        "next_pts_needed": next_pts_needed,
    }
