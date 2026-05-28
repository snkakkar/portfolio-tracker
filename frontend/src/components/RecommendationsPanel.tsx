import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, Minus, AlertTriangle, XCircle, ChevronRight,
  BarChart2, Shield, Zap, Target,
} from "lucide-react";
import { cn, formatCurrency, formatPct, gainColor, REC_STYLES } from "@/lib/utils";
import type { Holding, Recommendation } from "@/types";

interface Props {
  holdings: Holding[];
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
  const meta = REC_META[h.recommendation];
  const Icon = meta.icon;
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.04 }}
      className={cn(
        "rounded-xl border p-3.5 space-y-2.5",
        meta.bg, meta.border, meta.glow
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", meta.bg, "border", meta.border)}>
            <Icon className={cn("w-4 h-4", REC_STYLES[h.recommendation].split(" ")[1])} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-extrabold text-sm text-white">{h.ticker}</span>
              <span
                className={cn(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded-full border",
                  REC_STYLES[h.recommendation]
                )}
              >
                {h.recommendation}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 leading-tight truncate max-w-[140px]">{h.name}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-white font-mono">{formatCurrency(h.price)}</p>
          <p className={cn("text-[11px] font-mono", gainColor(h.change_pct))}>{formatPct(h.change_pct)} today</p>
        </div>
      </div>

      {/* 52W range */}
      <Range52W price={h.price} low={h.week_52_low} high={h.week_52_high} />

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-1.5">
        {[
          { label: "Total Gain", value: formatPct(h.gain_pct), color: gainColor(h.gain_pct) },
          { label: "Alpha",      value: formatPct(h.alpha * 100), color: gainColor(h.alpha) },
          { label: "P/E",        value: h.pe_ratio ? h.pe_ratio.toFixed(1) + "x" : "—", color: "text-slate-300" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-black/20 rounded-lg p-1.5 text-center">
            <p className={cn("text-xs font-bold font-mono", color)}>{value}</p>
            <p className="text-[9px] text-slate-600 uppercase tracking-wider">{label}</p>
          </div>
        ))}
      </div>

      {/* Reasons */}
      <div className="space-y-1">
        {h.rec_reasons.slice(0, 3).map((r, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <ChevronRight className={cn("w-3 h-3 shrink-0 mt-px", REC_STYLES[h.recommendation].split(" ")[1])} />
            <p className="text-[11px] text-slate-400 leading-snug">{r}</p>
          </div>
        ))}
      </div>

      {/* Action label */}
      <div className={cn("text-center text-[10px] font-semibold uppercase tracking-widest rounded-lg py-1.5 border", meta.bg, meta.border)}>
        <span className={REC_STYLES[h.recommendation].split(" ")[1]}>{meta.label}</span>
      </div>
    </motion.div>
  );
}

export function RecommendationsPanel({ holdings, delay = 0 }: Props) {
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="space-y-4"
    >
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
    </motion.div>
  );
}
