import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  ResponsiveContainer, Cell, LabelList,
} from "recharts";
import type { Holding } from "@/types";

interface Props {
  holdings: Holding[];
  metric?: "gain_pct" | "alpha";
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const val: number = payload[0].value;
  return (
    <div className="bg-[#03060f] border border-white/[0.1] rounded-xl px-3 py-2.5 text-xs shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
      <p className="font-mono font-bold text-white mb-1">{label}</p>
      <p className={val >= 0 ? "text-gain font-mono font-semibold" : "text-loss font-mono font-semibold"}>
        {val >= 0 ? "+" : ""}{val.toFixed(2)}%
      </p>
    </div>
  );
};

export function GainBarChart({ holdings, metric = "gain_pct" }: Props) {
  const sorted = [...holdings].sort((a, b) => b[metric] - a[metric]);
  const data = sorted.map((h) => ({
    ticker: h.ticker,
    value: metric === "alpha" ? parseFloat((h.alpha * 100).toFixed(2)) : parseFloat(h.gain_pct.toFixed(2)),
  }));

  const maxAbs = Math.max(...data.map((d) => Math.abs(d.value)), 1);
  const yDomain: [number, number] = [-maxAbs * 1.1, maxAbs * 1.1];

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis
          dataKey="ticker"
          tick={{ fill: "#64748b", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
          axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
          tickLine={false}
        />
        <YAxis
          domain={yDomain}
          tick={{ fill: "#475569", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v > 0 ? "+" : ""}${v.toFixed(0)}%`}
          width={44}
        />
        <Tooltip
          content={<CustomTooltip />}
          cursor={{ fill: "rgba(255,255,255,0.03)" }}
        />
        <ReferenceLine y={0} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
        <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={36}>
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.value >= 0 ? "#22c55e" : "#ef4444"}
              fillOpacity={Math.max(0.4, Math.abs(entry.value) / maxAbs)}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
