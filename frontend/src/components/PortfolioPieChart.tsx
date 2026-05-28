import { useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { pieColors, formatCurrency, formatPct, gainColor } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Holding } from "@/types";

interface Props {
  holdings: Holding[];
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-[#03060f] border border-white/[0.1] rounded-xl px-3 py-2.5 text-xs shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
      <p className="font-mono font-bold text-white">{d.ticker}</p>
      <p className="text-slate-400 text-[11px] max-w-[180px] truncate">{d.name}</p>
      <div className="flex items-center gap-3 mt-1.5">
        <span className="text-accent-blue font-mono font-semibold">{formatCurrency(d.value)}</span>
        <span className="text-slate-500">{d.pct.toFixed(1)}%</span>
      </div>
      <p className={cn("text-[11px] mt-0.5 font-mono", gainColor(d.gain_pct))}>
        {d.gain_pct >= 0 ? "+" : ""}{d.gain_pct.toFixed(2)}% all-time
      </p>
    </div>
  );
};

export function PortfolioPieChart({ holdings }: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const totalValue = holdings.reduce((s, h) => s + h.current_value, 0);

  const data = holdings
    .map((h, i) => ({
      ticker: h.ticker,
      name: h.name,
      value: h.current_value,
      gain_pct: h.gain_pct,
      pct: (h.current_value / totalValue) * 100,
      color: pieColors(i),
    }))
    .sort((a, b) => b.value - a.value);

  // Only show legend for top 8, group rest as "Other"
  const TOP_N = 8;
  const top    = data.slice(0, TOP_N);
  const rest   = data.slice(TOP_N);
  const otherValue = rest.reduce((s, d) => s + d.value, 0);
  const chartData = otherValue > 0
    ? [...top, { ticker: "Other", name: `${rest.length} more positions`, value: otherValue, gain_pct: 0, pct: (otherValue / totalValue) * 100, color: "#334155" }]
    : top;

  return (
    <div className="flex flex-col gap-4">
      {/* Donut chart */}
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={58}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
            nameKey="ticker"
            onMouseEnter={(_, index) => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
          >
            {chartData.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.color}
                stroke="transparent"
                opacity={activeIndex === null || activeIndex === i ? 1 : 0.4}
                style={{ cursor: "pointer", transition: "opacity 0.15s" }}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Custom legend — two columns */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {chartData.map((d, i) => (
          <div
            key={d.ticker}
            className={cn(
              "flex items-center gap-2 rounded-lg px-2 py-1 transition-colors",
              activeIndex === i ? "bg-white/[0.05]" : ""
            )}
            onMouseEnter={() => setActiveIndex(i)}
            onMouseLeave={() => setActiveIndex(null)}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
            <span className="font-mono font-bold text-[11px] text-white shrink-0">{d.ticker}</span>
            <span className="text-[10px] text-slate-500 ml-auto shrink-0">{d.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
