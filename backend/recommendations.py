"""
Buy/Sell recommendation engine — long-term, multi-factor perspective.

Designed for investors with multi-year holding horizons, NOT day traders.

Philosophy:
  - No single factor dominates. The COMBINATION tells the story.
  - 52W range is a moderate context signal, not a contrarian trigger:
      Near 52W high is modestly positive (momentum) UNLESS paired with
      extreme P/E and poor alpha, in which case it signals froth.
  - Daily momentum is a minor tiebreaker only (±3 pts max).
  - Alpha vs S&P since purchase remains the primary signal.
  - P/E provides valuation sanity-check for the price trend.

Scoring factors:
  1. Alpha vs S&P 500 since purchase date      — ±35 pts  (primary signal)
  2. 52-week range position + valuation context — ±12 pts  (trend + froth check)
  3. P/E ratio                                  — ±15 pts
  4. Beta / volatility                          — ±10 pts
  5. Today's momentum                           —  ±3 pts  (tiebreaker only)
  6. Market cap / liquidity                     —  ±5 pts
  7. Distance from 52-week high                 —  ±5 pts

Score thresholds (calibrated for realistic distribution):
  ≥ 40  →  STRONG BUY   (excellent across multiple dimensions)
  ≥ 18  →  BUY          (solid fundamentals, positive outlook)
  ≥ −12 →  HOLD         (neutral, no urgent action)
  ≥ −35 →  SELL         (multiple concerning signals)
  < −35 →  STRONG SELL  (clear deterioration across factors)
"""

from typing import Optional

# S&P 500 trackers: alpha comparison and 52W range logic differ for these
SP500_TRACKERS = {"VOO", "SPY", "IVV", "SPLG", "VFINX", "FXAIX", "SWPPX"}

FACTOR_MAX = {
    "Alpha vs S&P 500":        35,
    "52-Week Range Position":  12,
    "P/E Ratio":               15,
    "Beta / Volatility":       10,
    "Today's Momentum":         3,
    "Market Cap":               5,
    "52W High Distance":        5,
}

