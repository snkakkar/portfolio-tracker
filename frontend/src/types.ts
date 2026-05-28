export type Recommendation = "STRONG BUY" | "BUY" | "HOLD" | "SELL" | "STRONG SELL";
export type RecColor = "emerald" | "green" | "amber" | "orange" | "red";

export interface ScoreFactorBreakdown {
  points: number;
  max: number;
  reason: string;
}

export type RecBreakdown = Record<string, ScoreFactorBreakdown>;

export interface Holding {
  ticker: string;
  name: string;
  shares: number;
  cost_per_share: number;
  purchase_date: string;
  price: number;
  change: number;
  change_pct: number;
  total_cost: number;
  current_value: number;
  gain: number;
  gain_pct: number;
  sp_gain_pct: number;
  sp_gain_dollar: number;
  alpha: number;
  week_52_high: number | null;
  week_52_low: number | null;
  pe_ratio: number | null;
  beta: number | null;
  market_cap: number | null;
  sector: string | null;
  recommendation: Recommendation;
  rec_score: number;
  rec_color: RecColor;
  rec_reasons: string[];
  rec_breakdown: RecBreakdown;
  rec_next_tier: Recommendation | null;
  rec_next_pts: number | null;
  portfolio?: string;
  portfolio_label?: string;
}

export interface PortfolioSummary {
  total_cost: number;
  total_value: number;
  total_gain: number;
  gain_pct: number;
  todays_gain: number;
}

export interface PortfolioData {
  portfolio: string;
  label: string;
  summary: PortfolioSummary;
  holdings: Holding[];
}

export interface AllPortfoliosData {
  overall_summary: PortfolioSummary;
  portfolios: Record<string, { label: string; summary: PortfolioSummary; holdings: Holding[] }>;
  top_performers: Holding[];
  worst_performers: Holding[];
  all_holdings: Holding[];
}

export interface PriceBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface DiscoverStock {
  ticker: string;
  name: string;
  price: number;
  change: number;
  change_pct: number;
  gain_1y_pct: number;
  sp_gain_pct: number;
  alpha: number;
  week_52_high: number | null;
  week_52_low: number | null;
  pe_ratio: number | null;
  beta: number | null;
  market_cap: number | null;
  sector: string | null;
  recommendation: Recommendation;
  rec_score: number;
  rec_color: RecColor;
  rec_reasons: string[];
  rec_breakdown: RecBreakdown;
  rec_next_tier: Recommendation | null;
  rec_next_pts: number | null;
}

export interface WatchItem {
  ticker: string;
  name: string;
  price: number;
  change: number;
  change_pct: number;
  week_52_high: number | null;
  week_52_low: number | null;
  pe_ratio: number | null;
  beta: number | null;
  market_cap: number | null;
  sector: string | null;
  tracked_since: string;
  tracked_price: number;
  hyp_gain: number | null;
  hyp_gain_pct: number | null;
  sp_gain_pct: number;
  alpha: number;
  recommendation: Recommendation;
  rec_score: number;
  rec_color: RecColor;
  rec_reasons: string[];
  rec_breakdown: RecBreakdown;
  rec_next_tier: Recommendation | null;
  rec_next_pts: number | null;
}

export const PORTFOLIOS = [
  { key: "stocks", label: "Brokerage Stocks", icon: "TrendingUp" },
  { key: "etfs", label: "Brokerage ETFs", icon: "BarChart2" },
  { key: "retirement_stocks", label: "Retirement Stocks", icon: "Shield" },
  { key: "retirement_etfs", label: "Retirement ETFs", icon: "PieChart" },
] as const;

export type PortfolioKey = (typeof PORTFOLIOS)[number]["key"];
