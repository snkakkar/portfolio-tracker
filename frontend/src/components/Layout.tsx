import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard, TrendingUp, BarChart2, Shield, PieChart, Eye,
  Zap, Circle, Calculator, ArrowUpDown, Plus, FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/api/client";
import type { PortfolioMeta } from "@/types";
import { CreatePortfolioModal } from "@/components/CreatePortfolioModal";

// ── Built-in nav items (always shown, fixed routes) ──────────────────────────
const BUILTIN_PORTFOLIO_NAV = [
  { to: "/",                  label: "Dashboard",        icon: LayoutDashboard, end: true },
  { to: "/stocks",            label: "Brokerage Stocks", icon: TrendingUp },
  { to: "/etfs",              label: "Brokerage ETFs",   icon: BarChart2 },
  { to: "/retirement-stocks", label: "Retirement Stocks",icon: Shield },
  { to: "/retirement-etfs",   label: "Retirement ETFs",  icon: PieChart },
];

const WATCH_NAV = [{ to: "/watchlist", label: "Watchlist", icon: Eye }];

const TOOLS_NAV = [
  { to: "/planner", label: "Retirement Planner", icon: Calculator },
  { to: "/import",  label: "Import / Export",    icon: ArrowUpDown },
];

// Map color key → Tailwind active classes
const COLOR_ACTIVE: Record<string, { active: string; dot: string }> = {
  blue:    { active: "bg-blue-500/15 text-blue-300 border-blue-500/25",    dot: "bg-blue-400" },
  violet:  { active: "bg-violet-500/15 text-violet-300 border-violet-500/25", dot: "bg-violet-400" },
  emerald: { active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25", dot: "bg-emerald-400" },
  teal:    { active: "bg-teal-500/15 text-teal-300 border-teal-500/25",    dot: "bg-teal-400" },
  orange:  { active: "bg-orange-500/15 text-orange-300 border-orange-500/25", dot: "bg-orange-400" },
  pink:    { active: "bg-pink-500/15 text-pink-300 border-pink-500/25",    dot: "bg-pink-400" },
  amber:   { active: "bg-amber-500/15 text-amber-300 border-amber-500/25", dot: "bg-amber-400" },
  red:     { active: "bg-red-500/15 text-red-300 border-red-500/25",       dot: "bg-red-400" },
};

function colorDot(color: string) {
  const map: Record<string, string> = {
    blue: "bg-blue-400", violet: "bg-violet-400", emerald: "bg-emerald-400",
    teal: "bg-teal-400", orange: "bg-orange-400", pink: "bg-pink-400",
    amber: "bg-amber-400", red: "bg-red-400",
  };
  return map[color] ?? "bg-blue-400";
}

function NavItem({
  to, label, icon: Icon, end,
  activeClass = "bg-accent-blue/15 text-accent-blue border-accent-blue/25",
  dotColor = "bg-accent-blue",
}: {
  to: string; label: string; icon: React.ElementType;
  end?: boolean; activeClass?: string; dotColor?: string;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 border",
          isActive
            ? cn("border", activeClass)
            : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]"
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={cn("w-4 h-4 shrink-0 transition-colors", isActive ? "" : "opacity-60 group-hover:opacity-100")} />
          <span className="flex-1 truncate">{label}</span>
          {isActive && <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColor)} />}
        </>
      )}
    </NavLink>
  );
}

function CustomPortfolioNavItem({ meta }: { meta: PortfolioMeta }) {
  const { active, dot } = COLOR_ACTIVE[meta.color] ?? COLOR_ACTIVE.blue;
  return (
    <NavLink
      to={`/portfolio/${meta.key}`}
      className={({ isActive }) =>
        cn(
          "group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 border",
          isActive
            ? cn("border", active)
            : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]"
        )
      }
    >
      {({ isActive }) => (
        <>
          <span className={cn("w-2 h-2 rounded-full shrink-0", colorDot(meta.color), !isActive && "opacity-60 group-hover:opacity-100")} />
          <span className="flex-1 truncate">{meta.label}</span>
          {isActive && <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dot)} />}
        </>
      )}
    </NavLink>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [modalOpen, setModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["portfolios"],
    queryFn: () => api.listPortfolios(),
    staleTime: 30_000,
  });

  const customPortfolios = (data?.portfolios ?? []).filter((p) => !p.builtin);

  return (
    <div className="flex min-h-screen bg-[#060d1f]">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 border-r border-white/[0.06] bg-[#03060f] flex flex-col">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/[0.06]">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent-blue via-[#2563eb] to-accent-teal flex items-center justify-center shadow-glow">
            <Zap className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <span className="font-extrabold text-white tracking-tight text-sm leading-none">Portfolio</span>
            <span className="block text-[10px] text-slate-500 uppercase tracking-[0.15em] mt-0.5">Tracker Pro</span>
          </div>
        </div>

        {/* Live indicator */}
        <div className="flex items-center gap-2 px-5 py-2.5 border-b border-white/[0.04]">
          <span className="w-1.5 h-1.5 rounded-full bg-gain animate-pulse" />
          <span className="text-[10px] text-slate-600 uppercase tracking-widest">Live Market Data</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">

          {/* Built-in portfolios */}
          <div className="flex items-center justify-between px-3 pb-2 pt-1">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-600">
              Portfolios
            </p>
            <button
              onClick={() => setModalOpen(true)}
              title="Add portfolio"
              className="w-5 h-5 flex items-center justify-center rounded-md text-slate-600 
                         hover:text-slate-300 hover:bg-white/[0.07] transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {BUILTIN_PORTFOLIO_NAV.map(({ to, label, icon, end }) => (
            <NavItem key={to} to={to} label={label} icon={icon} end={end} />
          ))}

          {/* Custom portfolios */}
          {customPortfolios.length > 0 && (
            <>
              <div className="pt-3 pb-1 px-3">
                <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                  Custom
                </p>
              </div>
              {customPortfolios.map((meta) => (
                <CustomPortfolioNavItem key={meta.key} meta={meta} />
              ))}
            </>
          )}

          {/* Add portfolio shortcut when none exist yet */}
          {customPortfolios.length === 0 && (
            <button
              onClick={() => setModalOpen(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12px] 
                         text-slate-600 hover:text-slate-400 border border-dashed border-slate-700/60 
                         hover:border-slate-600 transition-all mt-1"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Add a portfolio…
            </button>
          )}

          {/* Monitor */}
          <div className="pt-5">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-600 px-3 pb-2">
              Monitor
            </p>
            {WATCH_NAV.map(({ to, label, icon }) => (
              <NavItem
                key={to} to={to} label={label} icon={icon}
                activeClass="bg-accent-teal/15 text-accent-teal border-accent-teal/25"
                dotColor="bg-accent-teal"
              />
            ))}
          </div>

          {/* Planning */}
          <div className="pt-5">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-600 px-3 pb-2">
              Planning
            </p>
            {TOOLS_NAV.map(({ to, label, icon }) => (
              <NavItem
                key={to} to={to} label={label} icon={icon}
                activeClass="bg-violet-500/15 text-violet-400 border-violet-500/25"
                dotColor="bg-violet-400"
              />
            ))}
          </div>
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/[0.06] space-y-1.5">
          <p className="text-[10px] text-slate-700 leading-relaxed">
            Data: Yahoo Finance · Prices delayed ~15 min
          </p>
          <p className="text-[10px] text-slate-700">Not financial advice.</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto min-w-0">{children}</main>

      {/* Create portfolio modal */}
      <CreatePortfolioModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ["portfolios"] });
        }}
      />
    </div>
  );
}
