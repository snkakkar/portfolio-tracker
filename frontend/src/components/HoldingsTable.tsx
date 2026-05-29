import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pencil, Trash2, Check, X, ChevronUp, ChevronDown, Eye, EyeOff, LogOut } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn, formatCurrency, formatPct, gainColor, gainBg, formatMarketCap } from "@/lib/utils";
import { RecBadge } from "./RecBadge";
import { PriceChart } from "./PriceChart";
import { ScoreBreakdown } from "./ScoreBreakdown";
import { ExitPositionModal } from "./ExitPositionModal";
import { TickerLink } from "./TickerLink";
import type { Holding } from "@/types";
import { api } from "@/api/client";

type SortKey = keyof Holding | null;

interface Props {
  holdings: Holding[];
  portfolio: string;
  onRefresh: () => void;
  excluded?: Set<string>;
  onToggleExclude?: (ticker: string) => void;
}

interface EditState {
  ticker: string;
  shares: string;
  purchase_date: string;
  cost_per_share: string;
}

export function HoldingsTable({ holdings, portfolio, onRefresh, excluded = new Set(), onToggleExclude }: Props) {
  const qc = useQueryClient();
  const [sortKey, setSortKey] = useState<SortKey>("current_value");
  const [sortAsc, setSortAsc] = useState(false);
  const [editRow, setEditRow] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({ ticker: "", shares: "", purchase_date: "", cost_per_share: "" });
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [exitHolding, setExitHolding] = useState<Holding | null>(null);

  const updateMut = useMutation({
    mutationFn: ({ ticker, updates }: { ticker: string; updates: object }) =>
      api.updateHolding(portfolio, ticker, updates),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["portfolio", portfolio] }); onRefresh(); setEditRow(null); },
  });

  const deleteMut = useMutation({
    mutationFn: (ticker: string) => api.deleteHolding(portfolio, ticker),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["portfolio", portfolio] }); onRefresh(); setConfirmDelete(null); },
  });

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  }

  const sorted = [...holdings].sort((a, b) => {
    if (!sortKey) return 0;
    const av = a[sortKey] as number | string;
    const bv = b[sortKey] as number | string;
    const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
    return sortAsc ? cmp : -cmp;
  });

  function startEdit(h: Holding) {
    setEditRow(h.ticker);
    setEditState({
      ticker: h.ticker,
      shares: String(h.shares),
      purchase_date: h.purchase_date,
      cost_per_share: String(h.cost_per_share),
    });
  }

  function saveEdit(ticker: string) {
    updateMut.mutate({
      ticker,
      updates: {
        shares: parseFloat(editState.shares),
        purchase_date: editState.purchase_date,
        cost_per_share: parseFloat(editState.cost_per_share),
      },
    });
  }

  function SortIcon({ col }: { col: string }) {
    if (sortKey !== col) return <ChevronUp className="w-3 h-3 text-slate-700" />;
    return sortAsc
      ? <ChevronUp className="w-3 h-3 text-accent-blue" />
      : <ChevronDown className="w-3 h-3 text-accent-blue" />;
  }

  function Th({ col, label, right = false }: { col: string; label: string; right?: boolean }) {
    return (
      <th
        onClick={() => handleSort(col as SortKey)}
        className={cn(
          "px-3 py-3 text-[10px] font-semibold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap group",
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

  return (
    <>
    <div className="overflow-x-auto rounded-2xl border border-white/[0.07]">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-[#05090f] border-b border-white/[0.07]">
            <Th col="ticker" label="Ticker" />
            <Th col="name" label="Name" />
            <Th col="shares" label="Shares" right />
            <Th col="purchase_date" label="Date" />
            <Th col="cost_per_share" label="Avg Cost" right />
            <Th col="price" label="Price" right />
            <Th col="ma_200" label="vs 200D" right />
            <Th col="change_pct" label="Today" right />
            <Th col="current_value" label="Value" right />
            <Th col="gain" label="Gain $" right />
            <Th col="gain_pct" label="Gain %" right />
            <Th col="sp_gain_pct" label="S&P %" right />
            <Th col="alpha" label="Alpha" right />
            <th className="px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-center">
              Rec.
            </th>
            <th className="px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-center w-8" title="Exclude from analysis">
              <EyeOff className="w-3 h-3 mx-auto" />
            </th>
            <th className="px-3 py-3 w-16" />
          </tr>
        </thead>
        <tbody>
          <AnimatePresence initial={false}>
            {sorted.map((h, idx) => {
              const isEditing  = editRow === h.ticker;
              const isExpanded = expandedRow === h.ticker;
              const isExcluded = excluded.has(h.ticker);

              return (
                <>
                  <motion.tr
                    key={h.ticker}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: isExcluded ? 0.35 : 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => !isEditing && setExpandedRow(isExpanded ? null : h.ticker)}
                    className={cn(
                      "border-b border-white/[0.04] transition-colors cursor-pointer",
                      idx % 2 === 0 ? "bg-[#0a1220]" : "bg-[#080e1a]",
                      "hover:bg-accent-blue/[0.06]",
                      isExpanded && "bg-accent-blue/[0.08] border-accent-blue/10",
                      isExcluded && "saturate-0"
                    )}
                  >
                    {/* Ticker */}
                    <td className="px-3 py-3 font-mono text-xs whitespace-nowrap">
                      <TickerLink ticker={h.ticker} className="text-xs" />
                    </td>

                    {/* Name */}
                    <td className="px-3 py-3 text-slate-300 max-w-[160px] truncate text-xs">
                      {h.name}
                    </td>

                    {/* Shares — editable */}
                    <td className="px-3 py-3 text-right text-slate-200 font-mono text-xs">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editState.shares}
                          onChange={(e) => setEditState((s) => ({ ...s, shares: e.target.value }))}
                          onClick={(e) => e.stopPropagation()}
                          className="w-20 bg-[#0a1628] border border-accent-blue/40 rounded px-2 py-0.5 text-xs text-right text-white focus:outline-none focus:border-accent-blue"
                        />
                      ) : (
                        <span className="group/cell flex items-center justify-end gap-1">
                          {h.shares.toLocaleString()}
                          <Pencil className="w-2.5 h-2.5 text-slate-600 opacity-0 group-hover/cell:opacity-100 transition-opacity" />
                        </span>
                      )}
                    </td>

                    {/* Date — editable */}
                    <td className="px-3 py-3 text-slate-400 font-mono text-xs whitespace-nowrap">
                      {isEditing ? (
                        <input
                          type="date"
                          value={editState.purchase_date}
                          onChange={(e) => setEditState((s) => ({ ...s, purchase_date: e.target.value }))}
                          onClick={(e) => e.stopPropagation()}
                          className="bg-[#0a1628] border border-accent-blue/40 rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-accent-blue"
                        />
                      ) : (
                        <span className="group/cell flex items-center gap-1">
                          {h.purchase_date}
                          <Pencil className="w-2.5 h-2.5 text-slate-600 opacity-0 group-hover/cell:opacity-100 transition-opacity" />
                        </span>
                      )}
                    </td>

                    {/* Avg Cost — editable */}
                    <td className="px-3 py-3 text-right text-slate-400 font-mono text-xs">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editState.cost_per_share}
                          onChange={(e) => setEditState((s) => ({ ...s, cost_per_share: e.target.value }))}
                          onClick={(e) => e.stopPropagation()}
                          className="w-24 bg-[#0a1628] border border-accent-blue/40 rounded px-2 py-0.5 text-xs text-right text-white focus:outline-none focus:border-accent-blue"
                        />
                      ) : (
                        formatCurrency(h.cost_per_share)
                      )}
                    </td>

                    {/* Price */}
                    <td className="px-3 py-3 text-right text-white font-mono text-xs font-medium">
                      {h.price > 0 ? formatCurrency(h.price) : "—"}
                    </td>

                    {/* vs 200D MA */}
                    <td className="px-3 py-3 text-right">
                      {h.price > 0 && h.ma_200 ? (() => {
                        const pct = ((h.price - h.ma_200) / h.ma_200) * 100;
                        return (
                          <span className={cn("inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold", gainBg(pct))}>
                            {pct >= 0 ? "▲" : "▼"} {formatPct(pct)}
                          </span>
                        );
                      })() : <span className="text-slate-700">—</span>}
                    </td>

                    {/* Today % */}
                    <td className={cn("px-3 py-3 text-right font-mono text-xs", gainColor(h.change_pct))}>
                      {h.price > 0 ? formatPct(h.change_pct) : "—"}
                    </td>

                    {/* Value */}
                    <td className="px-3 py-3 text-right text-white font-semibold font-mono text-xs">
                      {h.price > 0 ? formatCurrency(h.current_value) : "—"}
                    </td>

                    {/* Gain $ */}
                    <td className={cn("px-3 py-3 text-right font-mono text-xs", gainColor(h.gain))}>
                      {h.price > 0 ? formatCurrency(h.gain) : "—"}
                    </td>

                    {/* Gain % */}
                    <td className="px-3 py-3 text-right">
                      {h.price > 0 ? (
                        <span className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold", gainBg(h.gain_pct))}>
                          {formatPct(h.gain_pct)}
                        </span>
                      ) : "—"}
                    </td>

                    {/* S&P % */}
                    <td className={cn("px-3 py-3 text-right font-mono text-xs", gainColor(h.sp_gain_pct))}>
                      {h.sp_gain_pct !== 0 ? formatPct(h.sp_gain_pct) : "—"}
                    </td>

                    {/* Alpha */}
                    <td className={cn("px-3 py-3 text-right font-mono text-xs font-semibold", gainColor(h.alpha))}>
                      {h.alpha !== 0 ? formatPct(h.alpha * 100) : "—"}
                    </td>

                    {/* Rec */}
                    <td className="px-3 py-3 text-center">
                      <RecBadge rec={h.recommendation} small reasons={h.rec_reasons} />
                    </td>

                    {/* Exclude toggle */}
                    <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      {onToggleExclude && (
                        <button
                          onClick={() => onToggleExclude(h.ticker)}
                          title={isExcluded ? "Re-include in analysis" : "Exclude from analysis"}
                          className={cn(
                            "w-6 h-6 flex items-center justify-center rounded mx-auto transition-colors",
                            isExcluded
                              ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                              : "bg-slate-700/50 text-slate-500 hover:bg-amber-500/10 hover:text-amber-400"
                          )}
                        >
                          {isExcluded ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => saveEdit(h.ticker)}
                              disabled={updateMut.isPending}
                              className="w-6 h-6 flex items-center justify-center rounded bg-gain/20 hover:bg-gain/30 text-gain transition-colors"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => setEditRow(null)}
                              className="w-6 h-6 flex items-center justify-center rounded bg-slate-700/50 hover:bg-slate-700 text-slate-400 transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); startEdit(h); }}
                              title="Edit position"
                              className="w-6 h-6 flex items-center justify-center rounded bg-slate-700/50 hover:bg-accent-blue/20 hover:text-accent-blue text-slate-500 transition-colors"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setExitHolding(h); }}
                              title="Exit position (record sale)"
                              className="w-6 h-6 flex items-center justify-center rounded bg-slate-700/50 hover:bg-amber-500/20 hover:text-amber-400 text-slate-500 transition-colors"
                            >
                              <LogOut className="w-3 h-3" />
                            </button>
                            {confirmDelete === h.ticker ? (
                              <button
                                onClick={() => deleteMut.mutate(h.ticker)}
                                title="Confirm permanent delete"
                                className="w-6 h-6 flex items-center justify-center rounded bg-loss/20 hover:bg-loss/30 text-loss transition-colors text-[10px] font-bold"
                              >
                                ✓
                              </button>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); setConfirmDelete(h.ticker); setTimeout(() => setConfirmDelete(null), 3000); }}
                                title="Delete (no record kept)"
                                className="w-6 h-6 flex items-center justify-center rounded bg-slate-700/50 hover:bg-loss/20 hover:text-loss text-slate-500 transition-colors"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </motion.tr>

                  {/* Expanded row — price chart */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.tr
                        key={`${h.ticker}-expanded`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <td colSpan={16} className="bg-[#090f1e] border-b border-white/[0.05] px-6 py-5">
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Left: price chart */}
                            <div>
                              <p className="text-[10px] font-semibold text-slate-500 mb-3 uppercase tracking-widest">Price History</p>
                              <PriceChart ticker={h.ticker} />
                            </div>

                            {/* Middle: details */}
                            <div className="space-y-4">
                              {/* 52W range visual */}
                              {h.week_52_low && h.week_52_high && h.week_52_high > h.week_52_low && (
                                <div>
                                  <p className="text-[10px] font-semibold text-slate-500 mb-2 uppercase tracking-widest">52-Week Range</p>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] text-slate-500 font-mono w-16">{formatCurrency(h.week_52_low)}</span>
                                    <div className="relative flex-1 h-2 bg-slate-800 rounded-full">
                                      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-loss via-amber-500 to-gain opacity-60" />
                                      <div
                                        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-[#090f1e] shadow-lg z-10"
                                        style={{
                                          left: `calc(${Math.min(100, Math.max(0, (h.price - h.week_52_low!) / (h.week_52_high! - h.week_52_low!) * 100))}% - 6px)`,
                                        }}
                                      />
                                    </div>
                                    <span className="text-[11px] text-slate-500 font-mono w-16 text-right">{formatCurrency(h.week_52_high)}</span>
                                  </div>
                                  <p className="text-[10px] text-slate-600 mt-1 text-center">
                                    Current: {formatCurrency(h.price)} &middot;{" "}
                                    {((h.price - h.week_52_low!) / (h.week_52_high! - h.week_52_low!) * 100).toFixed(0)}% of 52W range
                                  </p>
                                </div>
                              )}

                              {/* Fundamentals grid */}
                              <div>
                                <p className="text-[10px] font-semibold text-slate-500 mb-2 uppercase tracking-widest">Fundamentals</p>
                                <dl className="grid grid-cols-3 gap-2">
                                  {[
                                    { k: "P/E Ratio",  v: h.pe_ratio ? h.pe_ratio.toFixed(1) + "x" : "—", color: h.pe_ratio && h.pe_ratio < 20 ? "text-gain" : h.pe_ratio && h.pe_ratio > 50 ? "text-loss" : "text-slate-200" },
                                    { k: "Beta",       v: h.beta ? h.beta.toFixed(2) : "—",                 color: h.beta && h.beta > 1.5 ? "text-amber-400" : "text-slate-200" },
                                    { k: "Market Cap", v: formatMarketCap(h.market_cap),                     color: "text-slate-200" },
                                    { k: "Sector",     v: h.sector || "—",                                   color: "text-slate-400" },
                                    { k: "S&P Gain",   v: formatPct(h.sp_gain_pct),                          color: gainColor(h.sp_gain_pct) },
                                    { k: "Alpha",      v: formatPct(h.alpha * 100),                          color: gainColor(h.alpha) },
                                  ].map(({ k, v, color }) => (
                                    <div key={k} className="bg-[#0e1726] rounded-lg p-2">
                                      <dt className="text-[9px] text-slate-600 uppercase tracking-wider mb-0.5">{k}</dt>
                                      <dd className={cn("text-xs font-bold font-mono", color)}>{v}</dd>
                                    </div>
                                  ))}
                                </dl>
                              </div>

                              {/* Moving averages */}
                              <div>
                                <p className="text-[10px] font-semibold text-slate-500 mb-2 uppercase tracking-widest">Moving Averages</p>
                                <dl className="grid grid-cols-3 gap-2">
                                  {([
                                    { k: "10D MA",  ma: h.ma_10  },
                                    { k: "50D MA",  ma: h.ma_50  },
                                    { k: "200D MA", ma: h.ma_200 },
                                  ] as const).map(({ k, ma }) => {
                                    const diffPct = ma && h.price > 0 ? ((h.price - ma) / ma) * 100 : null;
                                    return (
                                      <div key={k} className="bg-[#0e1726] rounded-lg p-2">
                                        <dt className="text-[9px] text-slate-600 uppercase tracking-wider mb-0.5">{k}</dt>
                                        <dd className="text-xs font-bold font-mono text-slate-200">
                                          {ma ? formatCurrency(ma) : "—"}
                                        </dd>
                                        {diffPct !== null && (
                                          <p className={cn("text-[9px] font-mono mt-0.5", gainColor(diffPct))}>
                                            {diffPct >= 0 ? "▲" : "▼"} {formatPct(diffPct)}
                                          </p>
                                        )}
                                      </div>
                                    );
                                  })}
                                </dl>
                              </div>

                              {/* Compact rec reasons */}
                              <div className="rounded-xl bg-[#0e1726] border border-white/[0.07] p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-[10px] uppercase tracking-widest text-slate-500">Signals</p>
                                  <RecBadge rec={h.recommendation} small />
                                </div>
                                <div className="space-y-1">
                                  {h.rec_reasons.slice(0, 5).map((r, i) => (
                                    <div key={i} className="flex items-start gap-1.5">
                                      <span className="text-slate-600 text-xs mt-px">›</span>
                                      <p className="text-[11px] text-slate-400 leading-snug">{r}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Right: score breakdown */}
                            <div>
                              <p className="text-[10px] font-semibold text-slate-500 mb-3 uppercase tracking-widest">Score Breakdown</p>
                              {h.rec_breakdown ? (
                                <ScoreBreakdown
                                  breakdown={h.rec_breakdown}
                                  score={h.rec_score}
                                  recommendation={h.recommendation}
                                  nextTier={h.rec_next_tier}
                                  nextPts={h.rec_next_pts}
                                  delay={0}
                                />
                              ) : (
                                <p className="text-xs text-slate-600">No breakdown available</p>
                              )}
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

    {/* Exit position modal */}
    {exitHolding && (
      <ExitPositionModal
        holding={exitHolding}
        portfolio={portfolio}
        onClose={() => {
          setExitHolding(null);
          onRefresh();
        }}
      />
    )}
    </>
  );
}
