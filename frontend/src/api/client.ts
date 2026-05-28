import axios from "axios";
import type { AllPortfoliosData, PortfolioData, PriceBar, WatchItem, DiscoverStock, PortfolioSuggestion, PlannerInput, PlannerResult, ExitedPosition, ImportRow } from "@/types";

const BASE = "/api";

export const api = {
  getPortfolio: (portfolio: string): Promise<PortfolioData> =>
    axios.get(`${BASE}/portfolio/${portfolio}`).then((r) => r.data),

  getAllPortfolios: (): Promise<AllPortfoliosData> =>
    axios.get(`${BASE}/portfolio`).then((r) => r.data),

  getHistory: (ticker: string, period = "1y"): Promise<{ ticker: string; period: string; history: PriceBar[] }> =>
    axios.get(`${BASE}/history/${ticker}`, { params: { period } }).then((r) => r.data),

  validateTicker: (ticker: string): Promise<{ valid: boolean; ticker: string; name?: string; price?: number }> =>
    axios.get(`${BASE}/validate/${ticker}`).then((r) => r.data),

  addHolding: (
    portfolio: string,
    ticker: string,
    shares: number,
    purchase_date: string,
    cost_per_share?: number
  ) =>
    axios
      .post(`${BASE}/holdings/${portfolio}`, { ticker, shares, purchase_date, cost_per_share })
      .then((r) => r.data),

  updateHolding: (
    portfolio: string,
    ticker: string,
    updates: { shares?: number; purchase_date?: string; cost_per_share?: number }
  ) => axios.put(`${BASE}/holdings/${portfolio}/${ticker}`, updates).then((r) => r.data),

  deleteHolding: (portfolio: string, ticker: string) =>
    axios.delete(`${BASE}/holdings/${portfolio}/${ticker}`).then((r) => r.data),

  // Watchlist
  getWatchlist: (): Promise<{ items: WatchItem[] }> =>
    axios.get(`${BASE}/watchlist`).then((r) => r.data),

  addToWatchlist: (ticker: string, tracked_price?: number, tracked_since?: string) =>
    axios
      .post(`${BASE}/watchlist`, {
        ticker,
        shares: 0,
        purchase_date: tracked_since ?? new Date().toISOString().slice(0, 10),
        cost_per_share: tracked_price,
      })
      .then((r) => r.data),

  removeFromWatchlist: (ticker: string) =>
    axios.delete(`${BASE}/watchlist/${ticker}`).then((r) => r.data),

  // Portfolio-specific suggestions
  getPortfolioSuggestions: (portfolio: string): Promise<{
    suggestions: PortfolioSuggestion[];
    gaps: string[];
  }> => axios.get(`${BASE}/portfolio/${portfolio}/suggestions`).then((r) => r.data),

  // Exited positions
  exitHolding: (portfolio: string, ticker: string, exit_price: number, exit_date: string): Promise<ExitedPosition> =>
    axios.post(`${BASE}/holdings/${portfolio}/${ticker}/exit`, { exit_price, exit_date }).then((r) => r.data),

  getExitedPositions: (portfolio: string): Promise<{ positions: ExitedPosition[] }> =>
    axios.get(`${BASE}/exited/${portfolio}`).then((r) => r.data),

  deleteExitedPosition: (id: string): Promise<{ ok: boolean }> =>
    axios.delete(`${BASE}/exited/${id}`).then((r) => r.data),

  // Retirement planner
  runPlanner: (input: PlannerInput): Promise<PlannerResult> =>
    axios.post(`${BASE}/planner`, input).then((r) => r.data),

  // Stock discovery
  discoverStocks: (): Promise<{
    stocks: DiscoverStock[];
    owned_count: number;
    universe_size: number;
  }> => axios.get(`${BASE}/discover`).then((r) => r.data),

  // Import / Export
  importPreview: (file: File): Promise<{ rows: ImportRow[]; errors: string[]; total: number }> => {
    const fd = new FormData();
    fd.append("file", file);
    return axios.post(`${BASE}/import/preview`, fd).then((r) => r.data);
  },

  importConfirm: (file: File, mode: "merge" | "replace"): Promise<{
    added: string[]; skipped: string[]; errors: string[]; message: string;
  }> => {
    const fd = new FormData();
    fd.append("file", file);
    return axios.post(`${BASE}/import/confirm?mode=${mode}`, fd).then((r) => r.data);
  },

  exportTemplate: (format: "csv" | "xlsx") =>
    window.open(`${BASE}/export/template?format=${format}`, "_blank"),

  exportCurrent: (format: "csv" | "xlsx") =>
    window.open(`${BASE}/export/current?format=${format}`, "_blank"),
};
