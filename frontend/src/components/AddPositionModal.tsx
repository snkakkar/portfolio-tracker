import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, Check, AlertCircle, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { cn } from "@/lib/utils";

interface Props {
  portfolio: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddPositionModal({ portfolio, onClose, onSuccess }: Props) {
  const qc = useQueryClient();
  const [ticker, setTicker] = useState("");
  const [shares, setShares] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [costOverride, setCostOverride] = useState("");
  const [validation, setValidation] = useState<{ valid: boolean; name?: string; price?: number } | null>(null);
  const [validating, setValidating] = useState(false);

  const addMut = useMutation({
    mutationFn: () =>
      api.addHolding(
        portfolio,
        ticker,
        parseFloat(shares),
        date,
        costOverride ? parseFloat(costOverride) : undefined
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio", portfolio] });
      onSuccess();
      onClose();
    },
  });

  // Debounced ticker validation
  useEffect(() => {
    if (ticker.length < 1) { setValidation(null); return; }
    const t = setTimeout(async () => {
      setValidating(true);
      try {
        const result = await api.validateTicker(ticker.toUpperCase());
        setValidation(result);
      } catch {
        setValidation({ valid: false });
      } finally {
        setValidating(false);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [ticker]);

  const canSubmit = validation?.valid && parseFloat(shares) > 0 && date;

  return (
    <AnimatePresence>
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
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-navy-800 border border-surface-border rounded-2xl p-6 w-full max-w-md shadow-card mx-4"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-white">Add Position</h2>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Ticker */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                Ticker Symbol
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  placeholder="e.g. AAPL"
                  className="w-full bg-navy-900 border border-surface-border rounded-lg px-3 py-2.5 pr-9 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent-blue/60 font-mono"
                  autoFocus
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {validating && <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />}
                  {!validating && validation?.valid && <Check className="w-4 h-4 text-gain" />}
                  {!validating && validation && !validation.valid && <AlertCircle className="w-4 h-4 text-loss" />}
                </div>
              </div>
              {validation?.valid && (
                <p className="mt-1 text-xs text-gain flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  {validation.name} — ${validation.price?.toFixed(2)}
                </p>
              )}
              {validation && !validation.valid && (
                <p className="mt-1 text-xs text-loss flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Ticker not found
                </p>
              )}
            </div>

            {/* Shares */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                Number of Shares
              </label>
              <input
                type="number"
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                placeholder="e.g. 10"
                min="0"
                step="any"
                className="w-full bg-navy-900 border border-surface-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent-blue/60"
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                Purchase Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-navy-900 border border-surface-border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent-blue/60"
              />
            </div>

            {/* Optional cost override */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                Cost Per Share <span className="normal-case text-slate-600">(optional — uses current price if blank)</span>
              </label>
              <input
                type="number"
                value={costOverride}
                onChange={(e) => setCostOverride(e.target.value)}
                placeholder="e.g. 150.00"
                min="0"
                step="any"
                className="w-full bg-navy-900 border border-surface-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-accent-blue/60"
              />
            </div>
          </div>

          {addMut.isError && (
            <p className="mt-4 text-xs text-loss flex items-center gap-1.5">
              <AlertCircle className="w-3 h-3" />
              Failed to add position. Please try again.
            </p>
          )}

          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-surface-border text-slate-400 hover:text-white hover:bg-white/5 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => addMut.mutate()}
              disabled={!canSubmit || addMut.isPending}
              className={cn(
                "flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2",
                canSubmit && !addMut.isPending
                  ? "bg-accent-blue hover:bg-blue-500 text-white"
                  : "bg-slate-700 text-slate-500 cursor-not-allowed"
              )}
            >
              {addMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Add Position
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
