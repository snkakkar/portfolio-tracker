import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Recommendation, RecColor } from "@/types";

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
