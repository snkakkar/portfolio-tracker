import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, LogOut, DollarSign, Calendar, TrendingUp, TrendingDown } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { formatCurrency, formatPct, gainColor, cn } from "@/lib/utils";
import type { Holding } from "@/types";

interface Props {
  holding: Holding;
  portfolio: string;
  onClose: () => void;
}

export function ExitPositionModal({ holding: h, portfolio, onClose }: Props) {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [exitPrice, setExitPrice] = useState(String(h.price > 0 ? h.price.toFixed(2) : ""));
  const [exitDate, setExitDate]   = useState(today);

  const exitMut = useMutation({
    mutationFn: () =>
      api.exitHolding(portfolio, h.ticker, parseFloat(exitPrice), exitDate),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio", portfolio] });
      qc.invalidateQueries({ queryKey: ["exited", portfolio] });
      onClose();
    },
  });

  const price   = parseFloat(exitPrice) || 0;
  const exitVal = Math.round(h.shares * price * 100) / 100;
  const gain    = Math.round((exitVal - h.total_cost) * 100) / 100;
  const gainPct = h.total_cost > 0 ? (gain / h.total_cost) * 100 : 0;
  const valid   = price > 0 && exitDate.length === 10;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

        <motion.div
          className="relative z-10 w-full max-w-md bg-[#0a1628] border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden"
          initial={{ scale: 0.95, y: 12 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 12 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/[0.07]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center">
                <LogOut className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Exit Position</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Record realized P&amp;L for <span className="font-mono text-white">{h.ticker}</span>
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-5 py-4 space-y-4">
            {/* Position summary */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Shares", value: h.shares.toLocaleString() },
                { label: "Avg Cost", value: formatCurrency(h.cost_per_share) },
                { label: "Total Cost", value: formatCurrency(h.total_cost) },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white/[0.04] rounded-xl p-3 text-center">
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">{label}</div>
                  <div className="text-xs font-bold text-white font-mono">{value}</div>
                </div>
              ))}
            </div>

            {/* Exit price */}
            <label className="block space-y-1.5">
              <span className="text-[11px] text-slate-400 uppercase tracking-widest font-medium flex items-center gap-1.5">
                <DollarSign className="w-3 h-3" />
                Exit Price per Share
              </span>
              <input
                type="number"
                value={exitPrice}
                onChange={e => setExitPrice(e.target.value)}
                step="0.01"
                min="0.01"
                placeholder="e.g. 185.50"
                className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-amber-400/50 transition-colors"
                autoFocus
              />
              {h.price > 0 && (
                <p className="text-[10px] text-slate-600">
                  Current market price: <span className="text-slate-400 font-mono">{formatCurrency(h.price)}</span>
                </p>
              )}
            </label>

            {/* Exit date */}
            <label className="block space-y-1.5">
              <span className="text-[11px] text-slate-400 uppercase tracking-widest font-medium flex items-center gap-1.5">
                <Calendar className="w-3 h-3" />
                Exit Date
              </span>
              <input
                type="date"
                value={exitDate}
                onChange={e => setExitDate(e.target.value)}
                className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-400/50 transition-colors"
              />
            </label>

            {/* Realized P&L preview */}
            {price > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "rounded-xl border p-4 space-y-2",
                  gain >= 0
                    ? "bg-emerald-400/[0.07] border-emerald-400/20"
                    : "bg-red-400/[0.07] border-red-400/20"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  {gain >= 0
                    ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    : <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest">Realized P&L Preview</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-[10px] text-slate-500">Exit Value</div>
                    <div className="text-xs font-bold text-white font-mono">{formatCurrency(exitVal)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500">Gain / Loss</div>
                    <div className={cn("text-xs font-bold font-mono", gainColor(gain))}>
                      {gain >= 0 ? "+" : ""}{formatCurrency(gain)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500">Return</div>
                    <div className={cn("text-xs font-bold font-mono", gainColor(gainPct))}>
                      {formatPct(gainPct)}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Warning */}
            <p className="text-[11px] text-amber-300/70 leading-relaxed bg-amber-400/[0.06] border border-amber-400/15 rounded-xl px-3 py-2.5">
              This position will be removed from your active portfolio and saved to <strong>Closed Positions</strong>. This is different from deleting — the trade record is permanently preserved.
            </p>
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-5 pb-5">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-slate-400 hover:text-white text-sm font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => exitMut.mutate()}
              disabled={!valid || exitMut.isPending}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black text-sm font-bold transition-colors flex items-center justify-center gap-2"
            >
              <LogOut className="w-3.5 h-3.5" />
              {exitMut.isPending ? "Exiting…" : "Confirm Exit"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
