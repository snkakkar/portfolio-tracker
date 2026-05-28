import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { pieColors, formatCurrency } from "@/lib/utils";
import type { Holding } from "@/types";

interface Props {
  holdings: Holding[];
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-navy-950 border border-surface-border rounded-lg px-3 py-2 text-xs shadow-card">
      <p className="font-semibold text-white">{d.ticker}</p>
      <p className="text-slate-400">{d.name}</p>
      <p className="text-accent-blue mt-1">{formatCurrency(d.value)}</p>
      <p className="text-slate-500">{d.pct.toFixed(1)}% of portfolio</p>
    </div>
  );
};

const CustomLegend = ({ payload }: any) => (
  <ul className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-2">
    {payload?.map((entry: any, i: number) => (
      <li key={i} className="flex items-center gap-1.5 text-[11px] text-slate-400">
        <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: entry.color }} />
        {entry.value}
      </li>
    ))}
  </ul>
);

export function PortfolioPieChart({ holdings }: Props) {
  const totalValue = holdings.reduce((s, h) => s + h.current_value, 0);
  const data = holdings.map((h, i) => ({
    ticker: h.ticker,
    name: h.name,
    value: h.current_value,
    pct: (h.current_value / totalValue) * 100,
    color: pieColors(i),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="45%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
          nameKey="ticker"
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} stroke="transparent" />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend content={<CustomLegend />} />
      </PieChart>
    </ResponsiveContainer>
  );
}
