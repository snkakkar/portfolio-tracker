import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, TrendingDown, Minus, XCircle, ChevronRight, ChevronDown,
  PlusCircle, Lightbulb, Loader2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn, formatCurrency, formatPct, gainColor, REC_STYLES, formatMarketCap } from "@/lib/utils";
import { ScoreBreakdown } from "./ScoreBreakdown";
import { api } from "@/api/client";
import type { Holding, Recommendation, PortfolioSuggestion } from "@/types";

interface Props {
  holdings: Holding[];
  portfolio: string;
  delay?: number;
}

const REC_META: Record<
  Recommendation,
  { icon: React.ElementType; bg: string; border: string; glow: string; label: string }
> = {
  "STRONG BUY":  { icon: TrendingUp,    bg: "bg-emerald-500/10", border: "border-emerald-500/25", glow: "shadow-[0_0_12px_rgba(16,185,129,0.12)]", label: "Consider adding" },
  "BUY":         { icon: TrendingUp,    bg: "bg-green-500/10",   border: "border-green-500/25",   glow: "shadow-[0_0_12px_rgba(34,197,94,0.1)]",  label: "Good entry" },
  "HOLD":        { icon: Minus,         bg: "bg-amber-500/10",   border: "border-amber-500/25",   glow: "",                                        label: "Stay the course" },
  "SELL":        { icon: TrendingDown,  bg: "bg-orange-500/10",  border: "border-orange-500/25",  glow: "",                                        label: "Review position" },
  "STRONG SELL": { icon: XCircle,       bg: "bg-red-500/10",     border: "border-red-500/30",     glow: "shadow-[0_0_12px_rgba(239,68,68,0.1)]",   label: "Exit position" },
};

const REC_ORDER: Record<Recommendation, number> = {
  "STRONG BUY": 0, "BUY": 1, "HOLD": 2, "SELL": 3, "STRONG SELL": 4,
};

function Range52W({ price, low, high }: { price: number; low: number | null; high: number | null }) {
  if (!low || !high || high === low) return null;
  const pct = Math.min(100, Math.max(0, ((price - low) / (high - low)) * 100));
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <span className="text-[9px] text-slate-600 font-mono">{formatCurrency(low)}</span>
      <div className="relative flex-1 h-1 bg-slate-800 rounded-full">
        <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-loss via-amber-500 to-gain"
          style={{ width: "100%" }} />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white border-2 border-navy-900 shadow"
          style={{ left: `calc(${pct}% - 4px)` }}
        />
      </div>
      <span className="text-[9px] text-slate-600 font-mono">{formatCurrency(high)}</span>
    </div>
  );
}

