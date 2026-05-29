import { motion, AnimatePresence } from "framer-motion";
import { X, TrendingUp, TrendingDown } from "lucide-react";
import { cn, formatCurrency, formatPct, gainColor } from "@/lib/utils";
import { TickerLink } from "./TickerLink";
import { RecBadge } from "./RecBadge";
import type { Holding } from "@/types";

type Kind = "buy" | "sell";

interface Props {
  kind: Kind;
  holdings: Holding[];        // already filtered to the relevant signal subset
  totalValue: number;         // for weight % calc — the *active* portfolio value
  onClose: () => void;
}

const KIND_CONFIG: Record<Kind, { title: string; subtitle: string; Icon: React.ElementType; iconColor: string; iconBg: string }> = {
  buy: {
    title: "Buy Signals",
    subtitle: "Positions our model rates BUY or STRONG BUY — opportunities to add or hold conviction.",
    Icon: TrendingUp,
    iconColor: "text-gain",
    iconBg: "bg-gain/10 border-gain/25",
  },
  sell: {
    title: "Sell Signals",
    subtitle: "Positions our model rates SELL or STRONG SELL — review for exit or trim.",
    Icon: TrendingDown,
    iconColor: "text-loss",
    iconBg: "bg-loss/10 border-loss/25",
  },
};

export function SignalsModal({ kind, holdings, totalValue, onClose }: Props) {
  const cfg = KIND_CONFIG[kind];
  // Sort largest position first — biggest weight = highest priority for review.
  const sorted = [...holdings].sort((a, b) => b.current_value - a.current_value);
  const weightSum = sorted.reduce((s, h) => s + h.current_value, 0);
  const weightPct = totalValue > 0 ? (weightSum / totalValue) * 100 : 0;

  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center p-4 sm:p-8 overflow-y-auto"
      >
        <motion.div
          key="modal"
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ duration: 0.18 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-3xl bg-[#0a1220] border border-white/[0.08] rounded-2xl shadow-2xl my-auto"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-white/[0.06]">
            <div className="flex items-start gap-3">
              <div className={cn("w-10 h-10 rounded-xl border flex items-center justify-center shrink-0", cfg.iconBg)}>
                <cfg.Icon className={cn("w-5 h-5", cfg.iconColor)} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">{cfg.title}</h2>
                <p className="text-[12px] text-slate-500 leading-snug mt-0.5 max-w-xl">{cfg.subtitle}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Summary strip */}
          <div className="grid grid-cols-3 gap-3 px-6 py-4 border-b border-white/[0.05] bg-black/20">
            <div>
              <p className="text-[9px] uppercase tracking-widest text-slate-600">Positions</p>
              <p className="text-lg font-bold text-white font-mono">{sorted.length}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-widest text-slate-600">% of Capital</p>
              <p className={cn("text-lg font-bold font-mono", cfg.iconColor)}>{weightPct.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-widest text-slate-600">Total Value</p>
              <p className="text-lg font-bold text-white font-mono">{formatCurrency(weightSum)}</p>
            </div>
          </div>

          {/* List */}
          <div className="px-2 py-2 max-h-[60vh] overflow-y-auto">
            {sorted.length === 0 ? (
              <div className="text-center py-10 text-sm text-slate-500">
                No {kind === "buy" ? "buy-signaled" : "sell-signaled"} positions in this portfolio.
              </div>
            ) : (
              <div className="space-y-1">
                {sorted.map((h) => {
                  const wPct = totalValue > 0 ? (h.current_value / totalValue) * 100 : 0;
                  return (
                    <div
                      key={h.ticker}
                      className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-white/[0.04] transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <TickerLink ticker={h.ticker} className="text-sm font-extrabold" />
                          <RecBadge rec={h.recommendation} small />
                          <span className="text-[10px] text-slate-600 font-mono">{wPct.toFixed(1)}% of book</span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {h.name}
                          {h.rec_reasons[0] && <span className="text-slate-600"> · {h.rec_reasons[0]}</span>}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-white font-mono">{formatCurrency(h.current_value)}</p>
                        <p className={cn("text-[11px] font-mono", gainColor(h.gain_pct))}>
                          {formatPct(h.gain_pct)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-slate-600">
            <span>Click any ticker for the full equity detail page.</span>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
