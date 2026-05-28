import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, Target, Zap, BarChart2, Shield, Award, Activity,
} from "lucide-react";
import { cn, formatPct, gainColor, gainBg, formatCurrency } from "@/lib/utils";
import type { Holding } from "@/types";

interface Props {
  holdings: Holding[];
  delay?: number;
}

function calcAnnualizedReturn(gain_pct: number, purchase_date: string): number {
  const days = Math.max(
    1,
    (Date.now() - new Date(purchase_date).getTime()) / 86_400_000
  );
  const years = days / 365;
  const totalReturn = gain_pct / 100;
  // CAGR formula: (1 + r)^(1/n) - 1
  return (Math.pow(1 + totalReturn, 1 / years) - 1) * 100;
}

export function MetricsPanel({ holdings, delay = 0 }: Props) {
  if (!holdings.length) return null;

  // --- Derived metrics ---
  const totalValue = holdings.reduce((s, h) => s + h.current_value, 0);
  const totalCost  = holdings.reduce((s, h) => s + h.total_cost, 0);

  const winners    = holdings.filter((h) => h.gain > 0);
  const losers     = holdings.filter((h) => h.gain < 0);
  const winRate    = (winners.length / holdings.length) * 100;

  // Weighted portfolio beta
  const betaHoldings = holdings.filter((h) => h.beta != null && h.beta !== 0);
  const portBeta =
    betaHoldings.length > 0
      ? betaHoldings.reduce((s, h) => s + (h.beta! * h.current_value), 0) / totalValue
      : null;

  // Best single-day gainer / loser today
  const todayBest  = [...holdings].sort((a, b) => b.change_pct - a.change_pct)[0];
  const todayWorst = [...holdings].sort((a, b) => a.change_pct - b.change_pct)[0];

  // Weighted average annualized return
  const annualizedReturns = holdings.map((h) => ({
    annualized: calcAnnualizedReturn(h.gain_pct, h.purchase_date),
    weight: h.current_value / totalValue,
  }));
  const portAnnualized = annualizedReturns.reduce((s, r) => s + r.annualized * r.weight, 0);

  // Average alpha
  const avgAlpha = holdings.reduce((s, h) => s + h.alpha, 0) / holdings.length;

  // Outperforming S&P count
  const outperforming = holdings.filter((h) => h.alpha > 0).length;

  // Sector breakdown
  const sectors: Record<string, number> = {};
  holdings.forEach((h) => {
    if (h.sector) sectors[h.sector] = (sectors[h.sector] || 0) + h.current_value;
  });
  const topSector = Object.entries(sectors).sort((a, b) => b[1] - a[1])[0];

  // Big metrics tiles
  const tiles = [
    {
      icon: Award,
      label: "Win Rate",
      value: `${winRate.toFixed(0)}%`,
      sub: `${winners.length} winners / ${losers.length} losers`,
      color: winRate >= 60 ? "text-gain" : winRate >= 40 ? "text-amber-400" : "text-loss",
      iconBg: winRate >= 60 ? "bg-gain/10" : "bg-amber-400/10",
      iconColor: winRate >= 60 ? "text-gain" : "text-amber-400",
    },
    {
      icon: TrendingUp,
      label: "Ann. Return",
      value: formatPct(portAnnualized),
      sub: "Weighted avg CAGR",
      color: gainColor(portAnnualized),
      iconBg: portAnnualized >= 0 ? "bg-gain/10" : "bg-loss/10",
      iconColor: portAnnualized >= 0 ? "text-gain" : "text-loss",
    },
    {
      icon: Zap,
      label: "Avg Alpha",
      value: formatPct(avgAlpha * 100),
      sub: `${outperforming}/${holdings.length} beat S&P`,
      color: gainColor(avgAlpha),
      iconBg: avgAlpha >= 0 ? "bg-accent-blue/10" : "bg-loss/10",
      iconColor: avgAlpha >= 0 ? "text-accent-blue" : "text-loss",
    },
    {
      icon: Activity,
      label: "Portfolio Beta",
      value: portBeta != null ? portBeta.toFixed(2) : "—",
      sub: portBeta != null
        ? portBeta > 1.3 ? "High volatility" : portBeta > 0.8 ? "Market-like" : "Low volatility"
        : "Insufficient data",
      color: portBeta != null && portBeta > 1.3 ? "text-amber-400" : "text-slate-200",
      iconBg: "bg-violet-500/10",
      iconColor: "text-violet-400",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="space-y-4"
    >
      {/* Metric tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((t, i) => (
          <motion.div
            key={t.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: delay + i * 0.05 }}
            className="bg-[#0e1726] border border-white/[0.07] rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", t.iconBg)}>
                <t.icon className={cn("w-3.5 h-3.5", t.iconColor)} />
              </div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">{t.label}</p>
            </div>
            <p className={cn("text-xl font-extrabold leading-tight", t.color)}>{t.value}</p>
            <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">{t.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Today's movers + sector breakdown row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Today's movers */}
        <div className="bg-[#0e1726] border border-white/[0.07] rounded-xl p-4">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-3">Today's Movers</p>
          <div className="space-y-2.5">
            {[todayBest, todayWorst].map((h, i) => (
              <div key={h.ticker + i} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className={cn("w-6 h-6 rounded-md flex items-center justify-center",
                    i === 0 ? "bg-gain/10" : "bg-loss/10")}>
                    {i === 0
                      ? <TrendingUp className="w-3 h-3 text-gain" />
                      : <TrendingDown className="w-3 h-3 text-loss" />}
                  </div>
                  <div>
                    <span className="font-mono font-bold text-xs text-white">{h.ticker}</span>
                    <p className="text-[10px] text-slate-500 truncate max-w-[100px]">{h.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={cn("text-sm font-bold font-mono", gainColor(h.change_pct))}>
                    {formatPct(h.change_pct)}
                  </span>
                  <p className={cn("text-[10px]", gainColor(h.change))}>
                    {h.change >= 0 ? "+" : ""}{formatCurrency(h.change)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sector breakdown */}
        <div className="bg-[#0e1726] border border-white/[0.07] rounded-xl p-4">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-3">Sector Weights</p>
          {Object.keys(sectors).length === 0 ? (
            <p className="text-xs text-slate-600">Sector data loading…</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(sectors)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 4)
                .map(([sector, val]) => {
                  const pct = (val / totalValue) * 100;
                  return (
                    <div key={sector} className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400 w-28 shrink-0 truncate">{sector}</span>
                      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent-blue rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono w-10 text-right">{pct.toFixed(0)}%</span>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
