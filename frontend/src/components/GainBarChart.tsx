import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell,
} from "recharts";
import type { Holding } from "@/types";

interface Props {
  holdings: Holding[];
  metric?: "gain_pct" | "alpha";
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const val: number = payload[0].value;
  const isPositive = val >= 0;
  return (
    <div className="bg-navy-950 border border-surface-border rounded-lg px-3 py-2 text-xs shadow-card">
      <p className="font-semibold text-white mb-1">{label}</p>
      <p className={isPositive ? "text-gain" : "text-loss"}>
        {isPositive ? "+" : ""}{val.toFixed(2)}%
      </p>
    </div>
  );
};

export function GainBarChart({ holdings, metric = "gain_pct" }: Props) {
  const sorted = [...holdings].sort((a, b) => b[metric] - a[metric]);
  const data = sorted.map((h) => ({
    ticker: h.ticker,
    value: metric === "alpha" ? h.alpha * 100 : h.gain_pct,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis
          dataKey="ticker"
          tick={{ fill: "#94a3b8", fontSize: 11 }}
          axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "#94a3b8", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v.toFixed(0)}%`}
          width={45}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
        <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" />
        <Bar dataKey="value" radius={[3, 3, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.value >= 0 ? "#22c55e" : "#ef4444"} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
