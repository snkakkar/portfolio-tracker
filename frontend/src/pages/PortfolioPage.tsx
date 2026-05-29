import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  DollarSign, TrendingUp, Activity, Plus, RefreshCw,
  BarChart2, Award, LayoutGrid, Target, ArrowUpRight, ArrowDownRight,
  Layers, EyeOff, X, LogOut,
} from "lucide-react";
import { api } from "@/api/client";
import { SummaryCard } from "@/components/SummaryCard";
import { HoldingsTable } from "@/components/HoldingsTable";
import { PortfolioPieChart } from "@/components/PortfolioPieChart";
import { GainBarChart } from "@/components/GainBarChart";
import { RecBadge } from "@/components/RecBadge";
import { MetricsPanel } from "@/components/MetricsPanel";
import { RecommendationsPanel } from "@/components/RecommendationsPanel";
import { AnalystReport } from "@/components/AnalystReport";
import { ClosedPositionsTable } from "@/components/ClosedPositionsTable";
import { AddPositionModal } from "@/components/AddPositionModal";
import { SignalsModal } from "@/components/SignalsModal";
import { SkeletonCard, SkeletonTable } from "@/components/Skeleton";
import { TickerLink } from "@/components/TickerLink";
import { formatCurrency, formatPct, gainColor, computeAlpha } from "@/lib/utils";
import type { PortfolioKey } from "@/types";

interface Props {
  // Built-in keys are typed; custom user-created portfolios pass through as strings.
  portfolio: PortfolioKey | string;
}

type Tab = "overview" | "analytics" | "recommendations" | "closed";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "overview",        label: "Overview",         icon: LayoutGrid },
  { id: "analytics",       label: "Analytics",        icon: BarChart2 },
  { id: "recommendations", label: "Recommendations",  icon: Target },
  { id: "closed",          label: "Closed Positions", icon: LogOut },
];

