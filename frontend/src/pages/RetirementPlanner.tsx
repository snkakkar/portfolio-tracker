import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import {
  Calculator, TrendingUp, Target, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronUp, Info, Zap, PieChart, DollarSign,
  Calendar, ShieldCheck, ArrowRight, RefreshCw,
} from "lucide-react";
import { api } from "@/api/client";
import type { PlannerInput, PlannerResult, AggressionLevel } from "@/types";
import { cn } from "@/lib/utils";

// ─── constants ────────────────────────────────────────────────────────────────

const AGGRESSION_OPTIONS: { value: AggressionLevel; label: string; sub: string }[] = [
  { value: "aggressive",          label: "Aggressive",           sub: "90% equity · ~9.5% expected" },
  { value: "moderate_aggressive", label: "Moderately Aggressive", sub: "75% equity · ~8.0% expected" },
  { value: "moderate",            label: "Moderate",             sub: "60% equity · ~6.5% expected" },
  { value: "conservative",        label: "Conservative",         sub: "40% equity · ~4.8% expected" },
];

const PRIORITY_CONFIG = {
  high:     { color: "text-red-400",    bg: "bg-red-400/10 border-red-400/20",    icon: AlertTriangle },
  medium:   { color: "text-amber-400",  bg: "bg-amber-400/10 border-amber-400/20", icon: Info },
  positive: { color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/20", icon: CheckCircle2 },
};

const DEFAULT_INPUT: PlannerInput = {
  current_age: 31,
  retirement_age: 55,
  annual_savings: 40000,
  aggression_early: "aggressive",
  aggression_late: "moderate_aggressive",
  early_phase_years: 15,
  retirement_target_value: 20_000_000,
  inflation_rate: 0.03,
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt$(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

// ─── sub-components ────────────────────────────────────────────────────────────

function InputSection({
  input,
  onChange,
  onSubmit,
  loading,
}: {
  input: PlannerInput;
  onChange: (k: keyof PlannerInput, v: number | string | null) => void;
  onSubmit: () => void;
  loading: boolean;
}) {
  const years = Math.max(0, input.retirement_age - input.current_age);

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0a1628] p-6 space-y-6">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-9 h-9 rounded-xl bg-accent-blue/15 flex items-center justify-center">
          <Calculator className="w-4.5 h-4.5 text-accent-blue" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">Your Retirement Profile</h2>
          <p className="text-[11px] text-slate-500">Inputs are pre-filled with your stats — adjust as needed</p>
        </div>
      </div>

      {/* Age & timeline */}
      <div className="grid grid-cols-2 gap-4">
        <label className="space-y-1.5">
          <span className="text-[11px] text-slate-400 uppercase tracking-widest font-medium">Current Age</span>
          <input
            type="number"
            value={input.current_age}
            onChange={e => onChange("current_age", Number(e.target.value))}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent-blue/50"
            min={18} max={80}
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-[11px] text-slate-400 uppercase tracking-widest font-medium">Retirement Age</span>
          <input
            type="number"
            value={input.retirement_age}
            onChange={e => onChange("retirement_age", Number(e.target.value))}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent-blue/50"
            min={input.current_age + 1} max={90}
          />
        </label>
      </div>

      <div className="px-1">
        <div className="flex justify-between text-[11px] text-slate-500 mb-1">
          <span>Years to retirement</span>
          <span className="text-accent-blue font-semibold">{years} years</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent-blue to-accent-teal transition-all"
            style={{ width: `${Math.min(100, (years / 40) * 100)}%` }}
          />
        </div>
      </div>

      {/* Savings */}
      <label className="block space-y-1.5">
        <span className="text-[11px] text-slate-400 uppercase tracking-widest font-medium">Annual Savings Added to Portfolio</span>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
          <input
            type="number"
            value={input.annual_savings}
            onChange={e => onChange("annual_savings", Number(e.target.value))}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-6 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent-blue/50"
            step={1000} min={0}
          />
        </div>
      </label>

      {/* Retirement target */}
      <label className="block space-y-1.5">
        <span className="text-[11px] text-slate-400 uppercase tracking-widest font-medium">Retirement Target (total portfolio value)</span>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
          <input
            type="number"
            value={input.retirement_target_value ?? 20_000_000}
            onChange={e => onChange("retirement_target_value", Number(e.target.value))}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-6 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent-blue/50"
            step={500_000} min={100_000}
          />
        </div>
        <p className="text-[10px] text-slate-600">At 4% withdrawal rate this implies ~${Math.round((input.retirement_target_value ?? 20_000_000) * 0.04 / 12).toLocaleString()}/mo in retirement income</p>
      </label>

      {/* Phase 1 strategy */}
      <div className="space-y-2">
        <span className="text-[11px] text-slate-400 uppercase tracking-widest font-medium block">
          Phase 1 Strategy (first {input.early_phase_years} years — aggressive growth phase)
        </span>
        <div className="grid grid-cols-2 gap-2">
          {AGGRESSION_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => onChange("aggression_early", opt.value)}
              className={cn(
                "text-left p-3 rounded-xl border transition-all",
                input.aggression_early === opt.value
                  ? "border-accent-blue/50 bg-accent-blue/10 text-white"
                  : "border-white/[0.06] bg-white/[0.02] text-slate-400 hover:border-white/20"
              )}
            >
              <div className="text-xs font-medium">{opt.label}</div>
              <div className="text-[10px] opacity-70 mt-0.5">{opt.sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Phase 2 strategy */}
      <div className="space-y-2">
        <span className="text-[11px] text-slate-400 uppercase tracking-widest font-medium block">
          Phase 2 Strategy (years {input.early_phase_years + 1}–{years} — pre-retirement phase)
        </span>
        <div className="grid grid-cols-2 gap-2">
          {AGGRESSION_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => onChange("aggression_late", opt.value)}
              className={cn(
                "text-left p-3 rounded-xl border transition-all",
                input.aggression_late === opt.value
                  ? "border-accent-teal/50 bg-accent-teal/10 text-white"
                  : "border-white/[0.06] bg-white/[0.02] text-slate-400 hover:border-white/20"
              )}
            >
              <div className="text-xs font-medium">{opt.label}</div>
              <div className="text-[10px] opacity-70 mt-0.5">{opt.sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Early phase length */}
      <label className="block space-y-1.5">
        <div className="flex justify-between">
          <span className="text-[11px] text-slate-400 uppercase tracking-widest font-medium">Phase 1 Duration</span>
          <span className="text-[11px] text-accent-blue font-semibold">{input.early_phase_years} years</span>
        </div>
        <input
          type="range"
          min={5} max={Math.max(5, years - 2)} step={1}
          value={input.early_phase_years}
          onChange={e => onChange("early_phase_years", Number(e.target.value))}
          className="w-full accent-blue-500 cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-slate-600">
          <span>5 years</span><span>{Math.max(5, years - 2)} years</span>
        </div>
      </label>

      <button
        onClick={onSubmit}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-accent-blue to-accent-teal py-3 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
        {loading ? "Running Monte Carlo analysis…" : "Run Retirement Projection"}
      </button>
    </div>
  );
}


function GaugeMeter({ prob }: { prob: number }) {
  const angle = -135 + (prob / 100) * 270;
  const color = prob >= 80 ? "#10b981" : prob >= 60 ? "#f59e0b" : "#ef4444";
  const label = prob >= 80 ? "On Track" : prob >= 60 ? "Needs Attention" : "At Risk";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-44 h-24 overflow-hidden">
        <svg viewBox="0 0 180 100" className="w-full">
          {/* Background arc */}
          <path
            d="M 20 90 A 70 70 0 0 1 160 90"
            fill="none" stroke="#1e293b" strokeWidth="14" strokeLinecap="round"
          />
          {/* Colored arc */}
          <path
            d="M 20 90 A 70 70 0 0 1 160 90"
            fill="none"
            stroke={color}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={`${(prob / 100) * 220} 220`}
            opacity="0.85"
          />
          {/* Needle */}
          <line
            x1="90" y1="90"
            x2={90 + 55 * Math.cos((angle - 90) * Math.PI / 180)}
            y2={90 + 55 * Math.sin((angle - 90) * Math.PI / 180)}
            stroke={color} strokeWidth="3" strokeLinecap="round"
          />
          <circle cx="90" cy="90" r="5" fill={color} />
          {/* Labels */}
          <text x="14" y="106" fill="#475569" fontSize="9">0%</text>
          <text x="156" y="106" fill="#475569" fontSize="9" textAnchor="end">100%</text>
        </svg>
      </div>
      <div className="text-center">
        <div className="text-3xl font-black" style={{ color }}>{prob.toFixed(0)}%</div>
        <div className="text-xs font-medium" style={{ color }}>{label}</div>
        <div className="text-[10px] text-slate-500 mt-0.5">probability of reaching target</div>
      </div>
    </div>
  );
}