function HoldingCard({ h, idx }: { h: Holding; idx: number }) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const meta = REC_META[h.recommendation];
  const Icon = meta.icon;
  const accentColor = REC_STYLES[h.recommendation].split(" ")[1];

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.04 }}
      className={cn("rounded-xl border overflow-hidden", meta.bg, meta.border, meta.glow)}
    >
      <div className="p-3.5 space-y-2.5">
        {/* Header row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", meta.bg, "border", meta.border)}>
              <Icon className={cn("w-3.5 h-3.5", accentColor)} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-mono font-extrabold text-sm text-white">{h.ticker}</span>
                <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full border whitespace-nowrap", REC_STYLES[h.recommendation])}>
                  {h.recommendation}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 leading-tight truncate">{h.name}</p>
            </div>
          </div>
          <div className="text-right shrink-0 ml-2">
            <p className="text-sm font-bold text-white font-mono whitespace-nowrap">{formatCurrency(h.price)}</p>
            <p className={cn("text-[10px] font-mono whitespace-nowrap", gainColor(h.change_pct))}>{formatPct(h.change_pct)} today</p>
          </div>
        </div>

        {/* 52W range */}
        <Range52W price={h.price} low={h.week_52_low} high={h.week_52_high} />

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-1">
          {[
            { label: "Gain",  value: formatPct(h.gain_pct),    color: gainColor(h.gain_pct) },
            { label: "Alpha", value: formatPct(h.alpha * 100), color: gainColor(h.alpha) },
            { label: "P/E",   value: h.pe_ratio ? h.pe_ratio.toFixed(1) + "x" : "—", color: "text-slate-300" },
            { label: "Score", value: (h.rec_score > 0 ? "+" : "") + h.rec_score, color: h.rec_score >= 28 ? "text-gain" : h.rec_score >= -8 ? "text-amber-400" : "text-loss" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-black/20 rounded-lg p-1.5 text-center">
              <p className={cn("text-[11px] font-bold font-mono truncate", color)}>{value}</p>
              <p className="text-[9px] text-slate-600 uppercase tracking-wide">{label}</p>
            </div>
          ))}
        </div>

        {/* Key reasons */}
        <div className="space-y-1">
          {h.rec_reasons.slice(0, 3).map((r, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <ChevronRight className={cn("w-3 h-3 shrink-0 mt-px", accentColor)} />
              <p className="text-[11px] text-slate-400 leading-snug">{r}</p>
            </div>
          ))}
        </div>

        {/* Action label + breakdown toggle */}
        <div className="flex items-center gap-2">
          <div className={cn("flex-1 text-center text-[10px] font-bold uppercase tracking-wider rounded-lg py-1.5 border whitespace-nowrap", meta.bg, meta.border)}>
            <span className={accentColor}>{meta.label}</span>
          </div>
          <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            className={cn(
              "flex items-center gap-1 px-2 py-1.5 rounded-lg border text-[10px] font-semibold transition-colors whitespace-nowrap shrink-0",
              showBreakdown ? "bg-accent-blue/20 border-accent-blue/30 text-accent-blue" : "border-white/[0.08] text-slate-500 hover:text-slate-300"
            )}
          >
            Breakdown
            <ChevronDown className={cn("w-3 h-3 transition-transform", showBreakdown && "rotate-180")} />
          </button>
        </div>
      </div>

      {/* Score breakdown panel */}
      <AnimatePresence>
        {showBreakdown && h.rec_breakdown && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-t border-white/[0.06]"
          >
            <div className="p-3.5 bg-black/20">
              <ScoreBreakdown
                breakdown={h.rec_breakdown}
                score={h.rec_score}
                recommendation={h.recommendation}
                nextTier={h.rec_next_tier}
                nextPts={h.rec_next_pts}
                delay={0}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Suggestion Card ─────────────────────────────────────────────────────────

const GAP_LABELS: Record<string, string> = {
  reduce_beta:        "Reduce Volatility",
  add_value:          "Add Value",
  add_diversification:"Diversify",
  add_income:         "Add Income",
};

function SuggestionCard({ s, idx }: { s: PortfolioSuggestion; idx: number }) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const recStyle = REC_STYLES[s.recommendation].split(" ");
  const gapLabel = GAP_LABELS[s.gap_type] ?? s.gap_type.replace(/_/g, " ");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.05 }}
      className="rounded-xl border border-sky-500/20 bg-sky-500/[0.04] overflow-hidden"
    >
      <div className="p-3.5 space-y-2.5">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
              <PlusCircle className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-mono font-extrabold text-sm text-white">{s.ticker}</span>
                <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full border", REC_STYLES[s.recommendation])}>
                  {s.recommendation}
                </span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/25 text-sky-400 uppercase tracking-wide">
                  {gapLabel}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 leading-tight truncate max-w-[160px]">{s.name}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-white font-mono">{formatCurrency(s.price)}</p>
            <p className={cn("text-[11px] font-mono", gainColor(s.change_pct))}>{formatPct(s.change_pct)} today</p>
          </div>
        </div>

        {/* 52W range */}
        {s.week_52_low && s.week_52_high && s.week_52_high > s.week_52_low && (
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-slate-600 font-mono">{formatCurrency(s.week_52_low)}</span>
            <div className="relative flex-1 h-1 bg-slate-800 rounded-full">
              <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-loss via-amber-500 to-gain" style={{ width: "100%" }} />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white border-2 border-navy-900 shadow"
                style={{ left: `calc(${Math.min(100, Math.max(0, (s.price - s.week_52_low) / (s.week_52_high - s.week_52_low) * 100))}% - 4px)` }}
              />
            </div>
            <span className="text-[9px] text-slate-600 font-mono">{formatCurrency(s.week_52_high)}</span>
          </div>
        )}

        {/* Quick stats */}
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { label: "1Y Return", value: formatPct(s.gain_1y_pct),   color: gainColor(s.gain_1y_pct) },
            { label: "Alpha",     value: formatPct(s.alpha * 100),    color: gainColor(s.alpha) },
            { label: "P/E",       value: s.pe_ratio ? s.pe_ratio.toFixed(1) + "x" : "—", color: "text-slate-300" },
            { label: "Beta",      value: s.beta ? s.beta.toFixed(2) : "—", color: s.beta && s.beta > 1.5 ? "text-orange-400" : "text-slate-300" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-black/20 rounded-lg p-1.5 text-center">
              <p className={cn("text-xs font-bold font-mono", color)}>{value}</p>
              <p className="text-[9px] text-slate-600 uppercase tracking-wider">{label}</p>
            </div>
          ))}
        </div>

        {/* Why it helps */}
        <div className="rounded-lg bg-sky-500/[0.07] border border-sky-500/15 px-3 py-2">
          <div className="flex items-start gap-1.5">
            <Lightbulb className="w-3 h-3 text-sky-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-sky-300/80 leading-snug">{s.why_it_helps}</p>
          </div>
        </div>

        {/* Breakdown toggle */}
        <button
          onClick={() => setShowBreakdown(!showBreakdown)}
          className={cn(
            "w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border text-[10px] font-semibold transition-colors",
            showBreakdown ? "bg-accent-blue/20 border-accent-blue/30 text-accent-blue" : "border-white/[0.08] text-slate-500 hover:text-slate-300"
          )}
        >
          Score breakdown
          <ChevronDown className={cn("w-3 h-3 transition-transform", showBreakdown && "rotate-180")} />
        </button>
      </div>

      <AnimatePresence>
        {showBreakdown && s.rec_breakdown && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-t border-white/[0.06]"
          >
            <div className="p-3.5 bg-black/20">
              <ScoreBreakdown
                breakdown={s.rec_breakdown}
                score={s.rec_score}
                recommendation={s.recommendation}
                nextTier={s.rec_next_tier}
                nextPts={s.rec_next_pts}
                delay={0}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const FACTOR_GUIDE = [
  { name: "Alpha vs S&P 500",       max: 35, desc: "How much the stock has beaten (or trailed) VOO since your purchase date. The single most important factor — consistent outperformance is a strong buy signal." },
  { name: "52-Week Range Position", max: 20, desc: "Where the current price sits in its 52-week range. Near the low = potential value entry. Near the high = possible overextension." },
  { name: "P/E Ratio",              max: 15, desc: "Trailing price-to-earnings. A low P/E (< 20) earns positive points. A very high P/E (> 70) penalises the score — unless growth justifies it." },
  { name: "Today's Momentum",       max: 10, desc: "Today's price change. Strong upward momentum adds points; sharp sell-offs reduce the score. This factor resets daily." },
  { name: "Beta / Volatility",      max: 10, desc: "Beta < 1 = less volatile than the market (positive). Beta > 1.7 = significantly more volatile (negative). High-beta stocks need stronger fundamentals." },
  { name: "Market Cap",             max:  5, desc: "Mega/large-caps get a small bonus for liquidity and stability. Small/micro-caps are penalised for higher risk." },
  { name: "52W High Distance",      max:  5, desc: "How far the stock trades below its 52-week high. A big gap means room to recover. Trading right at the high earns a small penalty." },
];

function ScoringGuide() {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-[#0a1628] border border-white/[0.07] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">How scoring works</span>
          <span className="text-[10px] text-slate-600">7 factors, score −75 to +75</span>
        </div>
        <ChevronDown className={cn("w-4 h-4 text-slate-600 transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-white/[0.05]">
              {/* Threshold table */}
              <div className="grid grid-cols-5 gap-2 mt-3">
                {[
                  { label: "STRONG BUY",  range: "≥ 55",  color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
                  { label: "BUY",         range: "≥ 28",  color: "text-green-400",   bg: "bg-green-500/10 border-green-500/20" },
                  { label: "HOLD",        range: "≥ −8",  color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20" },
                  { label: "SELL",        range: "≥ −28", color: "text-orange-400",  bg: "bg-orange-500/10 border-orange-500/20" },
                  { label: "STRONG SELL", range: "< −28", color: "text-red-400",     bg: "bg-red-500/10 border-red-500/20" },
                ].map(({ label, range, color, bg }) => (
                  <div key={label} className={cn("rounded-lg border p-2 text-center", bg)}>
                    <p className={cn("text-[10px] font-extrabold", color)}>{label}</p>
                    <p className="text-[10px] text-slate-600 font-mono mt-0.5">{range}</p>
                  </div>
                ))}
              </div>

              {/* Factor list */}
              <div className="space-y-2 mt-2">
                {FACTOR_GUIDE.map(({ name, max, desc }) => (
                  <div key={name} className="flex gap-3">
                    <div className="shrink-0 pt-0.5">
                      <span className="text-[10px] font-bold text-accent-blue bg-accent-blue/10 border border-accent-blue/20 rounded px-1.5 py-0.5 font-mono">
                        ±{max}
                      </span>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-300">{name}</p>
                      <p className="text-[10px] text-slate-500 leading-snug">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-[10px] text-slate-700 border-t border-white/[0.04] pt-2 mt-2">
                Scores are recomputed live on each page refresh. Not financial advice.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function RecommendationsPanel({ holdings, portfolio, delay = 0 }: Props) {
  // Group by recommendation
  const grouped = (["STRONG BUY", "BUY", "HOLD", "SELL", "STRONG SELL"] as Recommendation[]).reduce<
    Record<Recommendation, Holding[]>
  >(
    (acc, rec) => ({ ...acc, [rec]: holdings.filter((h) => h.recommendation === rec) }),
    {} as Record<Recommendation, Holding[]>
  );

  const buys    = [...(grouped["STRONG BUY"] ?? []), ...(grouped["BUY"] ?? [])];
  const holds   = grouped["HOLD"] ?? [];
  const sells   = [...(grouped["SELL"] ?? []), ...(grouped["STRONG SELL"] ?? [])];

  // Score summary
  const avgScore = holdings.length
    ? (holdings.reduce((s, h) => s + h.rec_score, 0) / holdings.length).toFixed(1)
    : "—";

  // Portfolio-specific suggestions
  const { data: suggestData, isLoading: suggestLoading } = useQuery({
    queryKey: ["suggestions", portfolio],
    queryFn: () => api.getPortfolioSuggestions(portfolio),
    staleTime: 300_000, // 5 min — suggestions don't change rapidly
  });
  const suggestions = suggestData?.suggestions ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="space-y-4"
    >
      {/* Scoring guide */}
      <ScoringGuide />

      {/* Summary bar */}
      <div className="flex items-center gap-3 bg-[#0e1726] border border-white/[0.07] rounded-xl p-4">
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          {[
            { label: "Strong Buy", count: grouped["STRONG BUY"]?.length, color: "bg-emerald-500" },
            { label: "Buy",        count: grouped["BUY"]?.length,        color: "bg-green-500" },
            { label: "Hold",       count: grouped["HOLD"]?.length,        color: "bg-amber-500" },
            { label: "Sell",       count: grouped["SELL"]?.length,        color: "bg-orange-500" },
            { label: "Strong Sell",count: grouped["STRONG SELL"]?.length, color: "bg-red-500" },
          ].map(({ label, count, color }) =>
            count ? (
              <div key={label} className="flex items-center gap-1.5">
                <span className={cn("w-2 h-2 rounded-full", color)} />
                <span className="text-xs text-slate-400">{count} {label}</span>
              </div>
            ) : null
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] text-slate-600 uppercase tracking-wider">Avg Score</p>
          <p className="text-lg font-extrabold text-white">{avgScore}</p>
        </div>
      </div>

      {/* Three columns: Buy / Hold / Sell */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Buy column */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-3.5 h-3.5 text-gain" />
            <p className="text-xs font-bold text-gain uppercase tracking-wider">Add / Buy ({buys.length})</p>
          </div>
          <div className="space-y-3">
            {buys.length === 0
              ? <p className="text-xs text-slate-600 py-4 text-center">No buy signals</p>
              : buys.map((h, i) => <HoldingCard key={h.ticker} h={h} idx={i} />)}
          </div>
        </div>

        {/* Hold column */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Minus className="w-3.5 h-3.5 text-amber-400" />
            <p className="text-xs font-bold text-amber-400 uppercase tracking-wider">Hold ({holds.length})</p>
          </div>
          <div className="space-y-3">
            {holds.length === 0
              ? <p className="text-xs text-slate-600 py-4 text-center">No holds</p>
              : holds.map((h, i) => <HoldingCard key={h.ticker} h={h} idx={i} />)}
          </div>
        </div>

        {/* Sell column */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-3.5 h-3.5 text-loss" />
            <p className="text-xs font-bold text-loss uppercase tracking-wider">Review / Sell ({sells.length})</p>
          </div>
          <div className="space-y-3">
            {sells.length === 0
              ? <p className="text-xs text-slate-600 py-4 text-center">No sell signals</p>
              : sells.map((h, i) => <HoldingCard key={h.ticker} h={h} idx={i} />)}
          </div>
        </div>
      </div>

      {/* ── Suggested Additions ─────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-sky-500/10 flex items-center justify-center">
              <PlusCircle className="w-3 h-3 text-sky-400" />
            </div>
            <p className="text-xs font-bold text-sky-400 uppercase tracking-wider">
              Suggested Additions for This Portfolio
            </p>
          </div>
          {suggestLoading && (
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <Loader2 className="w-3 h-3 animate-spin" />
              Analysing gaps…
            </div>
          )}
          {!suggestLoading && suggestions.length > 0 && (
            <span className="text-[10px] text-slate-500">
              {suggestions.length} stock{suggestions.length !== 1 ? "s" : ""} identified
            </span>
          )}
        </div>

        {suggestLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1,2,3].map((i) => (
              <div key={i} className="h-48 rounded-xl bg-white/[0.03] border border-white/[0.05] animate-pulse" />
            ))}
          </div>
        ) : suggestions.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-6 text-center">
            <p className="text-xs text-slate-500">No structural gaps detected — portfolio appears well-balanced.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {suggestions.map((s, i) => (
              <SuggestionCard key={s.ticker} s={s} idx={i} />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
