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

export interface PortfolioSuggestion {
  ticker: string;
  name: string;
  price: number;
  change: number;
  change_pct: number;
  gain_1y_pct: number;
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
  gap_type: string;
  why_it_helps: string;
}

// ─── Retirement Planner ───────────────────────────────────────────────────────

export type AggressionLevel = "aggressive" | "moderate_aggressive" | "moderate" | "conservative";

export interface PlannerInput {
  current_age: number;
  retirement_age: number;
  annual_savings: number;
  aggression_early: AggressionLevel;
  aggression_late: AggressionLevel;
  early_phase_years: number;
  retirement_target_value: number | null;
  inflation_rate: number;
  // External assets not tracked in this app
  external_401k: number;
  external_ira: number;
  external_cash: number;
  external_real_estate: number;
  external_other: number;
}

export interface PlannerPhase {
  label: string;
  years: number;
  strategy: AggressionLevel;
  expected_return: string;
  projected_end_value: number;
}

export interface PlannerRecommendation {
  type: "savings" | "allocation" | "concentration" | "diversification" | "planning";
  priority: "high" | "medium" | "positive";
  title: string;
  detail: string;
}

export interface YearlyProjection {
  age: number;
  year: number;
  value: number;    // total net worth
  tracked: number;  // tracked portfolio only
}

export interface ExternalBreakdown {
  tracked_portfolio: number;
  "401k": number;
  ira: number;
  cash: number;
  real_estate: number;
  other: number;
  total_external: number;
  grand_total: number;
}

export interface PlannerResult {
  current_portfolio_value: number;
  tracked_portfolio_value: number;
  external_breakdown: ExternalBreakdown;
  years_to_retirement: number;
  retirement_target: number;
  monthly_income_target_today: number;
  annual_income_target_today: number;
  annual_income_target_future: number;
  mc_p10: number;
  mc_p25: number;
  mc_p50: number;
  mc_p75: number;
  mc_p90: number;
  prob_success: number;
  tracked_mc_p10: number;
  tracked_mc_p25: number;
  tracked_mc_p50: number;
  tracked_mc_p75: number;
  tracked_mc_p90: number;
  tracked_prob_success: number;
  annual_savings: number;
  required_annual_savings: number;
  annual_savings_surplus_deficit: number;
  avg_beta: number | null;
  sector_weights_pct: Record<string, number>;
  top5_holdings: { ticker: string; name: string; value: number; pct: number }[];
  top3_concentration_pct: number;
  phases: PlannerPhase[];
  yearly_projection: YearlyProjection[];
  recommendations: PlannerRecommendation[];
  assumptions: Record<string, string>;
}

// ─── Exited Positions ─────────────────────────────────────────────────────────

export interface ExitedPosition {
  id: string;
  portfolio: string;
  ticker: string;
  shares: number;
  cost_per_share: number;
  purchase_date: string;
  exit_price: number;
  exit_date: string;
  total_cost: number;
  exit_value: number;
  realized_gain: number;
  realized_gain_pct: number;
  hold_days: number | null;
}

export const PORTFOLIOS = [
  { key: "stocks", label: "Brokerage Stocks", icon: "TrendingUp" },
  { key: "etfs", label: "Brokerage ETFs", icon: "BarChart2" },
  { key: "retirement_stocks", label: "Retirement Stocks", icon: "Shield" },
  { key: "retirement_etfs", label: "Retirement ETFs", icon: "PieChart" },
] as const;

export type PortfolioKey = (typeof PORTFOLIOS)[number]["key"];
