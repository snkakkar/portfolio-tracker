import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, TrendingUp, BarChart2, Shield, PieChart, Eye,
  Zap, Circle, Calculator, ArrowUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PORTFOLIO_NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/stocks", label: "Brokerage Stocks", icon: TrendingUp },
  { to: "/etfs", label: "Brokerage ETFs", icon: BarChart2 },
  { to: "/retirement-stocks", label: "Retirement Stocks", icon: Shield },
  { to: "/retirement-etfs", label: "Retirement ETFs", icon: PieChart },
];

const WATCH_NAV = [
  { to: "/watchlist", label: "Watchlist", icon: Eye },
];

const TOOLS_NAV = [
  { to: "/planner", label: "Retirement Planner", icon: Calculator },
  { to: "/import",  label: "Import / Export",    icon: ArrowUpDown },
];

function NavItem({
  to, label, icon: Icon, end,
  activeClass = "bg-accent-blue/15 text-accent-blue border-accent-blue/25",
  dotColor = "bg-accent-blue",
}: {
  to: string;
  label: string;
  icon: React.ElementType;
  end?: boolean;
  activeClass?: string;
  dotColor?: string;
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
          {isActive && (
            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColor)} />
          )}
        </>
      )}
    </NavLink>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
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
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-600 px-3 pb-2 pt-1">
            Portfolios
          </p>
          {PORTFOLIO_NAV.map(({ to, label, icon, end }) => (
            <NavItem key={to} to={to} label={label} icon={icon} end={end} />
          ))}

          <div className="pt-5">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-600 px-3 pb-2">
              Monitor
            </p>
            {WATCH_NAV.map(({ to, label, icon }) => (
              <NavItem
                key={to}
                to={to}
                label={label}
                icon={icon}
                activeClass="bg-accent-teal/15 text-accent-teal border-accent-teal/25"
                dotColor="bg-accent-teal"
              />
            ))}
          </div>

          <div className="pt-5">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-600 px-3 pb-2">
              Planning
            </p>
            {TOOLS_NAV.map(({ to, label, icon }) => (
              <NavItem
                key={to}
                to={to}
                label={label}
                icon={icon}
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
          <p className="text-[10px] text-slate-700">
            Not financial advice.
          </p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto min-w-0">
        {children}
      </main>
    </div>
  );
}
