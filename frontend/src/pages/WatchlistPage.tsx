import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, Eye, TrendingUp, TrendingDown, RefreshCw,
  X, Check, AlertCircle, Loader2, ChevronUp, ChevronDown,
} from "lucide-react";
import { api } from "@/api/client";
import { RecBadge } from "@/components/RecBadge";
import { PriceChart } from "@/components/PriceChart";
import { SkeletonTable } from "@/components/Skeleton";
import {
  formatCurrency, formatPct, gainColor, gainBg, formatMarketCap, cn,
} from "@/lib/utils";
import type { WatchItem } from "@/types";

type SortKey = keyof WatchItem | null;

// ─── Add to watchlist modal ───────────────────────────────────────────────────
function AddWatchModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [ticker, setTicker] = useState("");
  const [trackedPrice, setTrackedPrice] = useState("");
  const [trackedSince, setTrackedSince] = useState(new Date().toISOString().slice(0, 10));
  const [validation, setValidation] = useState<{ valid: boolean; name?: string; price?: number } | null>(null);
  const [validating, setValidating] = useState(false);

  const addMut = useMutation({
    mutationFn: () =>
      api.addToWatchlist(
        ticker,
        trackedPrice ? parseFloat(trackedPrice) : undefined,
        trackedSince
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["watchlist"] });
      onClose();
    },
  });

  // Debounced ticker validation
  useState(() => {});
  const validate = async (t: string) => {
    if (!t) { setValidation(null); return; }
    setValidating(true);
    try {
      const r = await api.validateTicker(t.toUpperCase());
      setValidation(r);
      if (r.valid && r.price && !trackedPrice) setTrackedPrice(r.price.toFixed(2));
    } catch { setValidation({ valid: false }); }
    finally { setValidating(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0e1726] border border-white/[0.08] rounded-2xl p-6 w-full max-w-sm shadow-card mx-4"
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-accent-teal" />
            <h2 className="text-base font-bold text-white">Add to Watchlist</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-400 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Ticker Symbol</label>
            <div className="relative">
              <input
                type="text"
                value={ticker}
                onChange={(e) => { setTicker(e.target.value.toUpperCase()); validate(e.target.value); }}
                placeholder="e.g. TSLA"
                autoFocus
                className="w-full bg-[#080e1a] border border-white/[0.07] rounded-lg px-3 py-2.5 pr-9 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent-teal/60 font-mono"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {validating && <Loader2 className="w-3.5 h-3.5 text-slate-500 animate-spin" />}
                {!validating && validation?.valid && <Check className="w-3.5 h-3.5 text-gain" />}
                {!validating && validation && !validation.valid && <AlertCircle className="w-3.5 h-3.5 text-loss" />}
              </div>
            </div>
            {validation?.valid && (
              <p className="mt-1 text-xs text-gain">{validation.name} — ${validation.price?.toFixed(2)}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
              Reference Price <span className="normal-case text-slate-600">(optional — for tracking performance)</span>
            </label>
            <input
              type="number"
              value={trackedPrice}
              onChange={(e) => setTrackedPrice(e.target.value)}
              placeholder="e.g. 250.00"
              className="w-full bg-[#080e1a] border border-white/[0.07] rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent-teal/60"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Tracking Since</label>
            <input
              type="date"
              value={trackedSince}
              onChange={(e) => setTrackedSince(e.target.value)}
              className="w-full bg-[#080e1a] border border-white/[0.07] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent-teal/60"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-white/[0.07] text-slate-400 hover:text-white text-sm transition-colors">
            Cancel
          </button>
          <button
            onClick={() => addMut.mutate()}
            disabled={!validation?.valid || addMut.isPending}
            className={cn(
              "flex-1 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2",
              validation?.valid && !addMut.isPending
                ? "bg-accent-teal hover:bg-cyan-400 text-navy-900"
                : "bg-slate-700 text-slate-500 cursor-not-allowed"
            )}
          >
            {addMut.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Watch
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main watchlist page ──────────────────────────────────────────────────────
export function WatchlistPage() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("change_pct");
  const [sortAsc, setSortAsc] = useState(false);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["watchlist"],
    queryFn: api.getWatchlist,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const deleteMut = useMutation({
    mutationFn: (ticker: string) => api.removeFromWatchlist(ticker),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["watchlist"] }); setConfirmDelete(null); },
  });

  const items = data?.items ?? [];

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  }

  const sorted = [...items].sort((a, b) => {
    if (!sortKey) return 0;
    const av = a[sortKey] as number | string;
    const bv = b[sortKey] as number | string;
    const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
    return sortAsc ? cmp : -cmp;
  });

  function SortIcon({ col }: { col: string }) {
    if (sortKey !== col) return <ChevronUp className="w-3 h-3 text-slate-700" />;
    return sortAsc ? <ChevronUp className="w-3 h-3 text-accent-teal" /> : <ChevronDown className="w-3 h-3 text-accent-teal" />;
  }

  function Th({ col, label, right = false }: { col: string; label: string; right?: boolean }) {
    return (
      <th
        onClick={() => handleSort(col as SortKey)}
        className={cn(
          "px-3 py-3 text-[10px] font-semibold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap",
          right ? "text-right" : "text-left",
          "text-slate-500 hover:text-slate-300 transition-colors"
        )}
      >
        <span className={cn("inline-flex items-center gap-1", right && "flex-row-reverse")}>
          {label}
          <SortIcon col={col} />
        </span>
      </th>
    );
  }

  // Quick stats
  const gainers = items.filter((i) => i.change_pct > 0).length;
  const losers = items.filter((i) => i.change_pct < 0).length;
  const buySignals = items.filter((i) => i.recommendation === "BUY" || i.recommendation === "STRONG BUY").length;

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-accent-teal" />
            <h1 className="text-2xl font-bold text-white tracking-tight">Watchlist</h1>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            {items.length} stock{items.length !== 1 ? "s" : ""} being monitored · Not a portfolio
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/[0.07] bg-[#0e1726] text-slate-400 hover:text-white text-sm transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-teal hover:bg-cyan-400 text-navy-900 text-sm font-semibold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add to Watchlist
          </button>
        </div>
      </div>

      {/* Quick stats */}
      {!isLoading && items.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Gaining Today", value: gainers, icon: TrendingUp, color: "text-gain", bg: "bg-gain/10" },
            { label: "Losing Today", value: losers, icon: TrendingDown, color: "text-loss", bg: "bg-loss/10" },
            { label: "Buy Signals", value: buySignals, icon: Eye, color: "text-accent-teal", bg: "bg-accent-teal/10" },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-[#0e1726] border border-white/[0.07] rounded-xl p-4 flex items-center gap-4"
            >
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", s.bg)}>
                <s.icon className={cn("w-5 h-5", s.color)} />
              </div>
              <div>
                <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Monitored Stocks</p>
          <p className="text-[10px] text-slate-600">Click a row to expand chart & fundamentals</p>
        </div>

        {isLoading ? (
          <div className="bg-[#0e1726] border border-white/[0.07] rounded-xl p-5">
            <SkeletonTable rows={8} />
          </div>
        ) : isError ? (
          <div className="text-center py-12 text-slate-500">
            Failed to load watchlist.{" "}
            <button onClick={() => refetch()} className="text-accent-teal hover:underline">Retry</button>
          </div>
        ) : items.length === 0 ? (
          <div className="bg-[#0e1726] border border-white/[0.07] rounded-xl p-16 text-center">
            <Eye className="w-8 h-8 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400 font-medium mb-1">Your watchlist is empty</p>
            <p className="text-slate-600 text-sm mb-4">Add stocks you want to monitor</p>
            <button
              onClick={() => setShowAdd(true)}
              className="px-4 py-2 rounded-lg bg-accent-teal/20 border border-accent-teal/30 text-accent-teal text-sm hover:bg-accent-teal/30 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 inline mr-1.5" />
              Add Stock
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/[0.07]">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#03060f]/80 border-b border-white/[0.07]">
                  <Th col="ticker" label="Ticker" />
                  <Th col="name" label="Name" />
                  <Th col="price" label="Price" right />
                  <Th col="change_pct" label="Today" right />
                  <Th col="tracked_price" label="Ref. Price" right />
                  <Th col="hyp_gain_pct" label="Chg. Since" right />
                  <Th col="sp_gain_pct" label="S&P Since" right />
                  <Th col="alpha" label="Alpha" right />
                  <Th col="week_52_high" label="52W High" right />
                  <Th col="week_52_low" label="52W Low" right />
                  <Th col="pe_ratio" label="P/E" right />
                  <Th col="beta" label="Beta" right />
                  <th className="px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-center">Signal</th>
                  <th className="px-3 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {sorted.map((item, idx) => {
                    const isExpanded = expandedTicker === item.ticker;
                    return (
                      <>
                        <motion.tr
                          key={item.ticker}
                          layout
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          onClick={() => setExpandedTicker(isExpanded ? null : item.ticker)}
                          className={cn(
                            "border-b border-white/[0.04] transition-colors cursor-pointer",
                            idx % 2 === 0 ? "bg-[#0a1220]" : "bg-[#080e1a]",
                            "hover:bg-accent-teal/5",
                            isExpanded && "bg-accent-teal/5"
                          )}
                        >
                          <td className="px-3 py-3 font-mono font-bold text-white text-xs">{item.ticker}</td>
                          <td className="px-3 py-3 text-slate-300 max-w-[160px] truncate text-xs">{item.name}</td>
                          <td className="px-3 py-3 text-right text-white font-mono text-xs font-medium">
                            {item.price > 0 ? formatCurrency(item.price) : "—"}
                          </td>
                          <td className={cn("px-3 py-3 text-right font-mono text-xs", gainColor(item.change_pct))}>
                            {item.price > 0 ? formatPct(item.change_pct) : "—"}
                          </td>
                          <td className="px-3 py-3 text-right text-slate-500 font-mono text-xs">
                            {item.tracked_price ? formatCurrency(item.tracked_price) : "—"}
                          </td>
                          <td className="px-3 py-3 text-right">
                            {item.hyp_gain_pct != null ? (
                              <span className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold", gainBg(item.hyp_gain_pct))}>
                                {formatPct(item.hyp_gain_pct)}
                              </span>
                            ) : "—"}
                          </td>
                          <td className={cn("px-3 py-3 text-right font-mono text-xs", gainColor(item.sp_gain_pct))}>
                            {item.sp_gain_pct !== 0 ? formatPct(item.sp_gain_pct) : "—"}
                          </td>
                          <td className={cn("px-3 py-3 text-right font-mono text-xs font-semibold", gainColor(item.alpha))}>
                            {item.alpha !== 0 ? formatPct(item.alpha * 100) : "—"}
                          </td>
                          <td className="px-3 py-3 text-right text-slate-400 font-mono text-xs">
                            {item.week_52_high ? formatCurrency(item.week_52_high) : "—"}
                          </td>
                          <td className="px-3 py-3 text-right text-slate-400 font-mono text-xs">
                            {item.week_52_low ? formatCurrency(item.week_52_low) : "—"}
                          </td>
                          <td className="px-3 py-3 text-right text-slate-400 font-mono text-xs">
                            {item.pe_ratio ? item.pe_ratio.toFixed(1) + "x" : "—"}
                          </td>
                          <td className="px-3 py-3 text-right text-slate-400 font-mono text-xs">
                            {item.beta ? item.beta.toFixed(2) : "—"}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <RecBadge rec={item.recommendation} small reasons={item.rec_reasons} />
                          </td>
                          <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                            {confirmDelete === item.ticker ? (
                              <button
                                onClick={() => deleteMut.mutate(item.ticker)}
                                className="w-6 h-6 flex items-center justify-center rounded bg-loss/20 hover:bg-loss/30 text-loss transition-colors text-[10px] font-bold mx-auto"
                              >
                                ✓
                              </button>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); setConfirmDelete(item.ticker); setTimeout(() => setConfirmDelete(null), 3000); }}
                                className="w-6 h-6 flex items-center justify-center rounded bg-slate-700/50 hover:bg-loss/20 hover:text-loss text-slate-500 transition-colors mx-auto"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </td>
                        </motion.tr>

                        <AnimatePresence>
                          {isExpanded && (
                            <motion.tr
                              key={`${item.ticker}-exp`}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                            >
                              <td colSpan={14} className="bg-[#090f1e] border-b border-white/[0.04] px-6 py-4">
                                <div className="grid grid-cols-2 gap-6">
                                  <div>
                                    <p className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-widest">Price History</p>
                                    <PriceChart ticker={item.ticker} />
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-widest">Details</p>
                                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 mb-4">
                                      {[
                                        ["Market Cap", formatMarketCap(item.market_cap)],
                                        ["Sector", item.sector || "—"],
                                        ["52W High", item.week_52_high ? formatCurrency(item.week_52_high) : "—"],
                                        ["52W Low", item.week_52_low ? formatCurrency(item.week_52_low) : "—"],
                                        ["P/E Ratio", item.pe_ratio ? item.pe_ratio.toFixed(1) + "x" : "—"],
                                        ["Beta", item.beta ? item.beta.toFixed(2) : "—"],
                                        ["Tracked Since", item.tracked_since || "—"],
                                        ["Ref. Price", item.tracked_price ? formatCurrency(item.tracked_price) : "—"],
                                      ].map(([k, v]) => (
                                        <div key={k} className="flex flex-col">
                                          <dt className="text-[10px] text-slate-500 uppercase tracking-wider">{k}</dt>
                                          <dd className="text-sm text-slate-200 font-mono">{v}</dd>
                                        </div>
                                      ))}
                                    </dl>
                                    <div className="p-3 rounded-lg bg-[#03060f]/60 border border-white/[0.07]">
                                      <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Buy Signal</p>
                                      <RecBadge rec={item.recommendation} reasons={item.rec_reasons} />
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </motion.tr>
                          )}
                        </AnimatePresence>
                      </>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {showAdd && <AddWatchModal onClose={() => setShowAdd(false)} />}
      </AnimatePresence>
    </div>
  );
}
