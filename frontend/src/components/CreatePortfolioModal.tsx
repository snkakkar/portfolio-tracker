import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, FolderPlus, Loader2, Check } from "lucide-react";
import { api } from "@/api/client";
import type { PortfolioMeta } from "@/types";

const COLORS: { id: string; label: string; bg: string; ring: string }[] = [
  { id: "blue",    label: "Blue",    bg: "bg-blue-500",    ring: "ring-blue-400" },
  { id: "violet",  label: "Violet",  bg: "bg-violet-500",  ring: "ring-violet-400" },
  { id: "emerald", label: "Emerald", bg: "bg-emerald-500", ring: "ring-emerald-400" },
  { id: "teal",    label: "Teal",    bg: "bg-teal-500",    ring: "ring-teal-400" },
  { id: "orange",  label: "Orange",  bg: "bg-orange-500",  ring: "ring-orange-400" },
  { id: "pink",    label: "Pink",    bg: "bg-pink-500",    ring: "ring-pink-400" },
  { id: "amber",   label: "Amber",   bg: "bg-amber-500",   ring: "ring-amber-400" },
  { id: "red",     label: "Red",     bg: "bg-red-500",     ring: "ring-red-400" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (meta: PortfolioMeta) => void;
}

export function CreatePortfolioModal({ open, onClose, onCreated }: Props) {
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("blue");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const meta = await api.createPortfolio(label.trim(), color);
      onCreated(meta);
      setLabel("");
      setColor("blue");
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        ?? "Failed to create portfolio.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const preview = label.trim()
    ? label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")
    : null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="relative w-full max-w-md bg-[#0d1526] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07]">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-blue-500/15">
                  <FolderPlus className="w-4 h-4 text-blue-400" />
                </div>
                <h2 className="font-semibold text-white text-sm">New Portfolio</h2>
              </div>
              <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                  Portfolio Name
                </label>
                <input
                  autoFocus
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Robinhood Growth, TFSA, Crypto"
                  maxLength={50}
                  className="w-full bg-slate-800/60 border border-slate-600 rounded-xl px-4 py-2.5 
                             text-sm text-white placeholder-slate-500 outline-none
                             focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
                {preview && (
                  <p className="text-[11px] text-slate-500">
                    URL key: <code className="text-slate-400">/{preview}</code>
                  </p>
                )}
              </div>

              {/* Color */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                  Colour
                </label>
                <div className="flex flex-wrap gap-2.5">
                  {COLORS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setColor(c.id)}
                      className={`w-7 h-7 rounded-full ${c.bg} transition-all ${
                        color === c.id ? `ring-2 ring-offset-2 ring-offset-[#0d1526] ${c.ring} scale-110` : "opacity-60 hover:opacity-100"
                      }`}
                      title={c.label}
                    >
                      {color === c.id && <Check className="w-3 h-3 text-white mx-auto" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview badge */}
              {label.trim() && (
                <div className="flex items-center gap-2 bg-slate-800/40 rounded-xl px-4 py-3">
                  <ColorDot color={color} />
                  <span className="text-sm text-slate-200 font-medium">{label.trim()}</span>
                  <span className="ml-auto text-[10px] text-slate-500 uppercase tracking-wide">preview</span>
                </div>
              )}

              {/* Error */}
              {error && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-400 text-sm 
                             hover:border-slate-400 hover:text-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!label.trim() || loading}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50
                             text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Portfolio"}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ColorDot({ color }: { color: string }) {
  const map: Record<string, string> = {
    blue: "bg-blue-500", violet: "bg-violet-500", emerald: "bg-emerald-500",
    teal: "bg-teal-500", orange: "bg-orange-500", pink: "bg-pink-500",
    amber: "bg-amber-500", red: "bg-red-500",
  };
  return <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${map[color] ?? "bg-blue-500"}`} />;
}
