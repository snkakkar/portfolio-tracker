import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Trash2, TrendingUp, TrendingDown, Calendar, Clock, DollarSign, BarChart2 } from "lucide-react";
import { api } from "@/api/client";
import { cn, formatCurrency, formatPct, gainColor, gainBg } from "@/lib/utils";
import type { ExitedPosition } from "@/types";

interface Props {
  portfolio: string;
}

function StatCard({ label, value, color = "text-white", icon: Icon }:
  { label: string; value: string; color?: string; icon: React.ElementType }) {
  return (
    <div className="bg-[#0e1726] border border-white/[0.07] rounded-xl p-4 flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center shrink-0">
        <Icon className={cn("w-4 h-4", color)} />
      </div>
      <div>
        <p className="text-[10px] text-slate-500 uppercase tracking-widest">{label}</p>
        <p className={cn("text-sm font-bold font-mono mt-0.5", color)}>{value}</p>
      </div>
    </div>
  );
}

export function ClosedPositionsTable({ portfolio }: Props) {
  const qc = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["exited", portfolio],
    queryFn: () => api.getExitedPositions(portfolio),
    staleTime: 30_000,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteExitedPosition(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exited", portfolio] });
      setConfirmDelete(null);
    },
  });

  const positions: ExitedPosition[] = data?.positions ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-5 h-5 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-center">
        <div className="w-12 h-12 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-3">
          <BarChart2 className="w-5 h-5 text-slate-600" />
        </div>
        <p className="text-slate-400 text-sm font-medium">No closed positions yet</p>
        <p className="text-slate-600 text-xs mt-1">
          Use the exit button on any holding to record a trade and preserve its realized P&L.
        </p>
      </div>
    );
  }

  // Summary stats
  const totalRealized   = positions.reduce((s, p) => s + p.realized_gain, 0);
  const totalInvested   = positions.reduce((s, p) => s + p.total_cost, 0);
  const winners         = positions.filter(p => p.realized_gain > 0);
  const losers          = positions.filter(p => p.realized_gain < 0);
  const winRate         = positions.length ? (winners.length / positions.length) * 100 : 0;
  const avgHold         = positions.filter(p => p.hold_days != null).reduce((s, p) => s + (p.hold_days ?? 0), 0)
                          / positions.filter(p => p.hold_days != null).length || 0;
  const overallReturn   = totalInvested > 0 ? (totalRealized / totalInvested) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total Realized P&L"
          value={`${totalRealized >= 0 ? "+" : ""}${formatCurrency(totalRealized)}`}
          color={totalRealized >= 0 ? "text-emerald-400" : "text-red-400"}
          icon={totalRealized >= 0 ? TrendingUp : TrendingDown}
        />
        <StatCard
          label="Overall Return"
          value={formatPct(overallReturn)}
          color={gainColor(overallReturn)}
          icon={BarChart2}
        />
        <StatCard
          label="Win Rate"
          value={`${winRate.toFixed(0)}% (${winners.length}W / ${losers.length}L)`}
          color={winRate >= 60 ? "text-amber-400" : "text-slate-300"}
          icon={TrendingUp}
        />
        <StatCard
          label="Avg Hold"
          value={avgHold > 0 ? `${Math.round(avgHold)} days` : "—"}
          color="text-slate-300"
          icon={Clock}
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-white/[0.07]">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#05090f] border-b border-white/[0.07]">
              {[
                { label: "Ticker",       align: "left" },
                { label: "Shares",       align: "right" },
                { label: "Bought",       align: "left" },
                { label: "Exited",       align: "left" },
                { label: "Avg Cost",     align: "right" },
                { label: "Exit Price",   align: "right" },
                { label: "Total Cost",   align: "right" },
                { label: "Exit Value",   align: "right" },
                { label: "Realized P&L", align: "right" },
                { label: "Return %",     align: "right" },
                { label: "Hold",         align: "right" },
                { label: "",             align: "right" },
              ].map(({ label, align }) => (
                <th key={label} className={cn(
                  "px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap",
                  align === "right" ? "text-right" : "text-left"
                )}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.map((pos, idx) => (
              <tr
                key={pos.id}
                className={cn(
                  "border-b border-white/[0.04] transition-colors",
                  idx % 2 === 0 ? "bg-[#0a1220]" : "bg-[#080e1a]",
                  "hover:bg-white/[0.03]"
                )}
              >
                {/* Ticker + portfolio badge */}
                <td className="px-3 py-3 whitespace-nowrap">
                  <div className="font-mono font-bold text-white text-xs">{pos.ticker}</div>
                </td>

                {/* Shares */}
                <td className="px-3 py-3 text-right text-slate-300 font-mono text-xs">
                  {pos.shares.toLocaleString()}
                </td>

                {/* Buy date */}
                <td className="px-3 py-3 text-slate-400 font-mono text-xs whitespace-nowrap">
                  {pos.purchase_date}
                </td>

                {/* Exit date */}
                <td className="px-3 py-3 text-slate-400 font-mono text-xs whitespace-nowrap">
                  {pos.exit_date}
                </td>

                {/* Avg cost */}
                <td className="px-3 py-3 text-right text-slate-400 font-mono text-xs">
                  {formatCurrency(pos.cost_per_share)}
                </td>

                {/* Exit price */}
                <td className="px-3 py-3 text-right text-white font-mono text-xs font-medium">
                  {formatCurrency(pos.exit_price)}
                </td>

                {/* Total cost */}
                <td className="px-3 py-3 text-right text-slate-400 font-mono text-xs">
                  {formatCurrency(pos.total_cost)}
                </td>

                {/* Exit value */}
                <td className="px-3 py-3 text-right text-white font-mono text-xs font-semibold">
                  {formatCurrency(pos.exit_value)}
                </td>

                {/* Realized gain */}
                <td className={cn("px-3 py-3 text-right font-mono text-xs font-semibold", gainColor(pos.realized_gain))}>
                  {pos.realized_gain >= 0 ? "+" : ""}{formatCurrency(pos.realized_gain)}
                </td>

                {/* Return % badge */}
                <td className="px-3 py-3 text-right">
                  <span className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold", gainBg(pos.realized_gain_pct))}>
                    {formatPct(pos.realized_gain_pct)}
                  </span>
                </td>

                {/* Hold days */}
                <td className="px-3 py-3 text-right text-slate-500 font-mono text-xs whitespace-nowrap">
                  {pos.hold_days != null ? `${pos.hold_days}d` : "—"}
                </td>

                {/* Delete */}
                <td className="px-3 py-3 text-right" onClick={e => e.stopPropagation()}>
                  {confirmDelete === pos.id ? (
                    <button
                      onClick={() => deleteMut.mutate(pos.id)}
                      className="w-6 h-6 flex items-center justify-center rounded bg-red-500/20 hover:bg-red-500/30 text-red-400 text-[10px] font-bold mx-auto"
                    >
                      ✓
                    </button>
                  ) : (
                    <button
                      onClick={() => { setConfirmDelete(pos.id); setTimeout(() => setConfirmDelete(null), 3000); }}
                      title="Permanently delete this record"
                      className="w-6 h-6 flex items-center justify-center rounded bg-slate-700/50 hover:bg-red-500/20 hover:text-red-400 text-slate-600 transition-colors mx-auto"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
