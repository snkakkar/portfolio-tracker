import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronUp, BarChart2, Target, Zap, Shield,
  Layers, PieChart,
} from "lucide-react";
import { cn, formatPct } from "@/lib/utils";
import type { Holding } from "@/types";

interface Props {
  holdings: Holding[];
  label: string;
}

// ─── Quantitative grade model ────────────────────────────────────────────────

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

function buildReport(holdings: Holding[], label: string): ReportData | null {
  if (!holdings.length) return null;

  const totalValue = holdings.reduce((s, h) => s + h.current_value, 0);
  if (totalValue === 0) return null;

  // ── Core metrics ──────────────────────────────────────────────────────────
  const avgAlpha = holdings.reduce((s, h) => s + h.alpha * 100, 0) / holdings.length;
  const avgGainPct = holdings.reduce((s, h) => s + h.gain_pct, 0) / holdings.length;

  const betaHoldings = holdings.filter((h) => h.beta !== null);
  const weightedBeta = betaHoldings.length
    ? betaHoldings.reduce((s, h) => s + h.beta! * (h.current_value / totalValue), 0)
    : null;

  const winRate = (holdings.filter((h) => h.gain > 0).length / holdings.length) * 100;

  const sortedByWeight = [...holdings].sort((a, b) => b.current_value - a.current_value);
  const top1Pct = (sortedByWeight[0]?.current_value / totalValue) * 100;
  const top3Pct = sortedByWeight.slice(0, 3).reduce((s, h) => s + h.current_value / totalValue * 100, 0);
  const top1Ticker = sortedByWeight[0]?.ticker ?? "";

  const sectors = holdings.map((h) => h.sector).filter(Boolean) as string[];
  const sectorCounts: Record<string, number> = {};
  sectors.forEach((s) => { sectorCounts[s] = (sectorCounts[s] || 0) + 1; });
  const sectorCount = Object.keys(sectorCounts).length;
  const topSector = Object.entries(sectorCounts).sort((a, b) => b[1] - a[1])[0];
  const topSectorPct = topSector ? (topSector[1] / holdings.length) * 100 : 0;

  const peHoldings = holdings.filter((h) => h.pe_ratio && h.pe_ratio > 0 && h.pe_ratio < 500);
  const avgPE = peHoldings.length
    ? peHoldings.reduce((s, h) => s + h.pe_ratio!, 0) / peHoldings.length
    : null;

  const sells   = holdings.filter((h) => h.recommendation === "SELL" || h.recommendation === "STRONG SELL");
  const strongSells = holdings.filter((h) => h.recommendation === "STRONG SELL");
  const buys    = holdings.filter((h) => h.recommendation === "STRONG BUY" || h.recommendation === "BUY");
  const strongBuys = holdings.filter((h) => h.recommendation === "STRONG BUY");

  // Near 52W lows (bottom 15% of range)
  const nearLows = holdings.filter((h) => {
    if (!h.week_52_low || !h.week_52_high || h.week_52_high <= h.week_52_low) return false;
    const pos = (h.price - h.week_52_low) / (h.week_52_high - h.week_52_low);
    return pos < 0.15;
  });

  // ── Score model ───────────────────────────────────────────────────────────
  let score = 50;

  // Alpha vs S&P (±22 pts)
  if (avgAlpha > 15)      score += 22;
  else if (avgAlpha > 10) score += 16;
  else if (avgAlpha > 5)  score += 10;
  else if (avgAlpha > 0)  score += 4;
  else if (avgAlpha < -15) score -= 20;
  else if (avgAlpha < -5)  score -= 12;
  else                     score -= 4;

  // Win rate (±16 pts)
  if (winRate > 75)      score += 16;
  else if (winRate > 65) score += 10;
  else if (winRate > 55) score += 4;
  else if (winRate < 40) score -= 14;
  else if (winRate < 50) score -= 7;

  // Beta (±8 pts)
  if (weightedBeta !== null) {
    if (weightedBeta >= 0.65 && weightedBeta <= 1.15) score += 8;
    else if (weightedBeta > 1.5)  score -= 5;
    else if (weightedBeta > 2.0)  score -= 10;
    else if (weightedBeta < 0.4)  score -= 3;
  }

  // Concentration (top1: ±14 pts)
  if (top1Pct < 15)       score += 8;
  else if (top1Pct < 25)  score += 3;
  else if (top1Pct > 50)  score -= 14;
  else if (top1Pct > 35)  score -= 8;

  // Sell signals (±14 pts)
  if (sells.length === 0)     score += 8;
  else if (sells.length === 1) score -= 4;
  else if (sells.length === 2) score -= 10;
  else                          score -= 14;

  // Sector diversity (±8 pts)
  if (sectorCount >= 5)      score += 8;
  else if (sectorCount >= 3) score += 3;
  else if (sectorCount <= 1) score -= 8;
  else                        score -= 3;

  // P/E sanity (±4 pts)
  if (avgPE !== null) {
    if (avgPE < 22)      score += 4;
    else if (avgPE > 45) score -= 4;
  }

  score = Math.max(0, Math.min(100, score));

  // ── Grade ─────────────────────────────────────────────────────────────────
  const gradeMap: [number, string, string, string, string][] = [
    [90, "A+", "text-emerald-400", "STRONG OVERWEIGHT", "text-emerald-400"],
    [83, "A",  "text-emerald-400", "STRONG OVERWEIGHT", "text-emerald-400"],
    [76, "A−", "text-green-400",   "OVERWEIGHT",        "text-green-400"],
    [70, "B+", "text-green-400",   "OVERWEIGHT",        "text-green-400"],
    [64, "B",  "text-sky-400",     "OVERWEIGHT",        "text-sky-400"],
    [58, "B−", "text-sky-400",     "MARKET WEIGHT",     "text-sky-400"],
    [52, "C+", "text-amber-400",   "MARKET WEIGHT",     "text-amber-400"],
    [46, "C",  "text-amber-400",   "UNDERWEIGHT",       "text-amber-400"],
    [40, "C−", "text-orange-400",  "UNDERWEIGHT",       "text-orange-400"],
    [34, "D+", "text-orange-400",  "UNDERWEIGHT",       "text-orange-400"],
    [28, "D",  "text-red-400",     "STRONG UNDERWEIGHT","text-red-400"],
    [0,  "F",  "text-red-400",     "STRONG UNDERWEIGHT","text-red-400"],
  ];
  const [, grade, gradeColor, rating, ratingColor] =
    gradeMap.find(([min]) => score >= min)!;

  // ── Narrative headline ────────────────────────────────────────────────────
  const alphaVerb = avgAlpha > 5 ? "strong" : avgAlpha > 0 ? "modest" : avgAlpha < -5 ? "significant negative" : "neutral";
  const concVerb  = top1Pct > 40 ? "dangerously concentrated" : top3Pct > 60 ? "top-heavy" : "reasonably balanced";
  const betaAdj   = weightedBeta === null ? "" : weightedBeta > 1.4 ? "high-beta" : weightedBeta < 0.8 ? "low-beta" : "balanced-beta";

  const positives = [
    avgAlpha > 5  && `${alphaVerb} alpha generation (+${avgAlpha.toFixed(1)}% vs S&P)`,
    winRate > 65  && `${winRate.toFixed(0)}% win rate`,
    sells.length === 0 && "no active sell signals",
    sectorCount >= 4 && `${sectorCount}-sector diversification`,
  ].filter(Boolean).slice(0, 2).join(" and ");

  const negatives = [
    sells.length >= 2  && `${sells.length} unresolved sell signals`,
    top1Pct > 35       && `concentration risk in ${top1Ticker} (${top1Pct.toFixed(0)}%)`,
    avgAlpha < -3      && `portfolio lagging S&P by ${Math.abs(avgAlpha).toFixed(1)}%`,
    sectorCount <= 2   && "limited sector diversification",
    weightedBeta && weightedBeta > 1.5 && `above-market beta of ${weightedBeta.toFixed(2)}`,
  ].filter(Boolean).slice(0, 2).join("; ");

  const headline =
    score >= 70
      ? `${label} demonstrates ${positives || "solid fundamentals"} — rated ${rating}`
      : score >= 54
      ? `${label} is ${concVerb} with ${positives || "mixed signals"} — key risks require attention`
      : `${label} requires structural attention: ${negatives || "multiple risk factors present"}`;

  const narrative = buildNarrative(
    score, avgAlpha, winRate, top1Pct, top3Pct, top1Ticker,
    sectorCount, sells.length, buys.length, weightedBeta, avgPE, holdings.length, label
  );

  // ── Strengths ─────────────────────────────────────────────────────────────
  const strengths: ReportData["strengths"] = [];

  if (avgAlpha > 3) strengths.push({
    icon: TrendingUp,
    text: `Generating ${avgAlpha > 10 ? "exceptional" : "meaningful"} alpha vs S&P 500`,
    metric: `+${avgAlpha.toFixed(1)}% avg outperformance`,
  });
  if (winRate > 60) strengths.push({
    icon: CheckCircle2,
    text: `${winRate > 75 ? "High" : "Solid"} win rate — majority of positions profitable`,
    metric: `${winRate.toFixed(0)}% of positions in the green`,
  });
  if (weightedBeta !== null && weightedBeta < 1.0 && weightedBeta > 0.5) strengths.push({
    icon: Shield,
    text: "Below-market beta — favorable risk-adjusted return profile",
    metric: `β = ${weightedBeta.toFixed(2)} (market is 1.0)`,
  });
  if (sells.length === 0) strengths.push({
    icon: Target,
    text: "All positions carry neutral-to-positive signals",
    metric: `${buys.length} Buy · ${holdings.length - buys.length - sells.length} Hold · 0 Sell`,
  });
  if (sectorCount >= 4) strengths.push({
    icon: PieChart,
    text: `Well-diversified across ${sectorCount} distinct sectors`,
    metric: `No single sector dominates`,
  });
  if (strongBuys.length >= 2) strengths.push({
    icon: Zap,
    text: `${strongBuys.length} STRONG BUY conviction positions`,
    metric: strongBuys.slice(0, 3).map((h) => h.ticker).join(", "),
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

  if (top1Pct > 30) risks.push({
    icon: Layers,
    text: `Concentration risk — ${top1Ticker} represents outsized portfolio weight`,
    metric: `${top1Pct.toFixed(0)}% in single position (top 3 = ${top3Pct.toFixed(0)}%)`,
  });
  if (sells.length >= 1) risks.push({
    icon: TrendingDown,
    text: `${sells.length} position${sells.length > 1 ? "s" : ""} flagged with ${sells.length > 1 ? "sell signals" : "a sell signal"}`,
    metric: sells.slice(0, 3).map((h) => `${h.ticker} (${h.recommendation})`).join(", "),
  });
  if (avgAlpha < 0) risks.push({
    icon: AlertTriangle,
    text: "Portfolio underperforming S&P 500 on a risk-adjusted basis",
    metric: `Avg alpha ${avgAlpha.toFixed(1)}% — capital destruction vs benchmark`,
  });
  if (sectorCount <= 2) risks.push({
    icon: PieChart,
    text: "Limited sector diversification — idiosyncratic risk elevated",
    metric: sectorCount <= 1
      ? "All holdings in one sector — no buffer against sector downturns"
      : `Only ${sectorCount} sectors — heavily exposed to ${topSector?.[0] ?? "one sector"}`,
  });
  if (weightedBeta !== null && weightedBeta > 1.4) risks.push({
    icon: AlertTriangle,
    text: "Above-market beta — portfolio amplifies market drawdowns",
    metric: `β = ${weightedBeta.toFixed(2)} — ${((weightedBeta - 1) * 100).toFixed(0)}% more volatile than S&P`,
  });
  if (nearLows.length >= 2) risks.push({
    icon: TrendingDown,
    text: `${nearLows.length} positions sitting near 52-week lows`,
    metric: nearLows.slice(0, 3).map((h) => h.ticker).join(", ") + " — downtrend risk",
  });
  if (winRate < 50) risks.push({
    icon: TrendingDown,
    text: "Below-50% win rate — more losing positions than winning",
    metric: `${holdings.filter((h) => h.gain < 0).length} losers vs ${holdings.filter((h) => h.gain > 0).length} winners`,
  });
  if (avgPE !== null && avgPE > 40) risks.push({
    icon: BarChart2,
    text: "Portfolio carrying elevated valuation risk",
    metric: `Avg P/E ${avgPE.toFixed(1)}x — vulnerable to multiple compression`,
  });
  if (topSectorPct > 60 && sectorCount > 1) risks.push({
    icon: PieChart,
    text: `Sector concentration in ${topSector?.[0] ?? "one sector"}`,
    metric: `${topSectorPct.toFixed(0)}% of holdings in single sector`,
  });

  // ── Priority actions ──────────────────────────────────────────────────────
  const actions: ReportData["actions"] = [];

  // Address sell signals first
  for (const h of sells.slice(0, 2)) {
    actions.push({
      priority: "high",
      ticker: h.ticker,
      action: h.recommendation === "STRONG SELL" ? `Exit ${h.ticker} position` : `Reduce or exit ${h.ticker}`,
      rationale: h.rec_reasons[0] ?? `Rated ${h.recommendation} by our model`,
    });
  }

  // Address concentration
  if (top1Pct > 35 && !sells.find((h) => h.ticker === top1Ticker)) {
    actions.push({
      priority: "high",
      ticker: top1Ticker,
      action: `Trim ${top1Ticker} to reduce concentration`,
      rationale: `At ${top1Pct.toFixed(0)}% of portfolio, a 20% drawdown in ${top1Ticker} alone would drop the overall portfolio by ${(top1Pct * 0.2).toFixed(0)}%`,
    });
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

  // Near 52W lows review
  if (nearLows.length >= 2) {
    actions.push({
      priority: "medium",
      ticker: null,
      action: `Review thesis on ${nearLows.map((h) => h.ticker).slice(0, 2).join(", ")} near 52W lows`,
      rationale: "Determine whether the downtrend reflects deteriorating fundamentals or a tactical entry opportunity",
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
      label: "Alpha vs S&P",
      value: formatPct(avgAlpha),
      color: avgAlpha > 0 ? "text-green-400" : "text-red-400",
    },
    {
      label: "Win Rate",
      value: `${winRate.toFixed(0)}%`,
      color: winRate > 60 ? "text-green-400" : winRate < 50 ? "text-red-400" : "text-amber-400",
    },
    {
      label: "Portfolio β",
      value: weightedBeta !== null ? weightedBeta.toFixed(2) : "N/A",
      color: weightedBeta !== null && weightedBeta > 1.5 ? "text-orange-400" : "text-slate-300",
    },
    {
      label: "Signals",
      value: `${buys.length}B / ${holdings.length - buys.length - sells.length}H / ${sells.length}S`,
      color: sells.length >= 2 ? "text-orange-400" : "text-slate-300",
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
  avgAlpha: number, winRate: number, top1Pct: number, top3Pct: number,
  top1Ticker: string, sectorCount: number, sellCount: number, buyCount: number,
  beta: number | null, avgPE: number | null, n: number, label: string
): string {
  const parts: string[] = [];

  // Alpha sentence
  if (avgAlpha > 10)
    parts.push(`This portfolio is a strong alpha generator, outperforming the S&P 500 by an average of ${avgAlpha.toFixed(1)}% per position — a rare achievement that suggests genuine stock-picking skill or favorable sector timing.`);
  else if (avgAlpha > 3)
    parts.push(`The portfolio delivers ${avgAlpha.toFixed(1)}% average alpha over the S&P 500, a respectable outperformance that reflects sound position selection.`);
  else if (avgAlpha > 0)
    parts.push(`The portfolio is marginally ahead of its S&P 500 benchmark (+${avgAlpha.toFixed(1)}% avg alpha), though the margin of outperformance is narrow and warrants continued monitoring.`);
  else
    parts.push(`The portfolio is currently underperforming its S&P 500 benchmark by ${Math.abs(avgAlpha).toFixed(1)}% on average — a meaningful drag that compounds over time if left unaddressed.`);

  // Win rate + concentration sentence
  if (winRate > 70 && top1Pct <= 30)
    parts.push(`A ${winRate.toFixed(0)}% win rate across ${n} positions, combined with a balanced allocation structure, creates a durable return profile.`);
  else if (winRate > 60 && top1Pct > 35)
    parts.push(`A strong ${winRate.toFixed(0)}% win rate is partially offset by concentration risk — ${top1Ticker} alone represents ${top1Pct.toFixed(0)}% of the portfolio, meaning a single adverse move carries portfolio-level consequences.`);
  else if (winRate < 50)
    parts.push(`The below-50% win rate (${winRate.toFixed(0)}%) suggests the selection process needs recalibration — an active trader's edge should consistently exceed 55%.`);

  // Sell signals
  if (sellCount >= 3)
    parts.push(`Most urgently, ${sellCount} positions are flashing sell signals — at this level, selective exits are essential before further capital erosion.`);
  else if (sellCount >= 1)
    parts.push(`${sellCount === 1 ? "One position carries" : `${sellCount} positions carry`} an active sell signal and should be reviewed for exit or significant reduction.`);

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

export function AnalystReport({ holdings, label }: Props) {
  const [expanded, setExpanded] = useState(false);
  const report = useMemo(() => buildReport(holdings, label), [holdings, label]);

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
