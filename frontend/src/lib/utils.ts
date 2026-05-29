import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Recommendation, RecColor, Holding } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number, compact = false): string {
  if (compact && Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (compact && Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPct(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function gainColor(value: number): string {
  if (value > 0) return "text-gain";
  if (value < 0) return "text-loss";
  return "text-slate-400";
}

export function gainBg(value: number): string {
  if (value > 0) return "bg-gain/10 text-gain";
  if (value < 0) return "bg-loss/10 text-loss";
  return "bg-slate-700/50 text-slate-400";
}

export const REC_STYLES: Record<Recommendation, string> = {
  "STRONG BUY": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  BUY: "bg-green-500/20 text-green-400 border-green-500/30",
  HOLD: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  SELL: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  "STRONG SELL": "bg-red-500/20 text-red-400 border-red-500/30",
};

export function pieColors(index: number): string {
  const palette = [
    "#3b82f6", "#06b6d4", "#8b5cf6", "#ec4899", "#f59e0b",
    "#22c55e", "#ef4444", "#f97316", "#84cc16", "#14b8a6",
    "#6366f1", "#a855f7", "#0ea5e9", "#10b981", "#fb923c",
    "#e11d48",
  ];
  return palette[index % palette.length];
}

export function formatMarketCap(cap: number | null): string {
  if (!cap) return "—";
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`;
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(2)}B`;
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(2)}M`;
  return `$${cap.toLocaleString()}`;
}

// ─── Alpha aggregation ────────────────────────────────────────────────────────
// Average-of-percents across positions is a meaningless portfolio metric: a $100
// holding pulls just as hard as a $100k one. Use cumulative dollars (real money)
// + value-weighted % (relative comparison) instead.

export interface AlphaAgg {
  cumulative_alpha_dollar: number;
  cumulative_alpha_pct: number;
  weighted_alpha_pct: number;
}

export function computeAlpha(holdings: Holding[]): AlphaAgg {
  if (!holdings.length) {
    return { cumulative_alpha_dollar: 0, cumulative_alpha_pct: 0, weighted_alpha_pct: 0 };
  }
  let totalCost = 0;
  let totalValue = 0;
  let totalGain = 0;
  let spDollar = 0;
  let weightedNumer = 0;
  for (const h of holdings) {
    totalCost += h.total_cost;
    totalValue += h.current_value;
    totalGain += h.gain;
    spDollar += h.sp_gain_dollar;
    weightedNumer += h.alpha * h.current_value;
  }
  const cumulativeDollar = totalGain - spDollar;
  return {
    cumulative_alpha_dollar: cumulativeDollar,
    cumulative_alpha_pct: totalCost ? (cumulativeDollar / totalCost) * 100 : 0,
    // h.alpha is a decimal ratio (gain_pct - sp_gain_pct) / 100, so this gives a percentage.
    weighted_alpha_pct: totalValue ? (weightedNumer / totalValue) * 100 : 0,
  };
}