function ResultDashboard({ result, input }: { result: PlannerResult; input: PlannerInput }) {
  const [expandedRec, setExpandedRec] = useState<number | null>(null);

  const surplus = result.annual_savings_surplus_deficit;
  const surplusPositive = surplus >= 0;

  // Build chart data — show yearly projection with target line
  const chartData = result.yearly_projection.map(pt => ({
    age: pt.age,
    value: Math.round(pt.value),
    label: `Age ${pt.age}`,
  }));

  // MC fan chart data
  const mcData = [
    { label: "Bear (p10)",    value: result.mc_p10,  fill: "#ef4444" },
    { label: "Low (p25)",     value: result.mc_p25,  fill: "#f97316" },
    { label: "Median (p50)",  value: result.mc_p50,  fill: "#3b82f6" },
    { label: "High (p75)",    value: result.mc_p75,  fill: "#10b981" },
    { label: "Bull (p90)",    value: result.mc_p90,  fill: "#6366f1" },
  ];

  const sectorData = Object.entries(result.sector_weights_pct)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const SECTOR_COLORS = [
    "#3b82f6","#10b981","#f59e0b","#8b5cf6",
    "#ef4444","#06b6d4","#f97316","#84cc16",
  ];

  return (
    <div className="space-y-5">

      {/* Hero metrics row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Current Portfolio",
            value: fmt$(result.current_portfolio_value),
            sub: "Total across all portfolios",
            icon: DollarSign,
            color: "text-accent-blue",
          },
          {
            label: "Retirement Target",
            value: fmt$(result.retirement_target),
            sub: `~${fmt$(result.monthly_income_target_today)}/mo implied income (4% SWR)`,
            icon: Target,
            color: "text-accent-teal",
          },
          {
            label: "Median Projection",
            value: fmt$(result.mc_p50),
            sub: `${result.mc_p50 >= result.retirement_target ? "↑ Above" : "↓ Below"} target by ${fmt$(Math.abs(result.mc_p50 - result.retirement_target))}`,
            icon: TrendingUp,
            color: result.mc_p50 >= result.retirement_target ? "text-emerald-400" : "text-amber-400",
          },
          {
            label: "Years to Retire",
            value: String(result.years_to_retirement),
            sub: `Retiring at ${input.retirement_age}`,
            icon: Calendar,
            color: "text-violet-400",
          },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="rounded-2xl border border-white/[0.07] bg-[#0a1628] p-4">
            <div className="flex items-start justify-between mb-3">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">{label}</span>
              <div className={cn("w-7 h-7 rounded-lg bg-white/[0.05] flex items-center justify-center", color)}>
                <Icon className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className={cn("text-xl font-black tracking-tight", color)}>{value}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* Probability gauge + savings check */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Success probability */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#0a1628] p-5 flex flex-col items-center justify-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium mb-4">
            Probability of Success (700 simulations)
          </p>
          <GaugeMeter prob={result.prob_success} />
          <div className="mt-4 w-full grid grid-cols-3 gap-2 text-center">
            {[
              { label: "Bear p10", val: result.mc_p10, color: "text-red-400" },
              { label: "Median p50", val: result.mc_p50, color: "text-blue-400" },
              { label: "Bull p90", val: result.mc_p90, color: "text-emerald-400" },
            ].map(({ label, val, color }) => (
              <div key={label} className="bg-white/[0.03] rounded-xl p-2">
                <div className={cn("text-sm font-bold", color)}>{fmt$(val)}</div>
                <div className="text-[10px] text-slate-600">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Savings analysis */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#0a1628] p-5 space-y-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">Savings Analysis</p>
          <div className="space-y-3">
            {[
              { label: "Your annual savings", value: result.annual_savings, highlight: false },
              { label: "Required for median target", value: result.required_annual_savings, highlight: false },
              {
                label: surplusPositive ? "Annual surplus" : "Annual shortfall",
                value: Math.abs(surplus),
                highlight: true,
                positive: surplusPositive,
              },
            ].map(({ label, value, highlight, positive }) => (
              <div key={label} className={cn(
                "flex items-center justify-between px-3 py-2.5 rounded-xl",
                highlight
                  ? positive ? "bg-emerald-400/10 border border-emerald-400/20" : "bg-red-400/10 border border-red-400/20"
                  : "bg-white/[0.03]"
              )}>
                <span className={cn("text-xs", highlight ? (positive ? "text-emerald-300" : "text-red-300") : "text-slate-400")}>
                  {label}
                </span>
                <span className={cn("text-sm font-bold", highlight ? (positive ? "text-emerald-400" : "text-red-400") : "text-white")}>
                  {highlight && !positive && "−"}{fmt$(value)}/yr
                </span>
              </div>
            ))}
          </div>

          <div className="pt-1 border-t border-white/[0.06] space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-500">Implied monthly income (today, 4% SWR)</span>
              <span className="text-white font-medium">~${Math.round(result.monthly_income_target_today).toLocaleString()}/mo</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-500">Implied monthly income (at retirement)</span>
              <span className="text-amber-400 font-medium">~${Math.round(result.annual_income_target_future / 12).toLocaleString()}/mo</span>
            </div>
          </div>
        </div>
      </div>

      {/* Projection chart */}
      <div className="rounded-2xl border border-white/[0.07] bg-[#0a1628] p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">
            Deterministic Growth Projection (blended expected returns)
          </p>
          <div className="flex items-center gap-4 text-[10px]">
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-3 h-0.5 bg-accent-blue rounded-full inline-block" />
              Portfolio value
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-3 h-0.5 bg-red-400 rounded-full inline-block border-dashed" />
              Target
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="projGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="age"
              tick={{ fontSize: 10, fill: "#64748b" }}
              tickFormatter={v => `${v}`}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#64748b" }}
              tickFormatter={v => fmt$(v)}
              width={54}
            />
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, fontSize: 12 }}
              formatter={(v: number) => [fmt$(v), "Projected value"]}
              labelFormatter={v => `Age ${v}`}
            />
            <ReferenceLine
              y={result.retirement_target}
              stroke="#ef4444"
              strokeDasharray="5 3"
              strokeOpacity={0.6}
              label={{ value: "Target", fill: "#ef4444", fontSize: 10, position: "insideTopRight" }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#projGrad)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Monte Carlo outcomes */}
      <div className="rounded-2xl border border-white/[0.07] bg-[#0a1628] p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">
            Monte Carlo Outcome Range (700 simulations)
          </p>
          <span className="text-[10px] text-slate-600 bg-white/[0.04] px-2 py-1 rounded-full">
            Probability of reaching target: <span className="text-white font-semibold">{result.prob_success}%</span>
          </span>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={mcData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} />
            <YAxis tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={v => fmt$(v)} width={54} />
            <Tooltip
              contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, fontSize: 12 }}
              formatter={(v: number) => [fmt$(v), "Portfolio value"]}
            />
            <ReferenceLine
              y={result.retirement_target}
              stroke="#ef4444"
              strokeDasharray="5 3"
              strokeOpacity={0.6}
              label={{ value: "Target", fill: "#ef4444", fontSize: 10, position: "insideTopRight" }}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {mcData.map((entry) => (
                <Cell key={entry.label} fill={entry.fill} opacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Phase breakdown + portfolio profile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Phase breakdown */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#0a1628] p-5 space-y-3">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">Investment Phases</p>
          {result.phases.map((phase, i) => (
            <div key={i} className={cn(
              "p-4 rounded-xl border space-y-2",
              i === 0 ? "border-accent-blue/20 bg-accent-blue/[0.06]" : "border-accent-teal/20 bg-accent-teal/[0.06]"
            )}>
              <div className="flex items-center gap-2">
                <div className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                  i === 0 ? "bg-accent-blue text-white" : "bg-accent-teal text-white"
                )}>
                  {i + 1}
                </div>
                <span className="text-xs font-semibold text-white">{phase.label}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[10px] text-slate-500">Duration</div>
                  <div className="text-xs font-semibold text-white">{phase.years} yrs</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">Exp. Return</div>
                  <div className={cn("text-xs font-semibold", i === 0 ? "text-accent-blue" : "text-accent-teal")}>
                    {phase.expected_return}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">End Value</div>
                  <div className="text-xs font-semibold text-emerald-400">{fmt$(phase.projected_end_value)}</div>
                </div>
              </div>
            </div>
          ))}

          <div className="pt-3 border-t border-white/[0.06] space-y-1.5">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">Assumptions</p>
            {Object.entries(result.assumptions).map(([k, v]) => (
              <div key={k} className="flex justify-between text-[11px]">
                <span className="text-slate-500 capitalize">{k.replace(/_/g, " ")}</span>
                <span className="text-slate-300 font-medium">{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Portfolio profile */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#0a1628] p-5 space-y-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">Current Portfolio Profile</p>

          {/* Beta */}
          {result.avg_beta !== null && (
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-400">Portfolio Beta (mkt-weighted)</span>
                <span className={cn("font-semibold",
                  result.avg_beta > 1.5 ? "text-amber-400" :
                  result.avg_beta < 0.7 ? "text-blue-400" : "text-emerald-400"
                )}>
                  β {result.avg_beta.toFixed(2)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all",
                    result.avg_beta > 1.5 ? "bg-amber-400" :
                    result.avg_beta < 0.7 ? "bg-blue-400" : "bg-emerald-400"
                  )}
                  style={{ width: `${Math.min(100, (result.avg_beta / 2.5) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
                <span>Conservative (0.5)</span><span>Aggressive (2.5)</span>
              </div>
            </div>
          )}

          {/* Top concentration */}
          <div>
            <div className="flex justify-between text-xs mb-2">
              <span className="text-slate-400">Top 3 Concentration</span>
              <span className={cn("font-semibold",
                result.top3_concentration_pct > 60 ? "text-amber-400" : "text-emerald-400"
              )}>
                {result.top3_concentration_pct.toFixed(0)}%
              </span>
            </div>
            {result.top5_holdings.map((h, i) => (
              <div key={h.ticker} className="flex items-center gap-2 mb-1.5">
                <div className="w-5 h-5 rounded-full bg-accent-blue/20 flex items-center justify-center text-[10px] text-accent-blue font-bold shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between text-[11px] mb-0.5">
                    <span className="text-white font-medium">{h.ticker}</span>
                    <span className="text-slate-400">{h.pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-1 rounded-full bg-white/[0.05]">
                    <div className="h-full rounded-full bg-accent-blue/50" style={{ width: `${h.pct}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Sector breakdown */}
          {sectorData.length > 0 && (
            <div>
              <p className="text-[11px] text-slate-500 mb-2">Sector exposure</p>
              <div className="space-y-1">
                {sectorData.map(([sector, pct], idx) => (
                  <div key={sector} className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 w-32 truncate shrink-0">{sector}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-white/[0.05]">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: SECTOR_COLORS[idx % SECTOR_COLORS.length] }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 w-8 text-right shrink-0">{pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recommendations */}
      {result.recommendations.length > 0 && (
        <div className="rounded-2xl border border-white/[0.07] bg-[#0a1628] p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-4 h-4 text-accent-blue" />
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-medium">Advisor Recommendations</p>
          </div>
          {result.recommendations.map((rec, i) => {
            const cfg = PRIORITY_CONFIG[rec.priority];
            const Icon = cfg.icon;
            const open = expandedRec === i;
            return (
              <motion.div
                key={i}
                layout
                className={cn("rounded-xl border p-4 cursor-pointer", cfg.bg)}
                onClick={() => setExpandedRec(open ? null : i)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <Icon className={cn("w-4 h-4 shrink-0 mt-0.5", cfg.color)} />
                    <div className="min-w-0">
                      <div className={cn("text-xs font-semibold", cfg.color)}>{rec.title}</div>
                      <div className="text-[10px] text-slate-500 capitalize mt-0.5">{rec.type}</div>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {open ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
                  </div>
                </div>
                <AnimatePresence>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 pt-3 border-t border-white/[0.08] text-[12px] text-slate-300 leading-relaxed">
                        {rec.detail}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export function RetirementPlanner() {
  const [input, setInput] = useState<PlannerInput>(DEFAULT_INPUT);
  const [result, setResult] = useState<PlannerResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasRun, setHasRun] = useState(false);

  function handleChange(k: keyof PlannerInput, v: number | string | null) {
    setInput(prev => ({ ...prev, [k]: v }));
  }

  async function handleRun() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.runPlanner(input);
      setResult(res);
      setHasRun(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to run projection";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500/30 to-accent-blue/20 flex items-center justify-center border border-violet-500/20 shrink-0">
          <Calculator className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-white tracking-tight">Retirement Planner</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monte Carlo projection · 700 simulations · Based on your live portfolio · Calibrated for long-term investors
          </p>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 bg-amber-400/[0.07] border border-amber-400/20 rounded-xl px-4 py-3 text-[11px] text-amber-300/80 leading-relaxed">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>
          Projections are illustrative only — actual returns vary. Return assumptions are based on historical long-run equity averages and do not guarantee future results.
          This is not financial advice. Consult a licensed advisor for personalized guidance.
        </span>
      </div>

      <div className={cn("grid gap-6", result ? "grid-cols-1 xl:grid-cols-[400px_1fr]" : "grid-cols-1 max-w-lg mx-auto w-full")}>
        {/* Input panel */}
        <InputSection
          input={input}
          onChange={handleChange}
          onSubmit={handleRun}
          loading={loading}
        />

        {/* Results */}
        {error && (
          <div className="flex items-center gap-3 bg-red-400/10 border border-red-400/20 rounded-xl p-4 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {result && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <ResultDashboard result={result} input={input} />
          </motion.div>
        )}

        {!hasRun && !loading && !result && (
          <div className="hidden xl:flex flex-col items-center justify-center text-center gap-4 rounded-2xl border border-white/[0.06] bg-[#0a1628] p-12">
            <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Calculator className="w-7 h-7 text-violet-400" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Ready to project your future</p>
              <p className="text-slate-500 text-xs mt-1 max-w-xs">
                Fill in your profile on the left and click "Run Retirement Projection" to see your Monte Carlo analysis, probability of success, and personalized recommendations.
              </p>
            </div>
            <div className="flex items-center gap-6 text-[11px] text-slate-500">
              {["Monte Carlo analysis", "Success probability", "Advisor recommendations"].map(f => (
                <span key={f} className="flex items-center gap-1.5">
                  <ArrowRight className="w-3 h-3 text-violet-400" />{f}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
