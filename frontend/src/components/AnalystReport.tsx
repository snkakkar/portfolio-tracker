import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronUp, BarChart2, Target, Zap, Shield,
  Layers, PieChart,
} from "lucide-react";
import { cn, formatCurrency, formatPct, computeAlpha } from "@/lib/utils";
import { loadPlannerInput } from "@/lib/portfolioFit";
import type { Holding, PortfolioSummary } from "@/types";

interface Props {
  holdings: Holding[];
  label: string;
  /**
   * When provided (server-aggregated or recomputed for the active subset), the
   * report uses cumulative $ alpha + value-weighted alpha % as the canonical
   * figures. When omitted, falls back to the local computeAlpha helper.
   */
  summary?: Pick<PortfolioSummary, "cumulative_alpha_dollar" | "weighted_alpha_pct"> | null;
}

// ─── Quantitative grade model ────────────────────────────────────────────────

/**
 * Smoothed-tier scorer: turns sharp numeric thresholds into a piecewise-linear
 * curve so a value sitting 0.3% under a tier's cutoff doesn't lose 100% of its
 * upper-tier credit.
 *
 * `tiers` is an ordered list of (cutoff, points) pairs sorted ascending by
 * cutoff. The function finds where `value` sits relative to those cutoffs and
 * linearly interpolates between adjacent points within ±`band` of any cutoff.
 *
 *   smoothedTier(4.89, [[0, -4], [5, 10], [10, 16], [15, 22]])  → 9.78
 *   smoothedTier(5.50, ...)  → 10  (clean tier — no smoothing needed)
 *
 * Margin (default 0.5) is the half-width of the smoothing band: with a tier
 * cutoff at 5 and band 0.5, values from 4.5..5.5 interpolate between the two
 * adjacent tiers' points; outside that band each tier returns its own points.
 */
function smoothedTier(
  value: number,
  tiers: [number, number][],   // [cutoff, points], sorted ascending by cutoff
  band: number = 0.5,
): number {
  if (tiers.length === 0) return 0;

  // Below the lowest cutoff → use the lowest tier's points (no tier below it).
  if (value < tiers[0][0]) return tiers[0][1];

  // Find the highest tier whose cutoff is ≤ value (the "current" tier).
  // Then check whether value sits within ±band of an adjacent cutoff for blending.
  for (let i = 0; i < tiers.length; i++) {
    const [cutoff, pts] = tiers[i];
    const next = tiers[i + 1];

    if (next && value >= cutoff && value < next[0]) {
      // value is in tier i (between cutoff[i] and cutoff[i+1])
      const distToNext = next[0] - value;
      if (distToNext <= band) {
        // blend toward the next tier — linear over the band, so a value
        // exactly `band` below the next cutoff still earns this tier's points,
        // a value at the cutoff would (in the limit) earn the next tier's,
        // and the in-between gives partial credit.
        const t = (band - distToNext) / band;  // 0 at edge of band, 1 at cutoff
        return pts + (next[1] - pts) * t;
      }
      return pts;
    }
    if (!next && value >= cutoff) {
      // value is in the highest tier — no upper tier to blend toward.
      return pts;
    }
  }
  return tiers[tiers.length - 1][1];
}

interface ReportData {
  score: number;
  grade: string;
  rating: string;
  ratingColor: string;
  gradeColor: string;
  headline: string;
  narrative: string;
  strengths: { icon: React.ElementType; text: string; metric: string }[];
  risks: { icon: React.ElementType; text: string; metric: string }[];
  actions: { priority: "high" | "medium" | "low"; ticker: string | null; action: string; rationale: string }[];
  metrics: { label: string; value: string; color: string }[];
}

