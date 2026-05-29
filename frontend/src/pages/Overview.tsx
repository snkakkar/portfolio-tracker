import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  DollarSign, TrendingUp, Activity, TrendingDown, ChevronRight,
  BarChart2, Shield, PieChart as PieIcon, Award, Zap, Compass,
  RefreshCw, LayoutGrid, Newspaper,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis,
} from "recharts";
import { api } from "@/api/client";
import { SummaryCard } from "@/components/SummaryCard";
import { RecBadge } from "@/components/RecBadge";
import { StockDiscovery } from "@/components/StockDiscovery";
import { AnalystReport } from "@/components/AnalystReport";
import { SkeletonCard } from "@/components/Skeleton";
import { PortfolioNews } from "@/components/PortfolioNews";
import { SignalsModal } from "@/components/SignalsModal";
import { formatCurrency, formatPct, gainColor, pieColors, formatMarketCap } from "@/lib/utils";
import type { Holding } from "@/types";

const PORTFOLIO_ROUTES: Record<string, string> = {
  stocks: "/stocks",
  etfs: "/etfs",
  retirement_stocks: "/retirement-stocks",
  retirement_etfs: "/retirement-etfs",
};

const PORTFOLIO_ICONS: Record<string, React.ElementType> = {
  stocks: TrendingUp,
  etfs: BarChart2,
  retirement_stocks: Shield,
  retirement_etfs: PieIcon,
};

const AllocationTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-[#03060f] border border-white/[0.07] rounded-xl px-3 py-2 text-xs shadow-card">
      <p className="font-semibold text-white mb-1">{d.label}</p>
      <p className="text-accent-blue font-mono">{formatCurrency(d.value)}</p>
      <p className="text-slate-500">{d.pct.toFixed(1)}% of portfolio</p>
    </div>
  );
};

type DashTab = "overview" | "analytics" | "discover" | "news";

