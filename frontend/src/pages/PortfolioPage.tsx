import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  DollarSign, TrendingUp, TrendingDown, Activity, Plus, RefreshCw,
  BarChart2, Award, Zap, LayoutGrid, BookOpen, Target,
} from "lucide-react";
import { api } from "@/api/client";
import { SummaryCard } from "@/components/SummaryCard";
import { HoldingsTable } from "@/components/HoldingsTable";
import { PortfolioPieChart } from "@/components/PortfolioPieChart";
import { GainBarChart } from "@/components/GainBarChart";
import { RecBadge } from "@/components/RecBadge";
import { MetricsPanel } from "@/components/MetricsPanel";
import { RecommendationsPanel } from "@/components/RecommendationsPanel";
import { AddPositionModal } from "@/components/AddPositionModal";
import { SkeletonCard, SkeletonTable } from "@/components/Skeleton";
import { formatCurrency, formatPct, gainColor } from "@/lib/utils";
import type { PortfolioKey } from "@/types";

interface Props {
  portfolio: PortfolioKey;
}

type Tab = "overview" | "analytics" | "recommendations";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "overview",        label: "Overview",        icon: LayoutGrid },
  { id: "analytics",       label: "Analytics",       icon: BarChart2 },
  { id: "recommendations", label: "Recommendations", icon: Target },
];

export function PortfolioPage({ portfolio }: Props) {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [chartView, setChartView] = useState<"gain" | "alpha">("gain");
  const [activeTab, setActiveTab] = useState<Tab>("overview");

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

  const sorted = [...holdings].sort((a, b) => b.gain_pct - a.gain_pct);
  const topPerformers   = sorted.slice(0, 5);
  const worstPerformers = sorted.slice(-5).reverse();

  // Weighted avg annualized return
  const totalValue = holdings.reduce((s, h) => s + h.current_value, 0);
  const winners = holdings.filter((h) => h.gain > 0).length;
  const winRate = holdings.length ? (winners / holdings.length) * 100 : 0;

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

      {/* Summary cards — always visible */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <SummaryCard
              label="Total Value"
              value={summary?.total_value ?? 0}
              valueType="currency"
              sub2={`Cost basis ${formatCurrency(summary?.total_cost ?? 0)}`}
              icon={DollarSign}
              delay={0}
              accent
              iconColor="text-accent-blue"
              iconBg="bg-accent-blue/20"
            />
            <SummaryCard
              label="Total Gain"
              value={summary?.total_gain ?? 0}
              valueType="currency"
              sub={formatPct(summary?.gain_pct ?? 0)}
              icon={TrendingUp}
              trend={summary?.total_gain}
              delay={0.05}
              iconColor={summary?.total_gain! >= 0 ? "text-gain" : "text-loss"}
              iconBg={summary?.total_gain! >= 0 ? "bg-gain/10" : "bg-loss/10"}
            />
            <SummaryCard
              label="Today's Gain"
              value={summary?.todays_gain ?? 0}
              valueType="currency"
              sub={holdings.length ? `${holdings.filter((h) => h.change > 0).length}↑  ${holdings.filter((h) => h.change < 0).length}↓` : undefined}
              icon={Activity}
              trend={summary?.todays_gain}
              delay={0.1}
              iconColor={summary?.todays_gain! >= 0 ? "text-gain" : "text-loss"}
              iconBg={summary?.todays_gain! >= 0 ? "bg-gain/10" : "bg-loss/10"}
            />
            <SummaryCard
              label="Win Rate"
              value={`${winRate.toFixed(0)}%`}
              sub={`${winners} of ${holdings.length} positions profitable`}
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
      {activeTab === "overview" && !isLoading && holdings.length > 0 && (
        <div className="space-y-5">
          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-[#0e1726] border border-white/[0.07] rounded-2xl p-5"
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-4">Portfolio Mix</p>
              <PortfolioPieChart holdings={holdings} />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-[#0e1726] border border-white/[0.07] rounded-2xl p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Performance</p>
                <div className="flex rounded-lg border border-white/[0.07] overflow-hidden">
                  {(["gain", "alpha"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setChartView(v)}
                      className={`px-3 py-1 text-xs font-semibold transition-colors ${
                        chartView === v ? "bg-accent-blue/20 text-accent-blue" : "text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      {v === "gain" ? "Gain %" : "Alpha vs S&P"}
                    </button>
                  ))}
                </div>
              </div>
              <GainBarChart holdings={holdings} metric={chartView === "gain" ? "gain_pct" : "alpha"} />
            </motion.div>
          </div>

          {/* Performers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: "Top Performers", list: topPerformers, isWinner: true },
              { label: "Worst Performers", list: worstPerformers, isWinner: false },
            ].map(({ label, list, isWinner }) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="bg-[#0e1726] border border-white/[0.07] rounded-2xl p-5"
              >
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-4">
                  {label}
                </p>
                <div className="space-y-3">
                  {list.map((h, i) => (
                    <div key={h.ticker} className="flex items-center gap-3">
                      <span className="text-[10px] text-slate-600 w-4 text-center">{i + 1}</span>
                      <span className="w-14 font-mono font-bold text-xs text-white shrink-0">{h.ticker}</span>
                      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isWinner ? "bg-gain" : "bg-loss"}`}
                          style={{ width: `${Math.min(100, Math.abs(h.gain_pct) / 3)}%` }}
                        />
                      </div>
                      <span className={`text-xs font-bold font-mono shrink-0 w-16 text-right ${gainColor(h.gain_pct)}`}>
                        {formatPct(h.gain_pct)}
                      </span>
                      <RecBadge rec={h.recommendation} small />
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Holdings table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">All Holdings</p>
              <p className="text-[10px] text-slate-600">Click row to expand · Click headers to sort</p>
            </div>
            <HoldingsTable
              holdings={holdings}
              portfolio={portfolio}
              onRefresh={() => qc.invalidateQueries({ queryKey: ["portfolio", portfolio] })}
            />
          </div>
        </div>
      )}

      {/* === ANALYTICS TAB === */}
      {activeTab === "analytics" && !isLoading && (
        <MetricsPanel holdings={holdings} delay={0.05} />
      )}

      {/* === RECOMMENDATIONS TAB === */}
      {activeTab === "recommendations" && !isLoading && (
        <div className="space-y-4">
          <div className="bg-[#0a1628] border border-accent-blue/15 rounded-2xl p-4">
            <p className="text-xs text-slate-400 leading-relaxed">
              Recommendations are scored using 7 signals: alpha vs S&P 500, 52-week price position,
              P/E ratio, today's momentum, beta (volatility), market cap, and distance from 52-week high.
              Scores range from −75 to +75. A score ≥ 28 is a <span className="text-gain font-semibold">Buy</span>,
              ≥ 55 is a <span className="text-emerald-400 font-semibold">Strong Buy</span>,
              and below −8 signals a potential exit.
            </p>
          </div>
          <RecommendationsPanel holdings={holdings} delay={0.05} />
        </div>
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
    </div>
  );
}