function buildReport(
  holdings: Holding[],
  label: string,
  summary: Props["summary"] | undefined,
): ReportData | null {
  if (!holdings.length) return null;

  const totalValue = holdings.reduce((s, h) => s + h.current_value, 0);
  if (totalValue === 0) return null;

  // ── Core metrics ──────────────────────────────────────────────────────────
  // Use server summary when provided (true portfolio-level numbers); otherwise
  // recompute from the active subset so excluded rows drop out cleanly.
  const alpha = summary
    ? { weighted_alpha_pct: summary.weighted_alpha_pct, cumulative_alpha_dollar: summary.cumulative_alpha_dollar }
    : (() => {
        const a = computeAlpha(holdings);
        return { weighted_alpha_pct: a.weighted_alpha_pct, cumulative_alpha_dollar: a.cumulative_alpha_dollar };
      })();
  const avgAlpha = alpha.weighted_alpha_pct;
  const cumAlphaDollar = alpha.cumulative_alpha_dollar;
  const avgGainPct = holdings.reduce((s, h) => s + h.gain_pct, 0) / holdings.length;

  const betaHoldings = holdings.filter((h) => h.beta !== null);
  const weightedBeta = betaHoldings.length
    ? betaHoldings.reduce((s, h) => s + h.beta! * (h.current_value / totalValue), 0)
    : null;

  // Pull retirement profile so beta/equity scoring can be horizon-aware on
  // retirement-tagged portfolios. Brokerage / unlabelled portfolios get the
  // generic curve (no horizon assumption) — we don't presume the user is
  // saving brokerage money for retirement.
  const planner = loadPlannerInput();
  const yearsToRetirement = planner ? Math.max(0, planner.retirement_age - planner.current_age) : null;
  const isRetirementPortfolio = label.toLowerCase().includes("retirement");
  type Horizon = "long" | "mid" | "short" | "generic";
  const horizon: Horizon =
    !planner || !isRetirementPortfolio || yearsToRetirement === null
      ? "generic"
      : yearsToRetirement >= 15 ? "long"
      : yearsToRetirement >= 7  ? "mid"
      :                            "short";

  // Weight-aware win rate: a 0.5% loser shouldn't drag the grade as hard as a
  // 30% loser. Compute both — show count-based to the user (familiar) but use
  // weighted % for scoring.
  const winnersByCount = holdings.filter((h) => h.gain > 0).length;
  const winRate = (winnersByCount / holdings.length) * 100;
  const winnersValuePct =
    holdings.filter((h) => h.gain > 0).reduce((s, h) => s + h.current_value, 0) / totalValue * 100;

  const sortedByWeight = [...holdings].sort((a, b) => b.current_value - a.current_value);
  const top1Pct = (sortedByWeight[0]?.current_value / totalValue) * 100;
  const top3Pct = sortedByWeight.slice(0, 3).reduce((s, h) => s + h.current_value / totalValue * 100, 0);
  const top1 = sortedByWeight[0];
  const top1Ticker = top1?.ticker ?? "";
  const top1Rec = top1?.recommendation;

  // Concentration is only "risk" when the model thinks the top position should
  // shrink. A 30% NVDA position rated STRONG BUY isn't a problem to trim — it's
  // your highest-conviction bet. Use this to weight every concentration-based
  // signal (score, narrative, risks panel, action queue).
  const top1IsConvicted = top1Rec === "STRONG BUY" || top1Rec === "BUY";
  const top1IsSell      = top1Rec === "SELL"       || top1Rec === "STRONG SELL";

  // Top-3 conviction: how much of the top-3 weight is in BUY-rated names?
  // High share = "concentration in conviction"; low share = real concentration risk.
  const top3 = sortedByWeight.slice(0, 3);
  const top3Value = top3.reduce((s, h) => s + h.current_value, 0);
  const top3BuyValue = top3
    .filter((h) => h.recommendation === "STRONG BUY" || h.recommendation === "BUY")
    .reduce((s, h) => s + h.current_value, 0);
  const top3ConvictionPct = top3Value > 0 ? (top3BuyValue / top3Value) * 100 : 0;

  // Sector totals by *value*, not headcount. A "Broad Market" tag (VOO, VTI,
  // QQQ, etc.) is inherently multi-sector — we exclude it from the concentration
  // math so a portfolio anchored in VOO doesn't get penalised as "0 sectors".
  const BROAD_MARKET = "Broad Market";
  const sectorValues: Record<string, number> = {};
  let broadMarketValue = 0;
  holdings.forEach((h) => {
    if (!h.sector) return;
    if (h.sector === BROAD_MARKET) broadMarketValue += h.current_value;
    else sectorValues[h.sector] = (sectorValues[h.sector] || 0) + h.current_value;
  });
  const broadMarketPct = (broadMarketValue / totalValue) * 100;
  // Effective sector count: named sectors + a small "diversified" boost when
  // broad-market exposure is meaningful. Tightened from the original +5/+2
  // because boosting a single VOO holding to "5 sectors" was too generous —
  // a real 5-sector portfolio of single-sector ETFs is genuinely more diversified.
  const namedSectorCount = Object.keys(sectorValues).length;
  const broadMarketBoost = broadMarketPct >= 15 ? 3 : broadMarketPct >= 5 ? 1 : 0;
  const sectorCount = namedSectorCount + broadMarketBoost;
  const topSectorEntry = Object.entries(sectorValues).sort((a, b) => b[1] - a[1])[0];
  const topSector: [string, number] | undefined = topSectorEntry;
  // Top-sector % is computed over the *non-broad-market* slice — broad market
  // doesn't concentrate, so it shouldn't show up as a sector overweight.
  const topSectorPct = topSector ? (topSector[1] / totalValue) * 100 : 0;

  const peHoldings = holdings.filter((h) => h.pe_ratio && h.pe_ratio > 0 && h.pe_ratio < 500);
  // Value-weighted P/E so a tiny holding's earnings multiple doesn't swing the metric.
  const peTotalValue = peHoldings.reduce((s, h) => s + h.current_value, 0);
  const avgPE = peTotalValue > 0
    ? peHoldings.reduce((s, h) => s + h.pe_ratio! * h.current_value, 0) / peTotalValue
    : null;

  // Sort signals by portfolio weight, descending — biggest positions surface first.
  const byWeightDesc = (a: Holding, b: Holding) => b.current_value - a.current_value;
  const sells   = holdings.filter((h) => h.recommendation === "SELL" || h.recommendation === "STRONG SELL").sort(byWeightDesc);
  const strongSells = holdings.filter((h) => h.recommendation === "STRONG SELL").sort(byWeightDesc);
  const buys    = holdings.filter((h) => h.recommendation === "STRONG BUY" || h.recommendation === "BUY").sort(byWeightDesc);
  const strongBuys = holdings.filter((h) => h.recommendation === "STRONG BUY").sort(byWeightDesc);

  // Weight of each signal bucket — what % of capital is exposed.
  const sellsWeightPct       = sells.reduce((s, h) => s + h.current_value, 0) / totalValue * 100;
  const strongSellsWeightPct = strongSells.reduce((s, h) => s + h.current_value, 0) / totalValue * 100;
  const buysWeightPct        = buys.reduce((s, h) => s + h.current_value, 0) / totalValue * 100;
  const strongBuysWeightPct  = strongBuys.reduce((s, h) => s + h.current_value, 0) / totalValue * 100;

  // Near 52W lows (bottom 15% of range), sorted + weighted.
  const nearLows = holdings.filter((h) => {
    if (!h.week_52_low || !h.week_52_high || h.week_52_high <= h.week_52_low) return false;
    const pos = (h.price - h.week_52_low) / (h.week_52_high - h.week_52_low);
    return pos < 0.15;
  }).sort(byWeightDesc);
  const nearLowsWeightPct = nearLows.reduce((s, h) => s + h.current_value, 0) / totalValue * 100;

  // ── Score model ───────────────────────────────────────────────────────────
  // Tier thresholds use a ±0.5 smoothing band (see smoothedTier above) so a
  // value sitting just under a cutoff (e.g. alpha 4.89% vs the 5% threshold)
  // still earns a meaningful share of the upper tier rather than 0.
  let score = 50;

  // Alpha vs S&P (+18 / -22) — asymmetric: max upside requires +20pp+ alpha,
  // max downside hits at -15pp. Tightened from the previous symmetric ±22 so
  // long-hold portfolios can't easily max it out and a serious shortfall stings
  // more than equivalent outperformance.
  score += smoothedTier(avgAlpha, [
    [-Infinity, -22],
    [-15, -16],
    [-5,  -8],
    [0,    2],
    [5,    6],
    [10,  10],
    [15,  14],
    [20,  18],
  ]);

  // Win rate (±12 pts) — value-weighted. 80% in winners is good but not
  // exceptional; max requires 85%+. Intermediate tiers reward 70 vs 80
  // distinctly so high performers separate from merely-decent ones.
  score += smoothedTier(winnersValuePct, [
    [-Infinity, -12],
    [35, -6],
    [50, -2],
    [60,  2],
    [70,  6],
    [80,  9],
    [85, 12],
  ]);

  // Beta — horizon-aware (+5 cap, down from +8). For retirement portfolios with
  // a known horizon we shift the sweet spot; for brokerage / unknown the curve
  // matches the prior generic shape with a tighter cap.
  if (weightedBeta !== null) {
    if (horizon === "long") {
      // 15+ years to draw — high β fine, low β suboptimal (compounding lost).
      score += smoothedTier(weightedBeta, [
        [-Infinity, -5], [0.65, -2], [1.0, 5], [1.5, 5], [1.8, 2], [2.2, -3],
      ], 0.05);
    } else if (horizon === "mid") {
      // 7-14 years — balanced.
      score += smoothedTier(weightedBeta, [
        [-Infinity, -2], [0.65, 0], [0.8, 5], [1.2, 5], [1.5, 0], [1.8, -5], [2.2, -10],
      ], 0.05);
    } else if (horizon === "short") {
      // <7 years — defensive is appropriate, high β actively penalised.
      score += smoothedTier(weightedBeta, [
        [-Infinity, 0], [0.5, 3], [0.5, 5], [0.8, 5], [1.0, -2], [1.2, -5], [1.4, -10],
      ], 0.05);
    } else {
      // Generic / brokerage — no horizon assumption.
      if (weightedBeta >= 0.65 && weightedBeta <= 1.15) {
        score += 5;
      } else if (weightedBeta < 0.65) {
        score += smoothedTier(weightedBeta, [[-Infinity, -3], [0.4, -3], [0.65, 5]], 0.05);
      } else {
        score += smoothedTier(weightedBeta, [[1.15, 5], [1.5, -5], [2.0, -10]], 0.05);
      }
    }
  }

  // Concentration (top1) — conviction-aware, but no longer free in the 25-35%
  // band. A 30% single-name position is real risk regardless of conviction;
  // STRONG BUY only neutralises the penalty, doesn't reward it.
  if (top1Pct < 15)       score += 6;
  else if (top1Pct < 25)  score += 2;
  else if (top1Pct > 50) {
    if (top1Rec === "STRONG BUY")     score -= 6;   // huge bet, model agrees, but still single-name
    else if (top1Rec === "BUY")       score -= 9;
    else if (top1IsSell)              score -= 20;
    else                               score -= 16;
  } else if (top1Pct > 35) {
    if (top1Rec === "STRONG BUY")     score -= 1;   // was +1; conviction sized but still flagged
    else if (top1Rec === "BUY")       score -= 4;
    else if (top1IsSell)              score -= 14;
    else                               score -= 10;
  } else {
    // 25-35% band — used to be 0 for everyone. Now small penalty even for convictions.
    if (top1Rec === "STRONG BUY")     score += 0;
    else if (top1Rec === "BUY")       score -= 1;
    else if (top1IsSell)              score -= 8;
    else                               score -= 3;
  }

  // Sell signals (max -18) — unchanged tiers; we kept this honest already.
  if (sellsWeightPct === 0) {
    score += 4;   // was +8 — noticing the absence of sell signals shouldn't be a giant gift
  } else {
    score += smoothedTier(sellsWeightPct, [
      [0,  0],
      [2, -1],
      [5, -4],
      [12, -9],
      [25, -14],
      [40, -18],
    ]);
  }
  // STRONG SELL extra penalty — used to be free below 10%; now smoothly punishes
  // smaller exposures too.
  score += smoothedTier(strongSellsWeightPct, [[0, 0], [3, -1], [5, -2], [10, -4], [20, -7]]);

  // Buy signals — capped at +2 *combined*. The model produces these signals,
  // so rewarding the portfolio for having them is partly circular; symbolic only.
  const buyReward = Math.min(
    2,
    smoothedTier(strongBuysWeightPct, [[0, 0], [25, 1.5]]) +
    smoothedTier(buysWeightPct,        [[0, 0], [40, 1.0]]),
  );
  score += buyReward;

  // Sector diversity — same shape, same caps. The reduced broad-market boost
  // upstream already keeps this honest for ETF-heavy books.
  if (sectorCount >= 5) {
    score += smoothedTier(40 - topSectorPct, [[-Infinity, 0], [0, 3], [5, 6]]);
  } else if (sectorCount >= 3) {
    score += smoothedTier(50 - topSectorPct, [[-Infinity, -2], [0, 0], [5, 2]]);
  } else if (sectorCount <= 1) {
    score -= 8;
  } else {
    // sectorCount === 2
    score += smoothedTier(topSectorPct, [[0, -2], [60, -5]]);
  }

  // P/E sanity (max -12). Used to cap at -4 — letting an 85x weighted P/E off
  // with a slap on the wrist. New curve takes a real bite once you're at
  // pure-growth multiples.
  if (avgPE !== null) {
    score += smoothedTier(avgPE, [
      [-Infinity, 4],
      [22,  2],
      [30,  0],
      [45, -4],
      [60, -8],
      [80, -12],
    ]);
  }

  score = Math.max(0, Math.min(100, score));

  // ── Grade ─────────────────────────────────────────────────────────────────
  // Compressed top end. Max bonuses now sum to ~32 (down from ~50), so a
  // strong-but-not-flawless portfolio caps near A−/B+. A+ requires deliberate
  // excellence across nearly every factor. Lower grades unchanged so a poor
  // portfolio doesn't get a free lift.
  const gradeMap: [number, string, string, string, string][] = [
    [92, "A+", "text-emerald-400", "STRONG OVERWEIGHT", "text-emerald-400"],
    [87, "A",  "text-emerald-400", "STRONG OVERWEIGHT", "text-emerald-400"],
    [81, "A−", "text-green-400",   "OVERWEIGHT",        "text-green-400"],
    [73, "B+", "text-green-400",   "OVERWEIGHT",        "text-green-400"],
    [60, "B",  "text-sky-400",     "OVERWEIGHT",        "text-sky-400"],
    [53, "B−", "text-sky-400",     "MARKET WEIGHT",     "text-sky-400"],
    [47, "C+", "text-amber-400",   "MARKET WEIGHT",     "text-amber-400"],
    [41, "C",  "text-amber-400",   "UNDERWEIGHT",       "text-amber-400"],
    [35, "C−", "text-orange-400",  "UNDERWEIGHT",       "text-orange-400"],
    [29, "D+", "text-orange-400",  "UNDERWEIGHT",       "text-orange-400"],
    [22, "D",  "text-red-400",     "STRONG UNDERWEIGHT","text-red-400"],
    [0,  "F",  "text-red-400",     "STRONG UNDERWEIGHT","text-red-400"],
  ];
  const [, grade, gradeColor, rating, ratingColor] =
    gradeMap.find(([min]) => score >= min)!;

  // ── Narrative headline ────────────────────────────────────────────────────
  const alphaVerb = avgAlpha > 5 ? "strong" : avgAlpha > 0 ? "modest" : avgAlpha < -5 ? "significant negative" : "neutral";
  // Concentration framing depends on the top position's signal: a 40%
  // STRONG BUY is "high-conviction sizing", not "dangerously concentrated".
  const concVerb  =
    top1Pct > 40
      ? (top1IsConvicted ? "high-conviction sized" : "dangerously concentrated")
      : top3Pct > 60
        ? (top3ConvictionPct >= 60 ? "concentrated in conviction names" : "top-heavy")
        : "reasonably balanced";
  const betaAdj   = weightedBeta === null ? "" : weightedBeta > 1.4 ? "high-beta" : weightedBeta < 0.8 ? "low-beta" : "balanced-beta";

  const positives = [
    avgAlpha > 5  && `${alphaVerb} alpha generation (+${avgAlpha.toFixed(1)}% vs S&P)`,
    winnersValuePct > 70 && `${winnersValuePct.toFixed(0)}% of capital in winners`,
    sellsWeightPct < 2 && "negligible exposure to sell-signaled names",
    sectorCount >= 4 && topSectorPct < 50 && `${sectorCount}-sector diversification`,
    // Convicted concentration *is* a strength, not a risk.
    top1Pct > 30 && top1Rec === "STRONG BUY" && `high-conviction ${top1Ticker} sizing (${top1Pct.toFixed(0)}%, STRONG BUY)`,
  ].filter(Boolean).slice(0, 2).join(" and ");

  const negatives = [
    sellsWeightPct >= 12 && `${sellsWeightPct.toFixed(0)}% of capital in sell-signaled positions`,
    // Only call concentration a "risk" when the model isn't already telling
    // you to keep the position. A 40% NVDA at STRONG BUY is not a risk to flag.
    top1Pct > 35 && !top1IsConvicted && `concentration risk in ${top1Ticker} (${top1Pct.toFixed(0)}%, ${top1Rec})`,
    avgAlpha < -3      && `portfolio lagging S&P by ${Math.abs(avgAlpha).toFixed(1)}%`,
    topSectorPct > 55  && `${topSector?.[0]} concentration at ${topSectorPct.toFixed(0)}% of book`,
    weightedBeta && weightedBeta > 1.5 && `above-market beta of ${weightedBeta.toFixed(2)}`,
  ].filter(Boolean).slice(0, 2).join("; ");

  const headline =
    score >= 70
      ? `${label} demonstrates ${positives || "solid fundamentals"} — rated ${rating}`
      : score >= 54
      ? `${label} is ${concVerb} with ${positives || "mixed signals"} — key risks require attention`
      : `${label} requires structural attention: ${negatives || "multiple risk factors present"}`;

  const narrative = buildNarrative(
    score, avgAlpha, cumAlphaDollar, winRate, winnersValuePct, top1Pct, top3Pct, top1Ticker, top1Rec,
    sectorCount, topSectorPct, topSector?.[0],
    sells, sellsWeightPct, buys, buysWeightPct,
    weightedBeta, avgPE, holdings.length, label
  );

  // ── Strengths ─────────────────────────────────────────────────────────────
  const strengths: ReportData["strengths"] = [];

  if (avgAlpha > 3) strengths.push({
    icon: TrendingUp,
    text: `Generating ${avgAlpha > 10 ? "exceptional" : "meaningful"} alpha vs S&P 500`,
    metric: `${formatCurrency(cumAlphaDollar)} cumulative · +${avgAlpha.toFixed(1)}% weighted`,
  });
  if (winnersValuePct > 60) strengths.push({
    icon: CheckCircle2,
    text: `${winnersValuePct > 80 ? "High" : "Solid"} winning weight — most capital is in profitable positions`,
    metric: `${winnersValuePct.toFixed(0)}% of value in the green (${winRate.toFixed(0)}% of positions)`,
  });
  if (weightedBeta !== null && weightedBeta < 1.0 && weightedBeta > 0.5) strengths.push({
    icon: Shield,
    text: "Below-market beta — favorable risk-adjusted return profile",
    metric: `β = ${weightedBeta.toFixed(2)} (market is 1.0)`,
  });
  if (sellsWeightPct < 2) strengths.push({
    icon: Target,
    text: sellsWeightPct === 0
      ? "All positions carry neutral-to-positive signals"
      : "Sell-signaled exposure is negligible",
    metric: `${buysWeightPct.toFixed(0)}% capital BUY · ${(100 - buysWeightPct - sellsWeightPct).toFixed(0)}% HOLD · ${sellsWeightPct.toFixed(1)}% SELL`,
  });
  if (sectorCount >= 4 && topSectorPct < 50) strengths.push({
    icon: PieChart,
    text: `Well-diversified across ${sectorCount} sectors`,
    metric: `Top sector ${topSector?.[0] ?? ""} only ${topSectorPct.toFixed(0)}% of book`,
  });
  if (strongBuysWeightPct >= 20) strengths.push({
    icon: Zap,
    text: `${strongBuysWeightPct.toFixed(0)}% of capital in STRONG BUY-rated names`,
    metric: strongBuys.slice(0, 3).map((h) => `${h.ticker} (${(h.current_value / totalValue * 100).toFixed(0)}%)`).join(", "),
  });
  // Outsized top position with STRONG BUY conviction surfaces as a strength,
  // but plain BUY does not — we want to acknowledge real conviction sizing
  // without rewarding every overweight as "high-conviction".
  if (top1Pct >= 25 && top1Rec === "STRONG BUY") strengths.push({
    icon: Target,
    text: `High-conviction sizing in ${top1Ticker}`,
    metric: `${top1Pct.toFixed(0)}% of book · STRONG BUY — model agrees, but single-name risk remains real`,
  });
  if (avgPE !== null && avgPE < 22) strengths.push({
    icon: BarChart2,
    text: "Portfolio trading at an attractive valuation",
    metric: `Avg P/E ${avgPE.toFixed(1)}x — below historical norms`,
  });
  if (avgGainPct > 20) strengths.push({
    icon: TrendingUp,
    text: "Strong absolute return since inception",
    metric: `Avg position up ${avgGainPct.toFixed(1)}%`,
  });

  // ── Risks ─────────────────────────────────────────────────────────────────
  const risks: ReportData["risks"] = [];

  // Concentration only counts as a *risk* when the position isn't backed by
  // model conviction. A STRONG BUY-rated 40% position is high-conviction
  // sizing (handled in strengths above). A BUY-rated outsized position is
  // surfaced only as a soft caution. SELL/HOLD outsized positions remain a
  // proper risk.
  if (top1Pct > 30 && !top1IsConvicted) risks.push({
    icon: Layers,
    text: `Concentration risk — ${top1Ticker} represents outsized portfolio weight`,
    metric: `${top1Pct.toFixed(0)}% in single position (rated ${top1Rec}, top 3 = ${top3Pct.toFixed(0)}%)`,
  });
  else if (top1Pct > 45 && top1Rec === "BUY") risks.push({
    icon: Layers,
    text: `${top1Ticker} is heavily sized — even with a BUY signal, single-name risk is real`,
    metric: `${top1Pct.toFixed(0)}% concentration · a 25% drawdown costs the book ~${(top1Pct * 0.25).toFixed(0)}%`,
  });
  // Only surface a sell-signal *risk* when the exposure is material (≥3% of
  // book) — otherwise it's noise that drags the analyst grade unfairly.
  if (sellsWeightPct >= 3) risks.push({
    icon: TrendingDown,
    text: sellsWeightPct >= 12
      ? `Material sell-signal exposure — ${sellsWeightPct.toFixed(0)}% of capital flagged`
      : `${sellsWeightPct.toFixed(0)}% of capital sits in sell-signaled positions`,
    metric: sells.slice(0, 3).map((h) => `${h.ticker} ${(h.current_value / totalValue * 100).toFixed(0)}% (${h.recommendation})`).join(", "),
  });
  if (avgAlpha < 0) risks.push({
    icon: AlertTriangle,
    text: "Portfolio underperforming S&P 500 on a risk-adjusted basis",
    metric: `${formatCurrency(cumAlphaDollar)} cumulative · ${avgAlpha.toFixed(1)}% weighted vs benchmark`,
  });
  if (sectorCount <= 2 || topSectorPct > 60) risks.push({
    icon: PieChart,
    text: topSectorPct > 60
      ? `Heavy sector concentration in ${topSector?.[0] ?? "one sector"}`
      : "Limited sector diversification — idiosyncratic risk elevated",
    metric: sectorCount <= 1
      ? `100% in ${topSector?.[0] ?? "one sector"} — no buffer against sector downturns`
      : `${topSector?.[0] ?? "Top sector"} = ${topSectorPct.toFixed(0)}% of book across ${sectorCount} sectors`,
  });
  if (weightedBeta !== null && weightedBeta > 1.4) risks.push({
    icon: AlertTriangle,
    text: horizon === "long"
      ? "High beta — appropriate for the long horizon, but watch position sizing"
      : "Above-market beta — portfolio amplifies market drawdowns",
    metric: `β = ${weightedBeta.toFixed(2)} — ${((weightedBeta - 1) * 100).toFixed(0)}% more volatile than S&P${horizon === "short" ? " (your <7-year horizon makes this acute)" : ""}`,
  });
  // Horizon mismatch (retirement portfolios with planner profile only): the
  // portfolio's risk posture conflicts with the time-to-draw. We surface this
  // even when β is in a "neutral" zone overall, because the combination of
  // β and horizon is what matters.
  if (horizon === "long" && weightedBeta !== null && weightedBeta < 0.7 && yearsToRetirement !== null) {
    risks.push({
      icon: AlertTriangle,
      text: `Portfolio is too defensive for a ${yearsToRetirement}-year horizon`,
      metric: `β = ${weightedBeta.toFixed(2)} — at this distance from retirement, more equity risk would compound meaningfully more wealth`,
    });
  } else if (horizon === "short" && weightedBeta !== null && weightedBeta > 1.1 && yearsToRetirement !== null) {
    risks.push({
      icon: AlertTriangle,
      text: `Portfolio risk is too high with only ${yearsToRetirement} years to retirement`,
      metric: `β = ${weightedBeta.toFixed(2)} — a 30% market correction translates to ~${(weightedBeta * 30).toFixed(0)}% drawdown with limited time to recover`,
    });
  }
  // Only flag the 52W-low risk when a meaningful slice of capital is involved.
  if (nearLowsWeightPct >= 5) risks.push({
    icon: TrendingDown,
    text: `${nearLowsWeightPct.toFixed(0)}% of capital sits near 52-week lows`,
    metric: nearLows.slice(0, 3).map((h) => `${h.ticker} ${(h.current_value / totalValue * 100).toFixed(0)}%`).join(", ") + " — downtrend risk",
  });
  if (winnersValuePct < 50) risks.push({
    icon: TrendingDown,
    text: "Most capital sits in losing positions",
    metric: `${(100 - winnersValuePct).toFixed(0)}% of value in losers (${winnersByCount} of ${holdings.length} positions losing)`,
  });
  if (avgPE !== null && avgPE > 45) risks.push({
    icon: BarChart2,
    text: avgPE > 80
      ? "Portfolio carrying extreme valuation risk — pure-growth multiples"
      : avgPE > 60
        ? "Portfolio carrying high valuation risk"
        : "Portfolio carrying elevated valuation risk",
    metric: `Weighted P/E ${avgPE.toFixed(1)}x — vulnerable to multiple compression on any earnings disappointment`,
  });
  // (Heavy-sector risk now handled in the combined check above — no duplicate.)

  // ── Priority actions ──────────────────────────────────────────────────────
  const actions: ReportData["actions"] = [];

  // Address sell signals first — but only those that are actually material to
  // the portfolio. Tiny positions with sell ratings get a single low-priority
  // catch-all action instead of cluttering the high-priority queue.
  const materialSells = sells.filter((h) => (h.current_value / totalValue) >= 0.02); // ≥2% of book
  for (const h of materialSells.slice(0, 2)) {
    const wPct = (h.current_value / totalValue) * 100;
    actions.push({
      priority: wPct >= 8 ? "high" : "medium",
      ticker: h.ticker,
      action: h.recommendation === "STRONG SELL" ? `Exit ${h.ticker} position` : `Reduce or exit ${h.ticker}`,
      rationale: `${wPct.toFixed(1)}% of portfolio · ${h.rec_reasons[0] ?? `rated ${h.recommendation}`}`,
    });
  }
  const trivialSellCount = sells.length - materialSells.length;
  if (trivialSellCount > 0 && materialSells.length === 0) {
    actions.push({
      priority: "low",
      ticker: null,
      action: `Review ${trivialSellCount} small sell-signaled position${trivialSellCount > 1 ? "s" : ""}`,
      rationale: `Each is <2% of the book — no urgency, but worth deciding to either exit or upsize away from`,
    });
  }

  // Address concentration — but only when the model isn't already telling
  // you to *hold* the position. "Trim your STRONG BUY" is bad advice; we
  // either skip the action or downgrade it to a "consider trimming if it
  // grows further" reminder.
  if (top1Pct > 35 && !sells.find((h) => h.ticker === top1Ticker)) {
    if (top1Rec === "STRONG BUY") {
      // Model agrees with the size — only nudge if the position is truly enormous
      if (top1Pct > 55) {
        actions.push({
          priority: "low",
          ticker: top1Ticker,
          action: `Set a trailing stop on ${top1Ticker} rather than trim`,
          rationale: `At ${top1Pct.toFixed(0)}% of book and rated STRONG BUY, the model's still bullish. Trailing stops protect against giving back gains without forcing you to sell into strength.`,
        });
      }
    } else if (top1Rec === "BUY") {
      actions.push({
        priority: "medium",
        ticker: top1Ticker,
        action: `Consider partial trim of ${top1Ticker} if it grows further`,
        rationale: `${top1Pct.toFixed(0)}% concentration with a BUY (not STRONG BUY) signal — keep most of it, but a 20% drawdown costs the book ~${(top1Pct * 0.2).toFixed(0)}%, so don't let it grow unchecked.`,
      });
    } else {
      actions.push({
        priority: "high",
        ticker: top1Ticker,
        action: `Trim ${top1Ticker} to reduce concentration`,
        rationale: `${top1Pct.toFixed(0)}% of portfolio, rated ${top1Rec ?? "HOLD"} — a 20% drawdown alone would drop the overall portfolio by ${(top1Pct * 0.2).toFixed(0)}%, and the model isn't asking you to keep it.`,
      });
    }
  }

  // Diversification
  if (sectorCount <= 2) {
    actions.push({
      priority: "medium",
      ticker: null,
      action: "Add cross-sector exposure to reduce idiosyncratic risk",
      rationale: `Consider Healthcare (XLV), Consumer Staples (XLP), or Utilities (XLU) to buffer against ${topSector?.[0] ?? "sector"} volatility`,
    });
  }

  // Near 52W lows review — only flag when meaningful capital is involved.
  if (nearLowsWeightPct >= 5) {
    const top2 = nearLows.slice(0, 2).map((h) => `${h.ticker} (${(h.current_value / totalValue * 100).toFixed(0)}%)`).join(", ");
    actions.push({
      priority: nearLowsWeightPct >= 15 ? "high" : "medium",
      ticker: null,
      action: `Review thesis on ${top2} near 52W lows`,
      rationale: `${nearLowsWeightPct.toFixed(0)}% of capital exposed — determine whether the downtrend reflects deteriorating fundamentals or a tactical entry opportunity`,
    });
  }

  // Add high-conviction buys
  if (strongBuys.length === 0 && buys.length < 2) {
    actions.push({
      priority: "medium",
      ticker: null,
      action: "Source new BUY-rated positions via the Stock Discovery tab",
      rationale: "Low conviction across current holdings — adding high-alpha candidates would improve expected return",
    });
  }

  // Beta management
  if (weightedBeta !== null && weightedBeta > 1.5) {
    actions.push({
      priority: "medium",
      ticker: null,
      action: "Hedge or reduce high-beta exposure ahead of volatile periods",
      rationale: `Portfolio beta of ${weightedBeta.toFixed(2)} means a 10% market correction translates to ~${(weightedBeta * 10).toFixed(0)}% portfolio loss`,
    });
  }

  // Add a defensive note if the portfolio is strong
  if (score >= 70 && actions.length < 2) {
    actions.push({
      priority: "low",
      ticker: null,
      action: "Maintain current positioning — consider adding trailing stop-losses",
      rationale: "Portfolio is performing well. Protect gains with defined exit levels on top positions to avoid giving back alpha",
    });
  }

  // Limit to 4 actions
  const finalActions = actions.slice(0, 4);

  // ── Quick metrics strip ───────────────────────────────────────────────────
  const metrics: ReportData["metrics"] = [
    {
      label: "Cumulative Alpha",
      value: formatCurrency(cumAlphaDollar),
      color: cumAlphaDollar > 0 ? "text-green-400" : "text-red-400",
    },
    {
      label: "Weighted Alpha %",
      value: formatPct(avgAlpha),
      color: avgAlpha > 0 ? "text-green-400" : "text-red-400",
    },
    {
      label: "Capital in Winners",
      value: `${winnersValuePct.toFixed(0)}%`,
      color: winnersValuePct > 70 ? "text-green-400" : winnersValuePct < 50 ? "text-red-400" : "text-amber-400",
    },
    {
      label: "Portfolio β",
      value: weightedBeta !== null ? weightedBeta.toFixed(2) : "N/A",
      color: weightedBeta !== null && weightedBeta > 1.5 ? "text-orange-400" : "text-slate-300",
    },
    {
      label: "Signal Weight",
      value: `${buysWeightPct.toFixed(0)}%B / ${(100 - buysWeightPct - sellsWeightPct).toFixed(0)}%H / ${sellsWeightPct.toFixed(0)}%S`,
      color: sellsWeightPct >= 12 ? "text-orange-400" : sellsWeightPct >= 5 ? "text-amber-400" : "text-slate-300",
    },
    {
      label: "Sector Diversity",
      value: `${sectorCount} sector${sectorCount !== 1 ? "s" : ""}`,
      color: sectorCount >= 4 ? "text-green-400" : sectorCount <= 1 ? "text-red-400" : "text-amber-400",
    },
  ];
  if (avgPE !== null) {
    metrics.push({
      label: "Avg P/E",
      value: `${avgPE.toFixed(1)}x`,
      color: avgPE > 45 ? "text-orange-400" : avgPE < 22 ? "text-green-400" : "text-slate-300",
    });
  }

  return {
    score, grade, gradeColor, rating, ratingColor,
    headline, narrative,
    strengths: strengths.slice(0, 4),
    risks: risks.slice(0, 4),
    actions: finalActions,
    metrics,
  };
}

