import type { Holding, RichQuote, FitAssessment, FitVerdict, PlannerInput } from "@/types";

/**
 * Assess whether a given equity is a good fit for the user's existing
 * portfolio + retirement plan. Returns a verdict, a numeric score, the
 * positions already owned, and reason/concern bullets surfaced in the UI.
 *
 * Score is a heuristic in roughly -100..+100 range; it is mapped to a
 * verdict at the end. The factors and weights are intentionally small and
 * tunable rather than a black-box model.
 */
export function assessFit(
  stock: RichQuote,
  holdings: Holding[],
  planner: PlannerInput | null,
): FitAssessment {
  const reasons: string[] = [];
  const concerns: string[] = [];
  let score = 0;

  const totalValue = holdings.reduce((s, h) => s + h.current_value, 0) || 1;

  // 1) Already owned? — surface position info, don't penalise.
  const owned = holdings.filter((h) => h.ticker.toUpperCase() === stock.ticker.toUpperCase());
  const already_owned = owned.map((h) => ({
    portfolio_label: h.portfolio_label ?? h.portfolio ?? "Portfolio",
    shares: h.shares,
    gain_pct: h.gain_pct,
    current_value: h.current_value,
  }));

  // 2) Sector concentration — adding to an over-weighted sector hurts; filling
  // a missing sector helps.
  const sectorTotals: Record<string, number> = {};
  for (const h of holdings) {
    if (h.sector) sectorTotals[h.sector] = (sectorTotals[h.sector] || 0) + h.current_value;
  }
  if (stock.sector) {
    const sectorPct = (sectorTotals[stock.sector] || 0) / totalValue * 100;
    if (sectorPct === 0) {
      reasons.push(`Fills a missing sector — you currently have zero ${stock.sector} exposure`);
      score += 12;
    } else if (sectorPct > 35) {
      concerns.push(`${stock.sector} is already ${sectorPct.toFixed(0)}% of your portfolio — adding more increases concentration risk`);
      score -= 12;
    } else if (sectorPct > 25) {
      concerns.push(`${stock.sector} weight is ${sectorPct.toFixed(0)}% — close to a concentrated position`);
      score -= 4;
    } else {
      reasons.push(`${stock.sector} is a ${sectorPct.toFixed(0)}% slice of your book — room to add`);
      score += 4;
    }
  }

  // 3) Beta vs portfolio + planner aggression
  const betaHoldings = holdings.filter((h) => h.beta != null && h.beta !== 0);
  const portBeta = betaHoldings.length
    ? betaHoldings.reduce((s, h) => s + (h.beta as number) * h.current_value, 0) / totalValue
    : null;

  if (stock.beta != null) {
    if (portBeta != null && stock.beta > portBeta + 0.4) {
      concerns.push(`β=${stock.beta.toFixed(2)} is well above your portfolio's β=${portBeta.toFixed(2)} — would amplify drawdowns`);
      score -= 6;
    } else if (portBeta != null && stock.beta < portBeta - 0.3) {
      reasons.push(`β=${stock.beta.toFixed(2)} dampens overall volatility (portfolio β=${portBeta.toFixed(2)})`);
      score += 5;
    }

    if (planner) {
      const aggressive = planner.aggression_early === "aggressive" || planner.aggression_early === "moderate_aggressive";
      const conservative = planner.aggression_early === "conservative";
      if (conservative && stock.beta > 1.4) {
        concerns.push(`β=${stock.beta.toFixed(2)} conflicts with your "conservative" early-phase strategy`);
        score -= 8;
      }
      if (aggressive && stock.beta > 1.2 && stock.beta < 1.8) {
        reasons.push(`β=${stock.beta.toFixed(2)} aligns with your aggressive early-phase strategy`);
        score += 4;
      }
    }
  }

  // 4) Time horizon: short = avoid speculative high-PE growth; long = OK
  let yearsToRetire: number | null = null;
  if (planner) {
    yearsToRetire = Math.max(0, planner.retirement_age - planner.current_age);
    if (yearsToRetire < 10 && stock.pe_ratio && stock.pe_ratio > 50) {
      concerns.push(`P/E ${stock.pe_ratio.toFixed(0)}x leaves little margin of safety with only ${yearsToRetire} years to retirement`);
      score -= 7;
    }
    if (yearsToRetire < 8 && (stock.dividend_yield ?? 0) > 0.025) {
      reasons.push(`${((stock.dividend_yield ?? 0) * 100).toFixed(1)}% dividend yield supports income as you approach retirement (${yearsToRetire}y away)`);
      score += 6;
    }
    if (yearsToRetire >= 15 && stock.beta != null && stock.beta > 1.0 && stock.beta < 1.5 && (stock.earnings_growth ?? 0) > 0.10) {
      reasons.push(`${yearsToRetire} years to retirement gives time for compounding growth (earnings +${((stock.earnings_growth as number) * 100).toFixed(0)}%)`);
      score += 6;
    }
  }

  // 5) Valuation / target / 52W positioning
  if (stock.target_mean && stock.price > 0) {
    const upside = (stock.target_mean - stock.price) / stock.price * 100;
    if (upside > 15) {
      reasons.push(`Analyst target $${stock.target_mean.toFixed(0)} implies +${upside.toFixed(0)}% upside`);
      score += 6;
    } else if (upside < -10) {
      concerns.push(`Analyst target $${stock.target_mean.toFixed(0)} is ${Math.abs(upside).toFixed(0)}% below current price`);
      score -= 6;
    }
  }
  if (stock.week_52_high && stock.price > 0) {
    const offHighPct = (stock.week_52_high - stock.price) / stock.week_52_high * 100;
    if (offHighPct > 25) {
      reasons.push(`${offHighPct.toFixed(0)}% off 52-week high — potentially attractive entry`);
      score += 4;
    }
  }

  // 6) Quality signals
  if ((stock.profit_margin ?? 0) > 0.20) {
    reasons.push(`${((stock.profit_margin as number) * 100).toFixed(0)}% profit margin signals durable economics`);
    score += 4;
  } else if ((stock.profit_margin ?? 0) < 0) {
    concerns.push(`Negative profit margin — company is currently unprofitable`);
    score -= 5;
  }
  if ((stock.roe ?? 0) > 0.20) {
    reasons.push(`Strong ROE (${((stock.roe as number) * 100).toFixed(0)}%) reflects efficient capital deployment`);
    score += 3;
  }
  if (stock.debt_equity != null && stock.debt_equity > 200) {
    concerns.push(`High debt/equity ratio (${stock.debt_equity.toFixed(0)}) increases balance-sheet risk`);
    score -= 4;
  }

  // 7) Already a meaningful position?
  if (owned.length > 0) {
    const currentValue = owned.reduce((s, h) => s + h.current_value, 0);
    const positionPct = (currentValue / totalValue) * 100;
    if (positionPct > 8) {
      concerns.push(`You already hold a ${positionPct.toFixed(1)}% position — adding more increases single-name concentration`);
      score -= 6;
    } else {
      reasons.push(`Currently a ${positionPct.toFixed(1)}% position — room to scale up`);
      score += 2;
    }
  }

  // Clamp and translate to verdict
  score = Math.max(-100, Math.min(100, score));
  let verdict: FitVerdict;
  if (score >= 25) verdict = "STRONG FIT";
  else if (score >= 8) verdict = "FIT";
  else if (score >= -7) verdict = "NEUTRAL";
  else if (score >= -22) verdict = "POOR FIT";
  else verdict = "AVOID";

  // Summary sentence
  const summary = (() => {
    const parts: string[] = [];
    if (already_owned.length) {
      parts.push(`You already own ${stock.ticker} across ${already_owned.length} portfolio${already_owned.length > 1 ? "s" : ""}.`);
    }
    if (verdict === "STRONG FIT") {
      parts.push(`A strong fit for your portfolio${planner ? " and retirement timeline" : ""}.`);
    } else if (verdict === "FIT") {
      parts.push(`Reasonable fit with the tradeoffs noted.`);
    } else if (verdict === "NEUTRAL") {
      parts.push(`A mixed picture — review the considerations below before adding.`);
    } else if (verdict === "POOR FIT") {
      parts.push(`Conflicts with your current allocation or retirement timeline.`);
    } else {
      parts.push(`Multiple structural concerns make this a poor addition right now.`);
    }
    return parts.join(" ");
  })();

  return {
    verdict,
    score,
    already_owned,
    reasons,
    concerns,
    summary,
  };
}

const PLANNER_STORAGE_KEY = "retirement_planner_input";

export function loadPlannerInput(): PlannerInput | null {
  try {
    const raw = localStorage.getItem(PLANNER_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PlannerInput;
  } catch {
    return null;
  }
}
