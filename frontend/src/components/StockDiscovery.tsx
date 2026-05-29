import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, TrendingDown, Minus, XCircle, ChevronRight, Compass,
  RefreshCw, Filter, ChevronDown,
} from "lucide-react";
import { cn, formatCurrency, formatPct, gainColor, REC_STYLES, formatMarketCap } from "@/lib/utils";
import { api } from "@/api/client";
import type { DiscoverStock, Recommendation } from "@/types";

const REC_ICON: Record<Recommendation, React.ElementType> = {
  "STRONG BUY":  TrendingUp,
  "BUY":         TrendingUp,
  "HOLD":        Minus,
  "SELL":        TrendingDown,
  "STRONG SELL": XCircle,
};

function Range52W({ price, low, high }: { price: number; low: number | null; high: number | null }) {
  if (!low || !high || high === low) return null;
  const pct = Math.min(100, Math.max(0, ((price - low) / (high - low)) * 100));
  return (
    <div className="flex items-center gap-1 mt-1.5">
      <span className="text-[9px] text-slate-600 font-mono w-12 shrink-0">{formatCurrency(low)}</span>
      <div className="relative flex-1 h-1 bg-slate-800 rounded-full">
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-loss via-amber-500 to-gain" />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white border-2 border-[#0a1628] shadow-lg z-10"
          style={{ left: `calc(${pct}% - 5px)` }}
        />
      </div>
      <span className="text-[9px] text-slate-600 font-mono w-12 shrink-0 text-right">{formatCurrency(high)}</span>
    </div>
  );
}