function buildNarrative(
  score: number,
  avgAlpha: number, cumAlphaDollar: number,
  winRate: number, winnersValuePct: number,
  top1Pct: number, top3Pct: number, top1Ticker: string, top1Rec: string | undefined,
  sectorCount: number, topSectorPct: number, topSectorName: string | undefined,
  sells: Holding[], sellsWeightPct: number,
  buys: Holding[], buysWeightPct: number,
  beta: number | null, avgPE: number | null, n: number, label: string
): string {
  const parts: string[] = [];
  const cumAbs = formatCurrency(Math.abs(cumAlphaDollar));
  const sellCount = sells.length;
  const top1IsConvicted = top1Rec === "STRONG BUY" || top1Rec === "BUY";

  // Alpha sentence — cumulative dollars (real money) + value-weighted % (relative)
  if (avgAlpha > 10)
    parts.push(`This portfolio is a strong alpha generator, beating an S&P-equivalent allocation by ${cumAbs} cumulatively (${avgAlpha.toFixed(1)}% value-weighted) — a rare achievement that suggests genuine stock-picking skill or favorable sector timing.`);
  else if (avgAlpha > 3)
    parts.push(`The portfolio delivers ${cumAbs} of cumulative alpha (${avgAlpha.toFixed(1)}% value-weighted) above the S&P 500 — a respectable outperformance that reflects sound position selection.`);
  else if (avgAlpha > 0)
    parts.push(`The portfolio is marginally ahead of its S&P 500 benchmark (+${cumAbs} cumulative, +${avgAlpha.toFixed(1)}% value-weighted), though the margin of outperformance is narrow and warrants continued monitoring.`);
  else
    parts.push(`The portfolio is currently behind its S&P 500 benchmark by ${cumAbs} cumulatively (${Math.abs(avgAlpha).toFixed(1)}% value-weighted) — a meaningful drag that compounds over time if left unaddressed.`);

  // Win rate + concentration sentence — uses *capital-weighted* winners %
  // and frames concentration as either "high-conviction sizing" (when the
  // top position has a BUY/STRONG BUY signal) or "concentration risk".
  if (winnersValuePct > 75 && top1Pct <= 30)
    parts.push(`${winnersValuePct.toFixed(0)}% of capital sits in profitable positions across ${n} holdings, combined with a balanced allocation structure — a durable return profile.`);
  else if (winnersValuePct > 65 && top1Pct > 35) {
    if (top1IsConvicted)
      parts.push(`${winnersValuePct.toFixed(0)}% of capital is in winners, anchored by a high-conviction ${top1Pct.toFixed(0)}% position in ${top1Ticker} (rated ${top1Rec}). The model agrees with the size, but single-name risk still warrants a stop-loss discipline rather than a trim.`);
    else
      parts.push(`${winnersValuePct.toFixed(0)}% of capital is in winners, but concentration risk runs alongside it — ${top1Ticker} alone represents ${top1Pct.toFixed(0)}% of the portfolio (rated ${top1Rec ?? "HOLD"}), so a single adverse move carries portfolio-level consequences.`);
  }
  else if (winnersValuePct < 50)
    parts.push(`Only ${winnersValuePct.toFixed(0)}% of capital sits in profitable positions — the bulk of the book is in the red and the selection process needs recalibration.`);

  // Sell signals — frame by capital, not count, and skip trivial exposure.
  if (sellsWeightPct >= 15)
    parts.push(`Most urgently, ${sellsWeightPct.toFixed(0)}% of capital is in sell-signaled positions${sells[0] ? ` (largest: ${sells[0].ticker} at ${(sells[0].current_value / sells.reduce((s, h) => s + h.current_value, 0) * sellsWeightPct).toFixed(0)}% of book)` : ""} — at this exposure, selective exits are essential before further capital erosion.`);
  else if (sellsWeightPct >= 5)
    parts.push(`${sellsWeightPct.toFixed(0)}% of capital sits in sell-signaled positions and should be reviewed for exit or significant reduction.`);
  else if (sellCount >= 1 && sellsWeightPct < 2)
    parts.push(`A handful of small positions carry sell signals, but together they're under 2% of the book — more of a housekeeping item than a structural concern.`);

  // Risk posture
  if (beta !== null) {
    if (beta > 1.6)
      parts.push(`The portfolio's beta of ${beta.toFixed(2)} means it amplifies both market gains and market corrections — a double-edged characteristic that demands rigorous downside discipline.`);
    else if (beta < 0.75)
      parts.push(`Below-market beta (${beta.toFixed(2)}) provides downside cushion but may limit upside participation in strong bull markets.`);
  }

  // Valuation
  if (avgPE !== null && avgPE > 40)
    parts.push(`The portfolio trades at an elevated average P/E of ${avgPE.toFixed(1)}x, leaving limited margin of safety against earnings disappointments or rising rates.`);
  else if (avgPE !== null && avgPE < 20)
    parts.push(`An average P/E of ${avgPE.toFixed(1)}x represents an attractive entry valuation with meaningful upside optionality.`);

  // Closing conviction statement
  if (score >= 76)
    parts.push(`Overall, this is a high-conviction, well-managed book. Priority focus: protect the gains with disciplined stop-losses and guard against complacency.`);
  else if (score >= 60)
    parts.push(`This is a respectable portfolio with identifiable improvement levers. Addressing the concentration and signal concerns outlined below should move the grade meaningfully higher.`);
  else
    parts.push(`Structural improvements are needed to bring this portfolio in line with institutional-grade standards. The action items below represent the most impactful levers.`);

  return parts.join(" ");
}