THRESHOLDS = {
    "STRONG BUY":  40,
    "BUY":         18,
    "HOLD":        -12,
    "SELL":        -35,
    # below -35 → STRONG SELL
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
    breakdown: dict[str, dict] = {}

    is_index_tracker = ticker.upper() in SP500_TRACKERS

    # Compute 52W position once — used by multiple factors
    pos: Optional[float] = None
    if week_52_high and week_52_low and week_52_high > week_52_low:
        pos = (price - week_52_low) / (week_52_high - week_52_low)

    # ── 1. Alpha vs S&P 500 (±35 pts) — primary long-term signal ─────────────
    factor = "Alpha vs S&P 500"
    pts = 0.0
    if is_index_tracker:
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
        reason = "Roughly in line with S&P 500 benchmark"
    elif alpha > -0.10:
        pts = -4
        reason = f"Marginally trailing S&P 500 ({alpha*100:.1f}pp behind)"
    elif alpha > -0.25:
        pts = -10
        reason = f"Underperforming S&P 500 by {abs(alpha)*100:.0f}pp"
    elif alpha > -0.45:
        pts = -20
        reason = f"Significantly underperforming S&P 500 ({abs(alpha)*100:.0f}pp behind)"
    elif alpha > -0.65:
        pts = -28
        reason = f"Severely trailing S&P 500 by {abs(alpha)*100:.0f}pp"
    else:
        pts = -35
        reason = f"Extreme underperformance vs S&P 500 ({abs(alpha)*100:.0f}pp behind)"
    score += pts
    reasons.append(reason)
    breakdown[factor] = {"points": pts, "max": FACTOR_MAX[factor], "reason": reason}

    # ── 2. 52-week range position + froth check (±12 pts) ────────────────────
    # Context-aware: near highs with strong fundamentals = momentum leader.
    # Near highs with poor alpha and extreme P/E = frothy/overextended.
    # Near lows with good alpha = potential value. Near lows with bad alpha = downtrend.
    factor = "52-Week Range Position"
    pts = 0.0
    reason = "52-week range data unavailable"
    if pos is not None:
        pe_extreme = pe_ratio is not None and pe_ratio > 80
        pe_high = pe_ratio is not None and pe_ratio > 45
        pe_reasonable = pe_ratio is not None and pe_ratio < 30

        if is_index_tracker:
            # For index ETFs: being near 52W high = bull market = constructive
            if pos >= 0.75:
                pts = 5
                reason = f"Near 52W high ({pos*100:.0f}%) — index reflecting bull market conditions"
            elif pos >= 0.40:
                pts = 2
                reason = f"Mid-to-upper range ({pos*100:.0f}%) — constructive trend"
            else:
                pts = -5
                reason = f"Lower range ({pos*100:.0f}%) — market in pullback territory"
        elif pos >= 0.88:
            # Near 52W high — check for froth
            if pe_extreme and alpha < 0:
                pts = -8
                reason = (f"Near 52W high ({pos*100:.0f}%) with extreme P/E "
                          f"({pe_ratio:.0f}x) and negative alpha — frothy, not justified by performance")
            elif pe_extreme:
                pts = -3
                reason = (f"Near 52W high ({pos*100:.0f}%) with very high P/E ({pe_ratio:.0f}x) "
                          f"— valuations stretched, momentum exists but risk elevated")
            elif pe_high and alpha < 0.05:
                pts = 1
                reason = (f"Near 52W high ({pos*100:.0f}%) — momentum present "
                          f"but elevated P/E ({pe_ratio:.0f}x) limits conviction")
            else:
                pts = 8
                reason = (f"Strong price momentum at {pos*100:.0f}% of 52W range "
                          f"— market leadership{', valuation reasonable' if pe_reasonable else ''}")
        elif pos >= 0.65:
            pts = 5
            reason = f"Upper 52-week range ({pos*100:.0f}%) — positive price trend"
        elif pos >= 0.40:
            pts = 2
            reason = "Mid 52-week range — neutral to constructive price action"
        elif pos >= 0.20:
            # Lower range — check if alpha redeems it
            if alpha > 0.10:
                pts = 1
                reason = (f"Lower range ({pos*100:.0f}%) but positive alpha — "
                          f"may be sector headwind rather than company-specific weakness")
            else:
                pts = -7
                reason = f"Lower 52-week range ({pos*100:.0f}%) — price under sustained pressure"
        else:
            # Near 52W low
            if alpha > 0.15 and pe_ratio and pe_ratio < 20:
                pts = -2
                reason = (f"Near 52W low ({pos*100:.0f}%) but strong relative performance "
                          f"and low P/E — potential deep value if thesis intact")
            else:
                pts = -12
                reason = (f"Near 52-week low ({pos*100:.0f}%) — significant downtrend, "
                          f"high risk of further decline")
    score += pts
    reasons.append(reason)
    breakdown[factor] = {"points": pts, "max": FACTOR_MAX[factor], "reason": reason}

    # ── 3. P/E ratio (±15 pts) ───────────────────────────────────────────────
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
            pts = -5
            reason = f"High P/E of {pe_ratio:.1f}x — execution risk if growth slows"
        elif pe_ratio < 100:
            pts = -10
            reason = f"Very high P/E of {pe_ratio:.1f}x — priced for perfection"
        else:
            pts = -15
            reason = f"Extreme P/E of {pe_ratio:.1f}x — pure growth bet, limited margin of safety"
    elif pe_ratio is not None and pe_ratio < 0:
        pts = -5
        reason = "Negative earnings — company not yet profitable"
    score += pts
    reasons.append(reason)
    breakdown[factor] = {"points": pts, "max": FACTOR_MAX[factor], "reason": reason}

    # ── 4. Beta / volatility (±10 pts) ───────────────────────────────────────
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
        elif beta <= 1.6:
            pts = -2
            reason = f"Elevated beta ({beta:.2f}) — above-average volatility"
        elif beta <= 2.2:
            pts = -6
            reason = f"High beta ({beta:.2f}) — significant volatility, amplifies drawdowns"
        else:
            pts = -10
            reason = f"Very high beta ({beta:.2f}) — extremely volatile, requires high conviction"
    score += pts
    reasons.append(reason)
    breakdown[factor] = {"points": pts, "max": FACTOR_MAX[factor], "reason": reason}

    # ── 5. Today's momentum (±3 pts) — tiebreaker, not decisive ─────────────
    factor = "Today's Momentum"
    if change_pct > 3:
        pts = 3
        reason = f"Strong positive session today (+{change_pct:.1f}%)"
    elif change_pct > 0.5:
        pts = 1
        reason = f"Positive momentum today (+{change_pct:.1f}%)"
    elif change_pct > -0.5:
        pts = 0
        reason = "Roughly flat today — no directional signal"
    elif change_pct > -3:
        pts = -1
        reason = f"Pulling back today ({change_pct:.1f}%)"
    else:
        pts = -3
        reason = f"Notable decline today ({change_pct:.1f}%) — watch for continuation"
    score += pts
    reasons.append(reason)
    breakdown[factor] = {"points": pts, "max": FACTOR_MAX[factor], "reason": reason}

    # ── 6. Market cap / liquidity (±5 pts) ───────────────────────────────────
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
            reason = "Small/micro-cap — limited liquidity, higher execution risk"
    score += pts
    reasons.append(reason)
    breakdown[factor] = {"points": pts, "max": FACTOR_MAX[factor], "reason": reason}

    # ── 7. Distance from 52W high (±5 pts) ───────────────────────────────────
    factor = "52W High Distance"
    pts = 0.0
    reason = "52-week high data unavailable"
    if week_52_high and week_52_high > 0:
        gap = (week_52_high - price) / week_52_high
        if gap > 0.30:
            pts = 5
            reason = f"Trades {gap*100:.0f}% below 52-week high — meaningful recovery potential"
        elif gap > 0.15:
            pts = 3
            reason = f"Trades {gap*100:.0f}% below 52-week high"
        elif gap > 0.05:
            pts = 1
            reason = f"Within {gap*100:.0f}% of 52-week high"
        elif gap < 0.02:
            pts = -1
            reason = "At or near 52-week high — modest near-term upside buffer"
        else:
            pts = 0
            reason = f"Near 52-week high ({gap*100:.0f}% below)"
    score += pts
    reasons.append(reason)
    breakdown[factor] = {"points": pts, "max": FACTOR_MAX[factor], "reason": reason}

    # ── Map score to recommendation ───────────────────────────────────────────
    if score >= 40:
        rec   = "STRONG BUY"
        color = "emerald"
    elif score >= 18:
        rec   = "BUY"
        color = "green"
    elif score >= -12:
        rec   = "HOLD"
        color = "amber"
    elif score >= -35:
        rec   = "SELL"
        color = "orange"
    else:
        rec   = "STRONG SELL"
        color = "red"

    # Points needed to reach next tier
    next_tier = None
    next_pts_needed = None
    if score < 40:
        tiers = [("STRONG BUY", 40), ("BUY", 18), ("HOLD", -12), ("SELL", -35)]
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