function DiscoverCard({ stock, idx }: { stock: DiscoverStock; idx: number }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = REC_ICON[stock.recommendation];
  const recClass = REC_STYLES[stock.recommendation];

  const isBuy  = stock.recommendation === "STRONG BUY" || stock.recommendation === "BUY";
  const isSell = stock.recommendation === "SELL" || stock.recommendation === "STRONG SELL";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.03 }}
      className={cn(
        "rounded-xl border overflow-hidden transition-all duration-200",
        isBuy  ? "bg-emerald-950/30 border-emerald-500/20" :
        isSell ? "bg-red-950/20 border-red-500/20" :
                 "bg-[#0e1726] border-white/[0.07]"
      )}
    >
      {/* Main row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-3.5 flex items-center gap-3"
      >
        {/* Ticker + name */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to={`/equity/${stock.ticker}`}
              onClick={(e) => e.stopPropagation()}
              className="font-mono font-extrabold text-sm text-white hover:text-accent-blue hover:underline underline-offset-2"
            >
              {stock.ticker}
            </Link>
            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full border flex items-center gap-1", recClass)}>
              <Icon className="w-2.5 h-2.5" />
              {stock.recommendation}
            </span>
            {stock.sector && (
              <span className="text-[9px] text-slate-600 bg-slate-800/60 rounded-full px-2 py-0.5">
                {stock.sector}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 truncate mt-0.5">{stock.name}</p>
        </div>

        {/* Price + change */}
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-white font-mono">{formatCurrency(stock.price)}</p>
          <p className={cn("text-[11px] font-mono", gainColor(stock.change_pct))}>
            {formatPct(stock.change_pct)}
          </p>
        </div>

        {/* Score pill */}
        <div className="text-center w-10 shrink-0">
          <p className={cn("text-sm font-extrabold", stock.rec_score >= 28 ? "text-gain" : stock.rec_score >= -8 ? "text-amber-400" : "text-loss")}>
            {stock.rec_score > 0 ? "+" : ""}{stock.rec_score}
          </p>
          <p className="text-[9px] text-slate-600 uppercase tracking-wider">score</p>
        </div>

        <ChevronDown className={cn("w-4 h-4 text-slate-600 shrink-0 transition-transform", expanded && "rotate-180")} />
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3.5 pb-3.5 space-y-3 border-t border-white/[0.05] pt-3">
              {/* Stats grid */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "1Y Return",  value: formatPct(stock.gain_1y_pct), color: gainColor(stock.gain_1y_pct) },
                  { label: "Alpha 1Y",   value: formatPct(stock.alpha * 100),  color: gainColor(stock.alpha) },
                  { label: "P/E",        value: stock.pe_ratio ? stock.pe_ratio.toFixed(1) + "x" : "—", color: "text-slate-300" },
                  { label: "Beta",       value: stock.beta ? stock.beta.toFixed(2) : "—", color: "text-slate-300" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-black/20 rounded-lg p-2 text-center">
                    <p className={cn("text-xs font-bold font-mono", color)}>{value}</p>
                    <p className="text-[9px] text-slate-600 uppercase tracking-wider">{label}</p>
                  </div>
                ))}
              </div>

              {/* 52W range */}
              <Range52W price={stock.price} low={stock.week_52_low} high={stock.week_52_high} />

              {/* Reasons */}
              <div className="space-y-1">
                {stock.rec_reasons.slice(0, 4).map((r, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <ChevronRight className={cn("w-3 h-3 shrink-0 mt-px", recClass.split(" ")[1])} />
                    <p className="text-[11px] text-slate-400 leading-snug">{r}</p>
                  </div>
                ))}
              </div>

              {stock.market_cap && (
                <p className="text-[10px] text-slate-600">
                  Market cap: {formatMarketCap(stock.market_cap)}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const REC_FILTERS: { label: string; recs: Recommendation[] | null }[] = [
  { label: "All",         recs: null },
  { label: "Strong Buy",  recs: ["STRONG BUY"] },
  { label: "Buy",         recs: ["BUY", "STRONG BUY"] },
  { label: "Hold",        recs: ["HOLD"] },
  { label: "Sell",        recs: ["SELL", "STRONG SELL"] },
];

const SECTOR_ALL = "All Sectors";

export function StockDiscovery() {
  const [recFilter, setRecFilter] = useState<null | Recommendation[]>(["STRONG BUY", "BUY"]);
  const [sectorFilter, setSectorFilter] = useState(SECTOR_ALL);
  const [showCount, setShowCount] = useState(20);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["discover"],
    queryFn: api.discoverStocks,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const allStocks = data?.stocks ?? [];

  // Unique sectors
  const sectors = [SECTOR_ALL, ...Array.from(new Set(allStocks.map((s) => s.sector ?? "Unknown")))];

  const filtered = allStocks.filter((s) => {
    if (recFilter && !recFilter.includes(s.recommendation)) return false;
    if (sectorFilter !== SECTOR_ALL && s.sector !== sectorFilter) return false;
    return true;
  });

  const visible = filtered.slice(0, showCount);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-accent-blue/15 flex items-center justify-center">
            <Compass className="w-4 h-4 text-accent-blue" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Stock Discovery</h3>
            <p className="text-[11px] text-slate-500">
              {isLoading ? "Scanning universe…" : `${filtered.length} opportunities from ${data?.universe_size ?? 0}-stock universe`}
            </p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] text-slate-400 hover:text-white text-xs transition-colors"
        >
          <RefreshCw className={cn("w-3 h-3", isFetching && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex rounded-lg border border-white/[0.07] overflow-hidden">
          {REC_FILTERS.map(({ label, recs }) => (
            <button
              key={label}
              onClick={() => setRecFilter(recs)}
              className={cn(
                "px-3 py-1.5 text-[11px] font-semibold transition-colors",
                JSON.stringify(recFilter) === JSON.stringify(recs)
                  ? "bg-accent-blue/20 text-accent-blue"
                  : "text-slate-500 hover:text-slate-300"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <select
          value={sectorFilter}
          onChange={(e) => setSectorFilter(e.target.value)}
          className="text-xs bg-[#0e1726] border border-white/[0.07] rounded-lg px-3 py-1.5 text-slate-400 focus:outline-none focus:border-accent-blue/40"
        >
          {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Cards */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-white/[0.04] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-slate-600">
          <p className="text-sm">No stocks match the current filters.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((s, i) => (
            <DiscoverCard key={s.ticker} stock={s} idx={i} />
          ))}
          {filtered.length > showCount && (
            <button
              onClick={() => setShowCount((c) => c + 20)}
              className="w-full py-2.5 rounded-xl border border-white/[0.07] text-xs text-slate-500 hover:text-slate-300 hover:bg-white/[0.03] transition-colors"
            >
              Show {Math.min(20, filtered.length - showCount)} more
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