export function PortfolioPage({ portfolio }: Props) {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [chartView, setChartView] = useState<"gain" | "alpha">("gain");
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [signalFilter, setSignalFilter] = useState<"all" | "buy" | "sell">("all");
  const [signalsModal, setSignalsModal] = useState<"buy" | "sell" | null>(null);

  function toggleExclude(ticker: string) {
    setExcluded((prev) => {
      const next = new Set(prev);
      next.has(ticker) ? next.delete(ticker) : next.add(ticker);
      return next;
    });
  }

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["portfolio", portfolio],
    queryFn: () => api.getPortfolio(portfolio),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  if (isError) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-400 mb-2">Failed to load portfolio</p>
          <button onClick={() => refetch()} className="text-sm text-accent-blue hover:underline">
            Try again
          </button>
        </div>
      </div>
    );
  }

  const summary = data?.summary;
  const holdings = data?.holdings ?? [];
  const hasExclusions = excluded.size > 0;

  // Active = all holdings minus temporarily excluded ones
  const activeHoldings = holdings.filter((h) => !excluded.has(h.ticker));

  const sorted = [...activeHoldings].sort((a, b) => b.gain_pct - a.gain_pct);
  const topPerformers   = sorted.slice(0, 5);
  const worstPerformers = sorted.slice(-5).reverse();

  // Recompute summary stats from active holdings when exclusions are applied
  const activeTotalValue  = activeHoldings.reduce((s, h) => s + h.current_value, 0);
  const activeTotalCost   = activeHoldings.reduce((s, h) => s + h.shares * h.cost_per_share, 0);
  const activeTotalGain   = activeTotalValue - activeTotalCost;
  const activeGainPct     = activeTotalCost > 0 ? (activeTotalGain / activeTotalCost) * 100 : 0;
  const activeTodayGain   = activeHoldings.reduce((s, h) => s + h.shares * h.change, 0);
  const winners = activeHoldings.filter((h) => h.gain > 0).length;
  const winRate = activeHoldings.length ? (winners / activeHoldings.length) * 100 : 0;

  const displayTotalValue  = hasExclusions ? activeTotalValue  : (summary?.total_value  ?? 0);
  const displayTotalGain   = hasExclusions ? activeTotalGain   : (summary?.total_gain   ?? 0);
  const displayGainPct     = hasExclusions ? activeGainPct     : (summary?.gain_pct     ?? 0);
  const displayTodayGain   = hasExclusions ? activeTodayGain   : (summary?.todays_gain  ?? 0);
  const displayTotalCost   = hasExclusions ? activeTotalCost   : (summary?.total_cost   ?? 0);

  // Quick stats for the strip (always from active holdings)
  const todayUp   = activeHoldings.filter((h) => h.change > 0).length;
  const todayDown = activeHoldings.filter((h) => h.change < 0).length;

  // Cumulative dollar alpha + value-weighted alpha %. Recompute locally when
  // exclusions are applied so the strip stays in sync with the active subset;
  // otherwise prefer the server summary (matches what other consumers see).
  const localAlpha = computeAlpha(activeHoldings);
  const alphaSummary = hasExclusions
    ? localAlpha
    : (summary
        ? { cumulative_alpha_dollar: summary.cumulative_alpha_dollar, weighted_alpha_pct: summary.weighted_alpha_pct }
        : localAlpha);
  const buys      = activeHoldings.filter((h) => h.recommendation === "STRONG BUY" || h.recommendation === "BUY").length;
  const sells     = activeHoldings.filter((h) => h.recommendation === "SELL" || h.recommendation === "STRONG SELL").length;
  const signalFilteredHoldings = holdings.filter((h) => {
    if (signalFilter === "buy") return h.recommendation === "STRONG BUY" || h.recommendation === "BUY";
    if (signalFilter === "sell") return h.recommendation === "SELL" || h.recommendation === "STRONG SELL";
    return true;
  });

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{data?.label ?? "Portfolio"}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {holdings.length} position{holdings.length !== 1 ? "s" : ""} &middot; Live data &middot; Auto-refreshes every 2 min
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/[0.07] bg-white/[0.03] text-slate-400 hover:text-white hover:bg-white/[0.06] text-sm transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent-blue hover:bg-blue-500 text-white text-sm font-semibold transition-colors shadow-glow"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Position
          </button>
        </div>
      </div>

      {/* Exclusion banner */}
      {hasExclusions && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25"
        >
          <div className="flex items-center gap-2 text-sm">
            <EyeOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-amber-300 font-semibold">
              {excluded.size} position{excluded.size !== 1 ? "s" : ""} excluded from analysis:
            </span>
            <span className="text-amber-400/70 font-mono text-xs">
              {[...excluded].join(", ")}
            </span>
          </div>
          <button
            onClick={() => setExcluded(new Set())}
            className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-200 transition-colors shrink-0"
          >
            <X className="w-3 h-3" />
            Clear all
          </button>
        </motion.div>
      )}

      {/* Summary cards — always visible */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <SummaryCard
              label={hasExclusions ? "Active Value" : "Total Value"}
              value={displayTotalValue}
              valueType="currency"
              sub2={`Cost basis ${formatCurrency(displayTotalCost)}`}
              icon={DollarSign}
              delay={0}
              accent
              iconColor="text-accent-blue"
              iconBg="bg-accent-blue/20"
            />
            <SummaryCard
              label={hasExclusions ? "Active Gain" : "Total Gain"}
              value={displayTotalGain}
              valueType="currency"
              sub={formatPct(displayGainPct)}
              icon={TrendingUp}
              trend={displayTotalGain}
              delay={0.05}
              iconColor={displayTotalGain >= 0 ? "text-gain" : "text-loss"}
              iconBg={displayTotalGain >= 0 ? "bg-gain/10" : "bg-loss/10"}
            />
            <SummaryCard
              label="Today's Gain"
              value={displayTodayGain}
              valueType="currency"
              sub={activeHoldings.length ? `${todayUp}↑  ${todayDown}↓` : undefined}
              icon={Activity}
              trend={displayTodayGain}
              delay={0.1}
              iconColor={displayTodayGain >= 0 ? "text-gain" : "text-loss"}
              iconBg={displayTodayGain >= 0 ? "bg-gain/10" : "bg-loss/10"}
            />
            <SummaryCard
              label="Win Rate"
              value={`${winRate.toFixed(0)}%`}
              sub={`${winners} of ${activeHoldings.length} positions profitable`}
              icon={Award}
              delay={0.15}
              iconColor={winRate >= 60 ? "text-amber-400" : "text-slate-400"}
              iconBg={winRate >= 60 ? "bg-amber-400/10" : "bg-white/[0.05]"}
            />
          </>
        )}
      </div>

      {/* Tab nav */}
      {!isLoading && (
        <div className="flex gap-1 p-1 bg-[#0a1628] rounded-xl border border-white/[0.05] w-fit">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === id
                  ? "bg-[#1a2f50] text-white shadow"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      )}

      {/* === OVERVIEW TAB === */}
      {activeTab === "overview" && !isLoading && activeHoldings.length > 0 && (
        <div className="space-y-5">

          {/* Analyst Report lives at the top of the Overview tab */}
          <AnalystReport
            holdings={activeHoldings}
            label={data?.label ?? "Portfolio"}
            summary={alphaSummary}
          />

          {/* Quick stats strip */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-wrap gap-2"
          >
            {[
              { label: "Today",      value: `${todayUp}↑ ${todayDown}↓`,        color: todayUp > todayDown ? "text-gain" : "text-loss",     bg: "bg-white/[0.04] border-white/[0.07]", filter: null },
              { label: "Cum α $",    value: formatCurrency(alphaSummary.cumulative_alpha_dollar), color: gainColor(alphaSummary.cumulative_alpha_dollar), bg: "bg-white/[0.04] border-white/[0.07]", filter: null },
              { label: "Weighted α", value: `${alphaSummary.weighted_alpha_pct >= 0 ? "+" : ""}${alphaSummary.weighted_alpha_pct.toFixed(1)}%`, color: gainColor(alphaSummary.weighted_alpha_pct), bg: "bg-white/[0.04] border-white/[0.07]", filter: null },
              { label: "Buy signals",  value: `${buys}`,  color: "text-gain",  bg: "bg-gain/10 border-gain/20", filter: "buy" as const },
              { label: "Sell signals", value: `${sells}`, color: "text-loss",  bg: sells > 0 ? "bg-loss/10 border-loss/20" : "bg-white/[0.04] border-white/[0.07]", filter: "sell" as const },
              { label: "Positions",    value: hasExclusions ? `${activeHoldings.length}/${holdings.length}` : `${holdings.length}`, color: "text-slate-300", bg: "bg-white/[0.04] border-white/[0.07]", filter: null },
            ].map(({ label, value, color, bg, filter }) => (
              <div key={label} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs ${bg}`}>
                <span className="text-slate-500">{label}:</span>
                {filter ? (
                  <button
                    onClick={() => {
                      setSignalsModal(filter);
                      setSignalFilter(filter);
                    }}
                    className={`font-bold font-mono transition-colors underline underline-offset-2 hover:text-white ${
                      signalFilter === filter ? "text-white" : color
                    }`}
                    title={`Show ${label.toLowerCase()} list`}
                  >
                    {value}
                  </button>
                ) : (
                  <span className={`font-bold font-mono ${color}`}>{value}</span>
                )}
              </div>
            ))}
          </motion.div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-[#0e1726] border border-white/[0.07] rounded-2xl p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Allocation</p>
                <span className="text-[10px] text-slate-600">{activeHoldings.length} positions</span>
              </div>
              <PortfolioPieChart holdings={activeHoldings} />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-[#0e1726] border border-white/[0.07] rounded-2xl p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Performance</p>
                  <p className="text-[10px] text-slate-600 mt-0.5">
                    {chartView === "gain" ? "Total gain % since purchase" : "Outperformance vs S&P 500"}
                  </p>
                </div>
                <div className="flex rounded-lg border border-white/[0.07] overflow-hidden">
                  {(["gain", "alpha"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setChartView(v)}
                      className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                        chartView === v ? "bg-accent-blue/20 text-accent-blue" : "text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      {v === "gain" ? "Gain %" : "Alpha"}
                    </button>
                  ))}
                </div>
              </div>
              <GainBarChart holdings={activeHoldings} metric={chartView === "gain" ? "gain_pct" : "alpha"} />
            </motion.div>
          </div>

          {/* Performers — rich cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: "Top Performers", list: topPerformers, isWinner: true },
              { label: "Underperformers", list: worstPerformers, isWinner: false },
            ].map(({ label, list, isWinner }) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="bg-[#0e1726] border border-white/[0.07] rounded-2xl p-5"
              >
                <div className="flex items-center gap-2 mb-4">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${isWinner ? "bg-gain/10" : "bg-loss/10"}`}>
                    {isWinner
                      ? <ArrowUpRight className="w-3.5 h-3.5 text-gain" />
                      : <ArrowDownRight className="w-3.5 h-3.5 text-loss" />}
                  </div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</p>
                </div>

                <div className="space-y-2">
                  {list.map((h, i) => (
                    <div
                      key={h.ticker}
                      className={`rounded-xl p-3 border ${
                        isWinner
                          ? "bg-gain/[0.04] border-gain/[0.1]"
                          : "bg-loss/[0.04] border-loss/[0.1]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        {/* Left: rank + ticker + name */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-[10px] text-slate-700 font-bold w-4 shrink-0">{i + 1}</span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <TickerLink ticker={h.ticker} className="text-sm font-extrabold" />
                              <RecBadge rec={h.recommendation} small />
                            </div>
                            <p className="text-[10px] text-slate-500 truncate max-w-[120px]">{h.name}</p>
                          </div>
                        </div>

                        {/* Right: price + today's change */}
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-white font-mono">{formatCurrency(h.price)}</p>
                          <p className={`text-[11px] font-mono ${gainColor(h.change_pct)}`}>
                            {h.change_pct >= 0 ? "+" : ""}{h.change_pct.toFixed(2)}% today
                          </p>
                        </div>
                      </div>

                      {/* Stats row */}
                      <div className="grid grid-cols-3 gap-1.5 mt-2.5">
                        {[
                          { label: "All-time",   value: formatPct(h.gain_pct),    color: gainColor(h.gain_pct) },
                          { label: "Alpha",      value: formatPct(h.alpha * 100), color: gainColor(h.alpha) },
                          { label: "Value",      value: h.current_value >= 1000 ? `$${(h.current_value/1000).toFixed(1)}K` : formatCurrency(h.current_value), color: "text-slate-300" },
                        ].map(({ label, value, color }) => (
                          <div key={label} className="bg-black/20 rounded-lg p-1.5 text-center">
                            <p className={`text-xs font-bold font-mono ${color}`}>{value}</p>
                            <p className="text-[9px] text-slate-600 uppercase tracking-wider">{label}</p>
                          </div>
                        ))}
                      </div>

                      {/* 52W range mini bar */}
                      {h.week_52_low && h.week_52_high && h.week_52_high > h.week_52_low && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <span className="text-[9px] text-slate-700 font-mono">{formatCurrency(h.week_52_low)}</span>
                          <div className="relative flex-1 h-1 bg-slate-800 rounded-full">
                            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-loss via-amber-500 to-gain opacity-50" />
                            <div
                              className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white border border-[#0e1726] z-10"
                              style={{
                                left: `calc(${Math.min(100, Math.max(0, (h.price - h.week_52_low) / (h.week_52_high - h.week_52_low) * 100))}% - 4px)`,
                              }}
                            />
                          </div>
                          <span className="text-[9px] text-slate-700 font-mono">{formatCurrency(h.week_52_high)}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Holdings table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-slate-500" />
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  {signalFilter === "all" ? "All Positions" : signalFilter === "buy" ? "Buy Signals" : "Sell Signals"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {signalFilter !== "all" && (
                  <button
                    onClick={() => setSignalFilter("all")}
                    className="text-[10px] text-accent-blue hover:text-blue-300 transition-colors"
                  >
                    Clear filter
                  </button>
                )}
                <p className="text-[10px] text-slate-600">Click row to expand · Click headers to sort · Eye icon to exclude</p>
              </div>
            </div>
            <HoldingsTable
              holdings={signalFilteredHoldings}
              portfolio={portfolio}
              onRefresh={() => qc.invalidateQueries({ queryKey: ["portfolio", portfolio] })}
              excluded={excluded}
              onToggleExclude={toggleExclude}
            />
          </div>
        </div>
      )}

      {/* === ANALYTICS TAB === */}
      {activeTab === "analytics" && !isLoading && (
        <MetricsPanel holdings={activeHoldings} delay={0.05} summary={alphaSummary} />
      )}

      {/* === RECOMMENDATIONS TAB === */}
      {activeTab === "recommendations" && !isLoading && (
        <RecommendationsPanel holdings={activeHoldings} portfolio={portfolio} delay={0.05} />
      )}

      {/* === CLOSED POSITIONS TAB === */}
      {activeTab === "closed" && !isLoading && (
        <ClosedPositionsTable portfolio={portfolio} />
      )}

      {/* Loading state for tabs */}
      {isLoading && activeTab === "overview" && (
        <div className="bg-[#0e1726] border border-white/[0.07] rounded-2xl p-5">
          <SkeletonTable rows={6} />
        </div>
      )}

      {showAdd && (
        <AddPositionModal
          portfolio={portfolio}
          onClose={() => setShowAdd(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ["portfolio", portfolio] })}
        />
      )}

      {signalsModal && (
        <SignalsModal
          kind={signalsModal}
          holdings={
            signalsModal === "buy"
              ? activeHoldings.filter((h) => h.recommendation === "STRONG BUY" || h.recommendation === "BUY")
              : activeHoldings.filter((h) => h.recommendation === "SELL"  || h.recommendation === "STRONG SELL")
          }
          totalValue={activeHoldings.reduce((s, h) => s + h.current_value, 0)}
          onClose={() => setSignalsModal(null)}
        />
      )}
    </div>
  );
}
