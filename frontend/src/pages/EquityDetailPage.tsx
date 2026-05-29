import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  ArrowLeft, ExternalLink, TrendingUp, TrendingDown, Newspaper, CheckCircle2, AlertTriangle, Sparkles, Target,
} from "lucide-react";
import { api } from "@/api/client";
import { cn, formatCurrency, formatPct, formatMarketCap, gainColor, gainBg } from "@/lib/utils";
import { assessFit, loadPlannerInput } from "@/lib/portfolioFit";
import type { FitVerdict, NewsItem } from "@/types";

const PERIODS = [
  { label: "1D", value: "1d" },
  { label: "5D", value: "5d" },
  { label: "1M", value: "1mo" },
  { label: "6M", value: "6mo" },
  { label: "1Y", value: "1y" },
  { label: "3Y", value: "3y" },
  { label: "5Y", value: "5y" },
];

const VERDICT_STYLES: Record<FitVerdict, { color: string; bg: string; icon: React.ElementType }> = {
  "STRONG FIT": { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30", icon: CheckCircle2 },
  "FIT":        { color: "text-green-400",   bg: "bg-green-500/10 border-green-500/30",   icon: CheckCircle2 },
  "NEUTRAL":    { color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/30",   icon: Target },
  "POOR FIT":   { color: "text-orange-400",  bg: "bg-orange-500/10 border-orange-500/30", icon: AlertTriangle },
  "AVOID":      { color: "text-red-400",     bg: "bg-red-500/10 border-red-500/30",       icon: AlertTriangle },
};

function fmtPctMaybe(value: number | null | undefined, digits = 1): string {
  if (value == null) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function ratioPct(value: number | null | undefined, digits = 1): string {
  if (value == null) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!t || Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${Math.max(1, m)}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function EquityDetailPage() {
  const { ticker = "" } = useParams<{ ticker: string }>();
  const upper = ticker.toUpperCase();
  const [period, setPeriod] = useState("1y");

  const quoteQ = useQuery({
    queryKey: ["quote", upper],
    queryFn: () => api.getQuote(upper),
    staleTime: 60_000,
  });

  const historyQ = useQuery({
    queryKey: ["history", upper, period],
    queryFn: () => api.getHistory(upper, period),
    staleTime: 60_000,
  });

  const newsQ = useQuery({
    queryKey: ["ticker-news", upper],
    queryFn: () => api.getTickerNews(upper, 4),
    staleTime: 5 * 60_000,
  });

  const portfolioQ = useQuery({
    queryKey: ["all-portfolios"],
    queryFn: api.getAllPortfolios,
    staleTime: 60_000,
  });

  const quote = quoteQ.data;
  const history = historyQ.data?.history ?? [];
  const news = newsQ.data?.items ?? [];
  const allHoldings = portfolioQ.data?.all_holdings ?? [];

  const periodGain = useMemo(() => {
    if (history.length < 2) return null;
    const start = history[0].close;
    const end = history[history.length - 1].close;
    return { dollar: end - start, pct: ((end - start) / start) * 100 };
  }, [history]);

  const fit = useMemo(() => {
    if (!quote) return null;
    const planner = loadPlannerInput();
    return assessFit(quote, allHoldings, planner);
  }, [quote, allHoldings]);

  if (quoteQ.isLoading || !quote) {
    return (
      <div className="p-6 max-w-[1400px] mx-auto">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 mb-4">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </Link>
        <div className="h-96 flex items-center justify-center text-slate-600">Loading {upper}…</div>
      </div>
    );
  }

  if (!quote.price && quote.name === upper) {
    return (
      <div className="p-6 max-w-[1400px] mx-auto">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 mb-4">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </Link>
        <div className="bg-[#0e1726] border border-white/[0.07] rounded-2xl p-8 text-center">
          <p className="text-sm text-slate-400">Could not find data for ticker <span className="font-mono text-white">{upper}</span></p>
        </div>
      </div>
    );
  }

  const isPositive = quote.change >= 0;
  const offHighPct = quote.week_52_high && quote.price > 0
    ? ((quote.week_52_high - quote.price) / quote.week_52_high) * 100
    : null;
  const targetUpsidePct = quote.target_mean && quote.price > 0
    ? ((quote.target_mean - quote.price) / quote.price) * 100
    : null;
  const volRatio = quote.volume && quote.avg_volume ? quote.volume / quote.avg_volume : null;

  // Top 15 metrics, ordered by importance
  const metrics: { label: string; value: string; sub?: string; color?: string }[] = [
    { label: "Market Cap", value: formatMarketCap(quote.market_cap) },
    { label: "P/E (TTM)", value: quote.pe_ratio != null ? `${quote.pe_ratio.toFixed(1)}x` : "—",
      color: quote.pe_ratio && quote.pe_ratio < 20 ? "text-gain" : quote.pe_ratio && quote.pe_ratio > 50 ? "text-loss" : "" },
    { label: "Forward P/E", value: quote.forward_pe != null ? `${quote.forward_pe.toFixed(1)}x` : "—" },
    { label: "PEG Ratio", value: quote.peg_ratio != null ? quote.peg_ratio.toFixed(2) : "—",
      color: quote.peg_ratio && quote.peg_ratio < 1 ? "text-gain" : quote.peg_ratio && quote.peg_ratio > 2 ? "text-loss" : "" },
    { label: "EPS (TTM)", value: quote.eps != null ? `$${quote.eps.toFixed(2)}` : "—" },
    { label: "Dividend Yield", value: ratioPct(quote.dividend_yield, 2) },
    { label: "Beta", value: quote.beta != null ? quote.beta.toFixed(2) : "—",
      color: quote.beta && quote.beta > 1.5 ? "text-amber-400" : "" },
    { label: "52W High", value: quote.week_52_high != null ? formatCurrency(quote.week_52_high) : "—",
      sub: offHighPct != null ? `${offHighPct.toFixed(1)}% below` : undefined },
    { label: "52W Low", value: quote.week_52_low != null ? formatCurrency(quote.week_52_low) : "—" },
    { label: "50D MA", value: quote.ma_50 != null ? formatCurrency(quote.ma_50) : "—",
      sub: quote.ma_50 ? fmtPctMaybe(((quote.price - quote.ma_50) / quote.ma_50) * 100) : undefined,
      color: quote.ma_50 && quote.price > quote.ma_50 ? "text-gain" : quote.ma_50 ? "text-loss" : "" },
    { label: "200D MA", value: quote.ma_200 != null ? formatCurrency(quote.ma_200) : "—",
      sub: quote.ma_200 ? fmtPctMaybe(((quote.price - quote.ma_200) / quote.ma_200) * 100) : undefined,
      color: quote.ma_200 && quote.price > quote.ma_200 ? "text-gain" : quote.ma_200 ? "text-loss" : "" },
    { label: "Volume", value: quote.volume != null ? quote.volume.toLocaleString() : "—",
      sub: volRatio != null ? `${volRatio.toFixed(1)}× avg` : undefined,
      color: volRatio != null && volRatio > 1.5 ? "text-amber-400" : "" },
    { label: "Profit Margin", value: ratioPct(quote.profit_margin, 1) },
    { label: "ROE", value: ratioPct(quote.roe, 1),
      color: quote.roe && quote.roe > 0.2 ? "text-gain" : "" },
    { label: "Analyst Target", value: quote.target_mean != null ? formatCurrency(quote.target_mean) : "—",
      sub: targetUpsidePct != null ? fmtPctMaybe(targetUpsidePct, 1) + " upside" : undefined,
      color: targetUpsidePct != null && targetUpsidePct > 10 ? "text-gain" : targetUpsidePct != null && targetUpsidePct < -5 ? "text-loss" : "" },
  ];

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-5">
      {/* Header strip */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1.5">
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </Link>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-3xl font-extrabold text-white tracking-tight">{upper}</span>
            {quote.sector && (
              <span className="text-[11px] text-slate-400 px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.07]">
                {quote.sector}
              </span>
            )}
            {quote.industry && (
              <span className="text-[11px] text-slate-500">{quote.industry}</span>
            )}
          </div>
          <p className="text-sm text-slate-400">{quote.name}</p>
        </div>

        {/* Price block */}
        <div className="text-right">
          <p className="text-3xl font-extrabold text-white font-mono leading-none">
            {formatCurrency(quote.price)}
          </p>
          <p className={cn("text-sm font-mono mt-1", gainColor(quote.change))}>
            {quote.change >= 0 ? "+" : ""}{formatCurrency(quote.change)} ({formatPct(quote.change_pct)}) today
          </p>
        </div>
      </div>

      {/* Chart card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#0e1726] border border-white/[0.07] rounded-2xl p-5"
      >
        <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
          <div className="flex items-center gap-1">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                  period === p.value
                    ? "bg-accent-blue/20 text-accent-blue"
                    : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          {periodGain && (
            <div className="text-right">
              <p className="text-[10px] text-slate-600 uppercase tracking-widest">Period gain</p>
              <p className={cn("text-sm font-bold font-mono", gainColor(periodGain.dollar))}>
                {periodGain.dollar >= 0 ? "+" : ""}{formatCurrency(periodGain.dollar)} ({formatPct(periodGain.pct)})
              </p>
            </div>
          )}
        </div>

        {historyQ.isLoading ? (
          <div className="h-72 flex items-center justify-center text-slate-600 text-sm">Loading chart…</div>
        ) : history.length === 0 ? (
          <div className="h-72 flex items-center justify-center text-slate-600 text-sm">
            No data available for this period.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={history} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`detail-grad-${upper}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="date"
                tick={{ fill: "#475569", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                tickFormatter={(d: string) => {
                  if (period === "1d" && d.includes(" ")) return d.split(" ")[1] ?? d;
                  return d.slice(5, 10);
                }}
              />
              <YAxis
                tick={{ fill: "#475569", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={60}
                tickFormatter={(v) => `$${v.toFixed(0)}`}
                domain={["auto", "auto"]}
              />
              <Tooltip
                contentStyle={{ background: "#03060f", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: "#e2e8f0" }}
                formatter={(v: number) => [formatCurrency(v), "Close"]}
              />
              <Area
                type="monotone"
                dataKey="close"
                stroke={isPositive ? "#22c55e" : "#ef4444"}
                strokeWidth={1.8}
                fill={`url(#detail-grad-${upper})`}
              />
              {quote.ma_200 && period !== "1d" && period !== "5d" && (
                <ReferenceLine y={quote.ma_200} stroke="#64748b" strokeDasharray="3 3" />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </motion.div>

      {/* Key Metrics grid */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-3">Key Metrics</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {metrics.map((m) => (
            <div key={m.label} className="bg-[#0e1726] border border-white/[0.07] rounded-xl p-3">
              <p className="text-[9px] text-slate-600 uppercase tracking-wider mb-1">{m.label}</p>
              <p className={cn("text-sm font-bold font-mono", m.color || "text-white")}>{m.value}</p>
              {m.sub && <p className="text-[10px] text-slate-500 mt-0.5">{m.sub}</p>}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Fit for My Portfolio */}
      {fit && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={cn("rounded-2xl border p-5", VERDICT_STYLES[fit.verdict].bg)}
        >
          <div className="flex items-start gap-4 flex-wrap">
            <div className={cn("w-10 h-10 rounded-xl border flex items-center justify-center shrink-0", VERDICT_STYLES[fit.verdict].bg)}>
              {(() => {
                const Icon = VERDICT_STYLES[fit.verdict].icon;
                return <Icon className={cn("w-5 h-5", VERDICT_STYLES[fit.verdict].color)} />;
              })()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn("text-xs font-bold tracking-wider uppercase", VERDICT_STYLES[fit.verdict].color)}>
                  {fit.verdict}
                </span>
                <span className="text-[10px] text-slate-500">for your portfolio{loadPlannerInput() ? " + retirement plan" : ""}</span>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed mt-1">{fit.summary}</p>

              {fit.already_owned.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {fit.already_owned.map((p, i) => (
                    <div key={i} className="text-[11px] px-2 py-1 rounded-md bg-white/[0.04] border border-white/[0.07] flex items-center gap-2">
                      <span className="text-slate-500">{p.portfolio_label}</span>
                      <span className="font-mono text-slate-300">{p.shares} sh</span>
                      <span className={cn("font-mono", gainColor(p.gain_pct))}>{formatPct(p.gain_pct)}</span>
                      <span className="text-slate-600">·</span>
                      <span className="font-mono text-slate-300">{formatCurrency(p.current_value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {(fit.reasons.length > 0 || fit.concerns.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {fit.reasons.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400 mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" /> Why it fits
                  </p>
                  <ul className="space-y-1.5">
                    {fit.reasons.map((r, i) => (
                      <li key={i} className="text-[12px] text-slate-300 leading-snug flex items-start gap-1.5">
                        <span className="text-emerald-400 shrink-0">✓</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {fit.concerns.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-orange-400 mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="w-3 h-3" /> Considerations
                  </p>
                  <ul className="space-y-1.5">
                    {fit.concerns.map((c, i) => (
                      <li key={i} className="text-[12px] text-slate-300 leading-snug flex items-start gap-1.5">
                        <span className="text-orange-400 shrink-0">!</span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {!loadPlannerInput() && (
            <p className="text-[11px] text-slate-500 mt-4">
              💡 Tip: fill in your details on the <Link to="/planner" className="text-accent-blue hover:underline">Retirement Planner</Link> for retirement-aware fit analysis.
            </p>
          )}
        </motion.div>
      )}

      {/* News */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
            <Newspaper className="w-3 h-3" /> Recent News
          </p>
        </div>
        {newsQ.isLoading ? (
          <div className="text-xs text-slate-600">Loading news…</div>
        ) : news.length === 0 ? (
          <div className="text-xs text-slate-600">No recent news for {upper}.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {news.slice(0, 4).map((item: NewsItem, i: number) => (
              <a
                key={i}
                href={item.link || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="flex gap-3 p-3 rounded-xl bg-[#0e1726] border border-white/[0.07] hover:border-accent-blue/30 hover:bg-[#0f1e38] transition-all group"
              >
                {item.thumbnail ? (
                  <img src={item.thumbnail} alt="" className="w-16 h-16 rounded-lg object-cover bg-slate-800 shrink-0"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }} />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-slate-800/40 shrink-0 flex items-center justify-center">
                    <Newspaper className="w-4 h-4 text-slate-700" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {item.publisher && <span className="text-[10px] text-slate-600 truncate">{item.publisher}</span>}
                    {item.published && <span className="text-[10px] text-slate-700 ml-auto shrink-0">{timeAgo(item.published)}</span>}
                  </div>
                  <p className="text-xs font-semibold text-white leading-snug line-clamp-3 group-hover:text-accent-blue transition-colors">
                    {item.title}
                  </p>
                </div>
                <ExternalLink className="w-3 h-3 text-slate-700 group-hover:text-accent-blue shrink-0" />
              </a>
            ))}
          </div>
        )}
      </motion.div>

      {/* Business summary */}
      {quote.long_business_summary && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-[#0e1726] border border-white/[0.07] rounded-2xl p-5"
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2">About {upper}</p>
          <p className="text-[13px] text-slate-400 leading-relaxed line-clamp-6">
            {quote.long_business_summary}
          </p>
        </motion.div>
      )}
    </div>
  );
}

export default EquityDetailPage;
