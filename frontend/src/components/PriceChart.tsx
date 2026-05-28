import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { api } from "@/api/client";
import { formatCurrency } from "@/lib/utils";

const PERIODS = [
  { label: "1M", value: "1mo" },
  { label: "3M", value: "3mo" },
  { label: "6M", value: "6mo" },
  { label: "1Y", value: "1y" },
  { label: "2Y", value: "2y" },
  { label: "5Y", value: "5y" },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#03060f] border border-white/[0.1] rounded-xl px-3 py-2 text-xs shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
      <p className="text-slate-400 mb-1">{label}</p>
      <p className="text-accent-blue font-semibold">{formatCurrency(payload[0].value)}</p>
    </div>
  );
};

interface Props { ticker: string; }

export function PriceChart({ ticker }: Props) {
  const [period, setPeriod] = useState("1y");
  const { data, isLoading } = useQuery({
    queryKey: ["history", ticker, period],
    queryFn: () => api.getHistory(ticker, period),
    staleTime: 60_000,
  });

  const history = data?.history ?? [];
  const isPositive = history.length >= 2
    ? history[history.length - 1].close >= history[0].close
    : true;
  const strokeColor = isPositive ? "#22c55e" : "#ef4444";
  const fillColor = isPositive ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)";

  return (
    <div>
      {/* Period selector */}
      <div className="flex items-center gap-1 mb-4">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              period === p.value
                ? "bg-accent-blue text-white"
                : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="h-48 flex items-center justify-center text-slate-600 text-sm">
          Loading chart...
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={192}>
          <AreaChart data={history} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-${ticker}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={strokeColor} stopOpacity={0.15} />
                <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#475569", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              tickFormatter={(d) => d.slice(5)}
            />
            <YAxis
              tick={{ fill: "#475569", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={55}
              tickFormatter={(v) => `$${v.toFixed(0)}`}
              domain={["auto", "auto"]}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="close"
              stroke={strokeColor}
              strokeWidth={1.5}
              fill={`url(#grad-${ticker})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