export function Overview() {
  const [activeTab, setActiveTab] = useState<DashTab>("overview");
  const [signalsModal, setSignalsModal] = useState<"buy" | "sell" | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["all-portfolios"],
    queryFn: api.getAllPortfolios,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  if (isError) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-400 mb-2">Failed to load overview</p>
          <button onClick={() => refetch()} className="text-sm text-accent-blue hover:underline">Retry</button>
        </div>
      </div>
    );
  }

  const summary     = data?.overall_summary;
  const portfolios  = data?.portfolios ?? {};
  const topPerfs    = data?.top_performers ?? [];
  const worstPerfs  = data?.worst_performers ?? [];
  const allHoldings = data?.all_holdings ?? [];

  const totalValue = summary?.total_value ?? 0;

  // Allocation data
  const allocationData = Object.entries(portfolios).map(([key, p], i) => ({
    key,
    label: p.label,
    value: p.summary.total_value,
    pct: totalValue > 0 ? (p.summary.total_value / totalValue) * 100 : 0,
    color: pieColors(i),
  }));

  // Rec distribution
  const recCounts = allHoldings.reduce<Record<string, number>>((acc, h) => {
    acc[h.recommendation] = (acc[h.recommendation] || 0) + 1;
    return acc;
  }, {});
  const recData = [
    { label: "STRONG BUY", count: recCounts["STRONG BUY"] || 0, color: "#10b981" },
    { label: "BUY",        count: recCounts["BUY"] || 0,        color: "#22c55e" },
    { label: "HOLD",       count: recCounts["HOLD"] || 0,       color: "#f59e0b" },
    { label: "SELL",       count: recCounts["SELL"] || 0,       color: "#f97316" },
    { label: "STRONG SELL",count: recCounts["STRONG SELL"] || 0,color: "#ef4444" },
  ].filter((d) => d.count > 0);

  const topByValue = [...allHoldings].sort((a, b) => b.current_value - a.current_value).slice(0, 10);

  // Cross-portfolio stats
  const winners    = allHoldings.filter((h) => h.gain > 0).length;
  const losers     = allHoldings.filter((h) => h.gain < 0).length;
  const winRate    = allHoldings.length ? (winners / allHoldings.length) * 100 : 0;
  const outperfSP  = allHoldings.filter((h) => h.alpha > 0).length;
  const betaHoldings = allHoldings.filter((h) => h.beta != null && h.beta !== 0);
  const portBeta   = betaHoldings.length > 0
    ? betaHoldings.reduce((s, h) => s + (h.beta! * h.current_value), 0) / totalValue
    : null;

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">All accounts combined · Live market data</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/[0.07] bg-white/[0.03] text-slate-400 hover:text-white text-sm transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <SummaryCard
              label="Total Portfolio Value"
              value={summary?.total_value ?? 0}
              valueType="currency"
              sub2={`${allHoldings.length} positions across 4 accounts`}
              icon={DollarSign}
              accent
              delay={0}
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
              label="Today's P&L"
              value={summary?.todays_gain ?? 0}
              valueType="currency"
              sub={allHoldings.length ? `${allHoldings.filter((h) => h.change > 0).length} up, ${allHoldings.filter((h) => h.change < 0).length} down` : undefined}
              icon={Activity}
              trend={summary?.todays_gain}
              delay={0.1}
              iconColor={summary?.todays_gain! >= 0 ? "text-gain" : "text-loss"}
              iconBg={summary?.todays_gain! >= 0 ? "bg-gain/10" : "bg-loss/10"}
            />
            <SummaryCard
              label="Win Rate"
              value={`${winRate.toFixed(0)}%`}
              sub={`${winners} winners / ${losers} losers`}
              sub2={portBeta != null ? `Portfolio beta: ${portBeta.toFixed(2)}` : undefined}
              icon={Award}
              delay={0.15}
              iconColor={winRate >= 60 ? "text-amber-400" : "text-slate-400"}
              iconBg={winRate >= 60 ? "bg-amber-400/10" : "bg-white/[0.05]"}
            />
          </>
        )}
      </div>

      {/* Stat pills row */}
      {!isLoading && allHoldings.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-wrap gap-3"
        >
          {[
            {
              label: "Cumulative α",
              value: summary?.cumulative_alpha_dollar != null
                ? formatCurrency(summary.cumulative_alpha_dollar)
                : "—",
              color: gainColor(summary?.cumulative_alpha_dollar ?? 0),
              bg: (summary?.cumulative_alpha_dollar ?? 0) >= 0
                ? "bg-gain/10 border-gain/20"
                : "bg-loss/10 border-loss/20",
            },
            {
              label: "Weighted α",
              value: summary?.weighted_alpha_pct != null
                ? `${summary.weighted_alpha_pct >= 0 ? "+" : ""}${summary.weighted_alpha_pct.toFixed(1)}%`
                : "—",
              color: gainColor(summary?.weighted_alpha_pct ?? 0),
              bg: "bg-white/[0.04] border-white/[0.07]",
            },
            { label: "Beat S&P 500", value: `${outperfSP}/${allHoldings.length}`, color: "text-accent-blue", bg: "bg-accent-blue/10 border-accent-blue/20" },
            {
              label: "Cost Basis",
              value: summary?.total_cost != null
                ? (summary.total_cost >= 1_000_000
                    ? `$${(summary.total_cost / 1_000_000).toFixed(2)}M`
                    : formatCurrency(summary.total_cost))
                : "—",
              color: "text-slate-300",
              bg: "bg-white/[0.04] border-white/[0.07]",
            },
            {
              label: "Portfolio Beta",
              value: portBeta != null ? portBeta.toFixed(2) : "—",
              color: portBeta != null && portBeta > 1.3 ? "text-amber-400" : "text-slate-300",
              bg: "bg-white/[0.04] border-white/[0.07]",
            },
            {
              label: "Accounts",
              value: Object.keys(portfolios).length.toString(),
              color: "text-slate-300",
              bg: "bg-white/[0.04] border-white/[0.07]",
            },
            {
              label: "Buy Signals",
              value: `${(recCounts["STRONG BUY"] || 0) + (recCounts["BUY"] || 0)}`,
              color: "text-gain",
              bg: "bg-gain/10 border-gain/20",
              click: "buy" as const,
            },
            {
              label: "Sell Signals",
              value: `${(recCounts["SELL"] || 0) + (recCounts["STRONG SELL"] || 0)}`,
              color: "text-loss",
              bg: "bg-loss/10 border-loss/20",
              click: "sell" as const,
            },
          ].map(({ label, value, color, bg, click }) => (
            <div key={label} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs ${bg}`}>
              <span className="text-slate-500">{label}:</span>
              {click ? (
                <button
                  onClick={() => setSignalsModal(click)}
                  className={`font-bold font-mono underline underline-offset-2 hover:text-white transition-colors ${color}`}
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
      )}

      {/* Account cards */}
      {!isLoading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Object.entries(portfolios).map(([key, p], i) => {
            const Icon = PORTFOLIO_ICONS[key] || TrendingUp;
            const route = PORTFOLIO_ROUTES[key] || "/";
            const holds = p.holdings ?? [];
            const winR = holds.length ? (holds.filter((h: Holding) => h.gain > 0).length / holds.length * 100).toFixed(0) : "—";
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.06 }}
              >
                <Link
                  to={route}
                  className="block bg-[#0e1726] border border-white/[0.07] rounded-2xl p-4 hover:border-accent-blue/30 hover:bg-[#0f1e38] transition-all group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-accent-blue/10 flex items-center justify-center">
                        <Icon className="w-3.5 h-3.5 text-accent-blue" />
                      </div>
                      <p className="text-xs font-semibold text-slate-300 leading-tight">{p.label}</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-700 group-hover:text-accent-blue transition-colors" />
                  </div>
                  <p className="text-xl font-extrabold text-white font-mono">{
                    p.summary.total_value >= 1_000_000
                      ? `$${(p.summary.total_value / 1_000_000).toFixed(2)}M`
                      : formatCurrency(p.summary.total_value)
                  }</p>
                  <p className={`text-xs mt-1 font-mono font-semibold ${gainColor(p.summary.total_gain)}`}>
                    {p.summary.total_gain >= 0 ? "+" : ""}{formatCurrency(p.summary.total_gain)}
                    <span className="text-slate-500 font-normal"> ({formatPct(p.summary.gain_pct)})</span>
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <p className={`text-[11px] ${gainColor(p.summary.todays_gain)}`}>
                      Today {p.summary.todays_gain >= 0 ? "+" : ""}{formatCurrency(p.summary.todays_gain)}
                    </p>
                    <p className="text-[10px] text-slate-600">{winR}% win</p>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Tab nav */}
      {!isLoading && (
        <div className="flex gap-1 p-1 bg-[#0a1628] rounded-xl border border-white/[0.05] w-fit">
          {[
            { id: "overview"  as DashTab, label: "Overview",       icon: LayoutGrid },
            { id: "analytics" as DashTab, label: "Analytics",      icon: BarChart2 },
            { id: "discover"  as DashTab, label: "Stock Discovery", icon: Compass },
            { id: "news"      as DashTab, label: "Portfolio News",  icon: Newspaper },
          ].map(({ id, label, icon: Icon }) => (
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

      {/* === OVERVIEW TAB — Total Portfolio Analyst Report === */}
      {activeTab === "overview" && !isLoading && allHoldings.length > 0 && (
        <AnalystReport
          holdings={allHoldings}
          label="Total Portfolio"
          summary={summary ? {
            cumulative_alpha_dollar: summary.cumulative_alpha_dollar,
            weighted_alpha_pct: summary.weighted_alpha_pct,
          } : null}
        />
      )}

      {/* === ANALYTICS TAB === */}
      {activeTab === "analytics" && !isLoading && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Allocation pie */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="bg-[#0e1726] border border-white/[0.07] rounded-2xl p-5"
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-4">Account Allocation</p>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={allocationData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" nameKey="label">
                    {allocationData.map((d, i) => (
                      <Cell key={i} fill={d.color} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip content={<AllocationTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {allocationData.map((d) => (
                  <div key={d.key} className="flex items-center gap-2 text-xs">
                    <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-slate-400 flex-1 truncate">{d.label}</span>
                    <span className="text-slate-300 font-mono font-semibold">{d.pct.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Rec distribution */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-[#0e1726] border border-white/[0.07] rounded-2xl p-5"
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-4">Signal Distribution</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={recData} layout="vertical" margin={{ left: 0, right: 12 }}>
                  <XAxis type="number" tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="label" tick={{ fill: "#94a3b8", fontSize: 9 }} axisLine={false} tickLine={false} width={80} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {recData.map((d, i) => <Cell key={i} fill={d.color} fillOpacity={0.85} />)}
                  </Bar>
                  <Tooltip
                    formatter={(v: number) => [`${v} positions`, ""]}
                    contentStyle={{ background: "#03060f", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, fontSize: 11 }}
                    labelStyle={{ color: "#e2e8f0" }}
                  />
                </BarChart>
              </ResponsiveContainer>
              <p className="text-center text-[10px] text-slate-600 mt-2">{allHoldings.length} total positions</p>
            </motion.div>

            {/* Largest positions */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="bg-[#0e1726] border border-white/[0.07] rounded-2xl p-5"
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-4">Largest Positions</p>
              <div className="space-y-2.5">
                {topByValue.map((h, i) => (
                  <div key={`${h.ticker}-${i}`} className="flex items-center gap-2">
                    <span className="text-[9px] text-slate-600 w-4 shrink-0">{i + 1}</span>
                    <span className="font-mono font-bold text-xs text-white w-12 shrink-0">{h.ticker}</span>
                    <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent-blue/70 rounded-full"
                        style={{ width: `${(h.current_value / topByValue[0].current_value) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-slate-400 shrink-0 w-16 text-right">
                      {h.current_value >= 1_000 ? `$${(h.current_value / 1_000).toFixed(1)}K` : formatCurrency(h.current_value)}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Top / Worst performers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: "Top 5 Performers", list: topPerfs, isWinner: true },
              { label: "Bottom 5 Performers", list: worstPerfs, isWinner: false },
            ].map(({ label, list, isWinner }) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-[#0e1726] border border-white/[0.07] rounded-2xl p-5"
              >
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-4">{label}</p>
                <div className="space-y-3">
                  {list.map((h) => (
                    <div key={`${h.ticker}-${h.portfolio}`} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isWinner ? "bg-gain/10" : "bg-loss/10"}`}>
                        {isWinner
                          ? <TrendingUp className="w-3.5 h-3.5 text-gain" />
                          : <TrendingDown className="w-3.5 h-3.5 text-loss" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Link
                            to={`/equity/${h.ticker}`}
                            className="font-mono font-bold text-sm text-white hover:text-accent-blue hover:underline underline-offset-2"
                          >
                            {h.ticker}
                          </Link>
                          <span className="text-[10px] text-slate-600 bg-slate-800/60 rounded px-1.5 py-0.5">{h.portfolio_label}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">{h.name}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold font-mono ${gainColor(h.gain_pct)}`}>{formatPct(h.gain_pct)}</p>
                        <p className={`text-xs font-mono ${gainColor(h.gain)}`}>{formatCurrency(h.gain)}</p>
                      </div>
                      <RecBadge rec={h.recommendation} small />
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* === DISCOVER TAB === */}
      {activeTab === "discover" && !isLoading && <StockDiscovery />}

      {/* === PORTFOLIO NEWS TAB === */}
      {activeTab === "news" && !isLoading && <PortfolioNews />}

      {signalsModal && (
        <SignalsModal
          kind={signalsModal}
          holdings={
            signalsModal === "buy"
              ? allHoldings.filter((h) => h.recommendation === "STRONG BUY" || h.recommendation === "BUY")
              : allHoldings.filter((h) => h.recommendation === "SELL"  || h.recommendation === "STRONG SELL")
          }
          totalValue={allHoldings.reduce((s, h) => s + h.current_value, 0)}
          onClose={() => setSignalsModal(null)}
        />
      )}
    </div>
  );
}