// ─── Component ───────────────────────────────────────────────────────────────

const PRIORITY_STYLES = {
  high:   { bg: "bg-red-500/10 border-red-500/20",    label: "bg-red-500/20 text-red-400",    dot: "bg-red-400"    },
  medium: { bg: "bg-amber-500/10 border-amber-500/20", label: "bg-amber-500/20 text-amber-400", dot: "bg-amber-400" },
  low:    { bg: "bg-sky-500/10 border-sky-500/20",     label: "bg-sky-500/20 text-sky-400",     dot: "bg-sky-400"   },
};

export function AnalystReport({ holdings, label, summary }: Props) {
  const [expanded, setExpanded] = useState(false);
  const report = useMemo(() => buildReport(holdings, label, summary), [holdings, label, summary]);

  if (!report) return null;

  const now = new Date();
  const timestamp = now.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#090f1e] via-[#0b1220] to-[#07101d]"
    >
      {/* Subtle accent gradient top-left */}
      <div
        className="absolute top-0 left-0 w-72 h-32 opacity-20 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 0% 0%, #3b82f6 0%, transparent 70%)" }}
      />

      {/* ── Header row ────────────────────────────────────────────────────── */}
      <div className="relative flex items-start justify-between gap-4 px-6 py-5">
        <div className="flex items-start gap-5 min-w-0">
          {/* Grade circle */}
          <div className="shrink-0 flex flex-col items-center">
            <div className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center border-2",
              "bg-white/[0.04]",
              report.score >= 70 ? "border-green-500/40" :
              report.score >= 54 ? "border-amber-500/40" : "border-red-500/40"
            )}>
              <span className={cn("text-3xl font-black tracking-tight", report.gradeColor)}>
                {report.grade}
              </span>
            </div>
            <span className={cn(
              "mt-1.5 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border",
              report.score >= 70 ? "text-green-400 border-green-500/30 bg-green-500/10" :
              report.score >= 54 ? "text-amber-400 border-amber-500/30 bg-amber-500/10" :
                                   "text-red-400 border-red-500/30 bg-red-500/10"
            )}>
              {report.rating}
            </span>
          </div>

          {/* Headline + narrative */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.15em]">
                Analyst Report
              </span>
              <span className="text-[10px] text-slate-700">·</span>
              <span className="text-[10px] text-slate-600">{timestamp}</span>
              <span className="text-[10px] text-slate-700">·</span>
              <span className="text-[10px] text-slate-600">Quantitative risk model · 7 factors</span>
            </div>
            <p className="text-sm font-semibold text-white leading-snug mb-2">
              {report.headline}
            </p>
            <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
              {report.narrative}
            </p>
          </div>
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="shrink-0 flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-200 transition-colors mt-1"
        >
          {expanded ? (
            <><ChevronUp className="w-4 h-4" /> Collapse</>
          ) : (
            <><ChevronDown className="w-4 h-4" /> Full analysis</>
          )}
        </button>
      </div>

      {/* ── Metrics strip ─────────────────────────────────────────────────── */}
      <div className="relative flex flex-wrap gap-0 border-t border-white/[0.05]">
        {report.metrics.map((m, i) => (
          <div
            key={m.label}
            className={cn(
              "flex items-center gap-3 px-5 py-2.5 border-r border-white/[0.05]",
              i === report.metrics.length - 1 && "border-r-0"
            )}
          >
            <span className="text-[10px] text-slate-600 uppercase tracking-wider whitespace-nowrap">{m.label}</span>
            <span className={cn("text-xs font-bold font-mono", m.color)}>{m.value}</span>
          </div>
        ))}
      </div>

      {/* ── Expanded section ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/[0.05] grid grid-cols-1 lg:grid-cols-3 gap-0">
              {/* Strengths */}
              <div className="p-5 border-r border-white/[0.05]">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-5 h-5 rounded bg-green-500/10 flex items-center justify-center">
                    <CheckCircle2 className="w-3 h-3 text-green-400" />
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-green-500">
                    Strengths ({report.strengths.length})
                  </p>
                </div>
                <div className="space-y-3">
                  {report.strengths.length === 0 ? (
                    <p className="text-xs text-slate-600 italic">No standout strengths identified at this time.</p>
                  ) : report.strengths.map((s, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded bg-green-500/10 flex items-center justify-center shrink-0 mt-0.5">
                        <s.icon className="w-2.5 h-2.5 text-green-400" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-300 leading-snug">{s.text}</p>
                        <p className="text-[10px] text-green-500/80 mt-0.5 font-mono">{s.metric}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Risks */}
              <div className="p-5 border-r border-white/[0.05]">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-5 h-5 rounded bg-red-500/10 flex items-center justify-center">
                    <AlertTriangle className="w-3 h-3 text-red-400" />
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-red-400">
                    Risk Factors ({report.risks.length})
                  </p>
                </div>
                <div className="space-y-3">
                  {report.risks.length === 0 ? (
                    <p className="text-xs text-slate-600 italic">No significant risk factors identified.</p>
                  ) : report.risks.map((r, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded bg-red-500/10 flex items-center justify-center shrink-0 mt-0.5">
                        <r.icon className="w-2.5 h-2.5 text-red-400" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-300 leading-snug">{r.text}</p>
                        <p className="text-[10px] text-red-400/70 mt-0.5 font-mono">{r.metric}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Priority Actions */}
              <div className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-5 h-5 rounded bg-sky-500/10 flex items-center justify-center">
                    <Target className="w-3 h-3 text-sky-400" />
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-sky-400">
                    Priority Actions
                  </p>
                </div>
                <div className="space-y-3">
                  {report.actions.map((a, i) => {
                    const style = PRIORITY_STYLES[a.priority];
                    return (
                      <div key={i} className={cn("rounded-xl p-3 border", style.bg)}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cn("text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full", style.label)}>
                            {a.priority}
                          </span>
                          {a.ticker && (
                            <span className="text-[10px] font-mono font-bold text-white">{a.ticker}</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-200 font-semibold leading-snug">{a.action}</p>
                        <p className="text-[10px] text-slate-500 mt-1 leading-snug">{a.rationale}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="px-6 py-2.5 border-t border-white/[0.04]">
              <p className="text-[9px] text-slate-700 leading-relaxed">
                This analysis is generated by a quantitative scoring model using live market data and is for informational purposes only. It does not constitute financial advice.
                Past performance is not indicative of future results. All investments involve risk of loss.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
