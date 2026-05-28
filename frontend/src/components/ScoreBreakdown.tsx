import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { RecBreakdown, Recommendation } from "@/types";

interface Props {
  breakdown: RecBreakdown;
  score: number;
  recommendation: Recommendation;
  nextTier: Recommendation | null;
  nextPts: number | null;
  delay?: number;
}

const FACTOR_ORDER = [
  "Alpha vs S&P 500",
  "52-Week Range Position",
  "P/E Ratio",
  "Today's Momentum",
  "Beta / Volatility",
  "Market Cap",
  "52W High Distance",
];

const REC_THRESHOLD: Record<Recommendation, number> = {
  "STRONG BUY": 55,
  "BUY": 28,
  "HOLD": -8,
  "SELL": -28,
  "STRONG SELL": -100,
};

const REC_COLOR: Record<Recommendation, string> = {
  "STRONG BUY":  "text-emerald-400",
  "BUY":         "text-green-400",
  "HOLD":        "text-amber-400",
  "SELL":        "text-orange-400",
  "STRONG SELL": "text-red-400",
};

const REC_BG: Record<Recommendation, string> = {
  "STRONG BUY":  "bg-emerald-500",
  "BUY":         "bg-green-500",
  "HOLD":        "bg-amber-500",
  "SELL":        "bg-orange-500",
  "STRONG SELL": "bg-red-500",
};

function FactorBar({ name, points, max, reason, delay }: {
  name: string; points: number; max: number; reason: string; delay: number;
}) {
  const isPositive = points > 0;
  const isZero     = points === 0;
  const pct        = max > 0 ? Math.abs(points) / max * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className="group"
    >
      <div className="flex items-center gap-3">
        {/* Factor name */}
        <div className="w-40 shrink-0">
          <p className="text-[11px] font-semibold text-slate-400 truncate">{name}</p>
        </div>

        {/* Bar track — centred at zero */}
        <div className="flex-1 flex items-center gap-1">
          {/* Negative side */}
          <div className="flex-1 flex justify-end">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${isPositive || isZero ? 0 : pct}%` }}
              transition={{ duration: 0.6, delay: delay + 0.1, ease: "easeOut" }}
              className="h-2 rounded-l-full bg-loss/70"
            />
          </div>

          {/* Zero line */}
          <div className="w-px h-4 bg-slate-700 shrink-0" />

          {/* Positive side */}
          <div className="flex-1">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${isPositive ? pct : 0}%` }}
              transition={{ duration: 0.6, delay: delay + 0.1, ease: "easeOut" }}
              className="h-2 rounded-r-full bg-gain/70"
            />
          </div>
        </div>

        {/* Points value */}
        <div className="w-14 text-right shrink-0">
          <span className={cn(
            "text-xs font-bold font-mono",
            isPositive ? "text-gain" : isZero ? "text-slate-600" : "text-loss"
          )}>
            {points > 0 ? "+" : ""}{points}
          </span>
          <span className="text-[9px] text-slate-700"> /{max > 0 ? `±${max}` : "—"}</span>
        </div>
      </div>

      {/* Reason tooltip-style line */}
      <p className="text-[10px] text-slate-600 ml-[172px] mt-0.5 leading-snug">{reason}</p>
    </motion.div>
  );
}

export function ScoreBreakdown({ breakdown, score, recommendation, nextTier, nextPts, delay = 0 }: Props) {
  // Score bar — total score on a -75 to +75 scale
  const scorePct = Math.min(100, Math.max(0, ((score + 75) / 150) * 100));

  const TIER_POSITIONS = [
    { label: "SS", score: -75, pct: 0 },
    { label: "S",  score: -28, pct: ((-28 + 75) / 150) * 100 },
    { label: "H",  score: -8,  pct: ((-8  + 75) / 150) * 100 },
    { label: "B",  score:  28, pct: ((28  + 75) / 150) * 100 },
    { label: "SB", score:  55, pct: ((55  + 75) / 150) * 100 },
    { label: "",   score:  75, pct: 100 },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="space-y-4"
    >
      {/* Total score gauge */}
      <div className="bg-[#090f1e] rounded-xl p-4 border border-white/[0.05]">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Total Score
          </p>
          <div className="flex items-center gap-2">
            <span className={cn("text-lg font-extrabold font-mono", score >= 28 ? "text-gain" : score >= -8 ? "text-amber-400" : "text-loss")}>
              {score > 0 ? "+" : ""}{score}
            </span>
            <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.08]", REC_COLOR[recommendation])}>
              {recommendation}
            </span>
          </div>
        </div>

        {/* Score bar with tier markers */}
        <div className="relative">
          <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${scorePct}%` }}
              transition={{ duration: 0.7, delay: delay + 0.1, ease: "easeOut" }}
              className={cn("h-full rounded-full", REC_BG[recommendation])}
            />
          </div>
          {/* Tier markers */}
          {TIER_POSITIONS.slice(1, -1).map(({ label, pct }) => (
            <div
              key={label}
              className="absolute top-0 bottom-0 flex flex-col items-center"
              style={{ left: `${pct}%` }}
            >
              <div className="w-px h-2.5 bg-slate-600" />
            </div>
          ))}
        </div>

        {/* Tier labels below */}
        <div className="relative h-4 mt-1">
          {[
            { label: "STRONG SELL", pct: 0,                            color: "text-red-500" },
            { label: "SELL",        pct: ((-28 + 75) / 150) * 100,    color: "text-orange-500" },
            { label: "HOLD",        pct: ((-8  + 75) / 150) * 100,    color: "text-amber-500" },
            { label: "BUY",         pct: ((28  + 75) / 150) * 100,    color: "text-green-500" },
            { label: "STRONG BUY",  pct: ((55  + 75) / 150) * 100,    color: "text-emerald-500" },
          ].map(({ label, pct, color }) => (
            <span
              key={label}
              className={cn("absolute text-[8px] font-bold uppercase -translate-x-1/2", color)}
              style={{ left: `${pct}%` }}
            >
              {label.split(" ").map((w) => w[0]).join("")}
            </span>
          ))}
        </div>

        {/* "What would push this to next tier" */}
        {nextTier && nextPts !== null && (
          <div className="mt-3 px-3 py-2 rounded-lg bg-accent-blue/10 border border-accent-blue/20">
            <p className="text-[11px] text-slate-300 leading-snug">
              <span className="text-accent-blue font-semibold">+{nextPts} more points</span> would move this to{" "}
              <span className={cn("font-bold", REC_COLOR[nextTier])}>{nextTier}</span>
            </p>
          </div>
        )}
      </div>

      {/* Per-factor bars */}
      <div className="space-y-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Factor Breakdown</p>
        <div className="space-y-2">
          {FACTOR_ORDER.map((name, i) => {
            const factor = breakdown[name];
            if (!factor) return null;
            return (
              <FactorBar
                key={name}
                name={name}
                points={factor.points}
                max={factor.max}
                reason={factor.reason}
                delay={delay + 0.05 + i * 0.04}
              />
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
