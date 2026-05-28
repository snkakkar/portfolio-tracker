import { motion } from "framer-motion";
import { type LucideIcon } from "lucide-react";
import { cn, formatCurrency, formatPct, gainColor } from "@/lib/utils";

interface Props {
  label: string;
  value: string | number;
  sub?: string;
  sub2?: string;
  icon?: LucideIcon;
  valueType?: "currency" | "pct" | "raw";
  trend?: number;
  delay?: number;
  accent?: boolean;
  iconColor?: string;
  iconBg?: string;
}

export function SummaryCard({
  label, value, sub, sub2, icon: Icon, valueType = "raw",
  trend, delay = 0, accent = false, iconColor, iconBg,
}: Props) {
  const raw = typeof value === "number" ? value : null;

  // Smart display: use compact for large numbers, full otherwise
  const displayValue =
    valueType === "currency" && raw !== null
      ? Math.abs(raw) >= 1_000_000
        ? `${raw < 0 ? "-" : ""}$${(Math.abs(raw) / 1_000_000).toFixed(2)}M`
        : Math.abs(raw) >= 10_000
        ? `${raw < 0 ? "-" : ""}$${(Math.abs(raw) / 1_000).toFixed(1)}K`
        : formatCurrency(raw)
      : valueType === "pct" && raw !== null
      ? formatPct(raw)
      : value;

  const valueColor = trend !== undefined ? gainColor(trend) : "text-white";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className={cn(
        "relative overflow-hidden rounded-2xl border p-5 flex flex-col justify-between min-h-[110px]",
        accent
          ? "bg-gradient-to-br from-[#0f2144] to-[#0a1628] border-accent-blue/30"
          : "bg-[#0e1726] border-white/[0.07]"
      )}
    >
      {/* Glow accent line at top */}
      <div
        className={cn(
          "absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl",
          accent
            ? "bg-gradient-to-r from-accent-blue via-accent-teal to-transparent"
            : trend !== undefined && trend > 0
            ? "bg-gradient-to-r from-gain/60 to-transparent"
            : trend !== undefined && trend < 0
            ? "bg-gradient-to-r from-loss/60 to-transparent"
            : "bg-gradient-to-r from-slate-600/30 to-transparent"
        )}
      />

      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest leading-none">
          {label}
        </p>
        {Icon && (
          <div
            className={cn(
              "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
              iconBg ?? (accent ? "bg-accent-blue/20" : "bg-white/[0.05]")
            )}
          >
            <Icon
              className={cn(
                "w-4 h-4",
                iconColor ?? (accent ? "text-accent-blue" : "text-slate-400")
              )}
            />
          </div>
        )}
      </div>

      <div>
        <p className={cn("text-[1.6rem] font-extrabold leading-tight tracking-tight", valueColor)}>
          {displayValue}
        </p>
        {sub && (
          <p className={cn("text-xs mt-0.5 font-medium", trend !== undefined ? gainColor(trend) : "text-slate-500")}>
            {sub}
          </p>
        )}
        {sub2 && <p className="text-[11px] text-slate-600 mt-0.5">{sub2}</p>}
      </div>
    </motion.div>
  );
}
