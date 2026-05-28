# Portfolio Tracker

A full-stack brokerage portfolio tracker with live market data, advanced analytics, intelligent buy/sell recommendations, and a comprehensive retirement planner.

![Dashboard](https://img.shields.io/badge/status-active-brightgreen) ![Python](https://img.shields.io/badge/python-3.9%2B-blue) ![React](https://img.shields.io/badge/react-18-61dafb)

---

## Features

### Portfolio Management
- **4 Portfolio Accounts** — Brokerage Stocks, Brokerage ETFs, Retirement Stocks, Retirement ETFs
- **Custom Portfolios** — Create additional portfolios with custom labels/colors as needed
- **Watchlist** — Monitor stocks without adding them to a portfolio
- **Add / Edit / Remove** positions with live ticker validation
- **Exit Position** — Mark a position as sold with exit price and date; realized P&L is calculated and stored separately from your active holdings
- **Closed Positions History** — Per-portfolio table of all exited trades with realized gain/loss, win rate, and average hold duration
- **Temporary Exclusion** — Toggle any holding out of calculations on-the-fly to see how the rest of your portfolio performs without it
- **CSV/Excel Import Flexibility** — Uploads accept portfolio keys or labels, and unknown portfolio names are auto-created as custom portfolios during import

### Live Market Data & Analytics
- **Live Prices** — Real-time quotes, daily changes, and fundamentals via Yahoo Finance (cached 60 s)
- **52-Week Range Visualizer** — Color-coded slider showing where each stock sits in its annual range
- **Analytics Tab** — Win rate, annualized return (CAGR), portfolio beta, sector weights, today's movers — one tab per portfolio
- **Metrics Panel** — Total gain/loss, alpha vs S&P 500, best and worst performers at a glance

### Recommendation Engine
- **Buy/Sell Recommendations** — 7-signal scoring engine calibrated for long-term investors (not a 1-year myopic view)
- **Score Breakdown** — Per-factor bar chart showing exactly why each stock received its rating and how many points it needs to reach the next tier
- **Recommendations Tab** — Groups all holdings into Strong Buy / Buy / Hold / Sell / Strong Sell columns with expandable detail cards
- **Suggested Additions** — Per-portfolio recommendations for new positions that fill identified gaps (sector exposure, income, diversification)
- **Stock Discovery** — Scans a 60+ stock universe and surfaces buy opportunities not currently held in any portfolio

### Analyst Report
- **Wall Street-style Portfolio Assessment** — Each portfolio and the overall dashboard include an Overview tab with a letter grade (A–F), headline narrative, top strengths, key risks, and priority action items
- **Overall Dashboard Report** — The main dashboard shows a combined report across all accounts

### Retirement Planner (`/planner`)
- **Retirement Target** — Set a direct retirement figure (e.g. $20 million) rather than a monthly income estimate
- **Savings Breakdown** — Separate inputs for 401k contributions, Roth IRA contributions, and other savings, with a running annual total
- **External Assets** — Add assets tracked outside this site (401k balance, IRA, cash/HYSA, real estate, other) to include your full net worth in projections
- **Dual Projections** — All charts and Monte Carlo results show two lines: Total Net Worth (tracked portfolio + external assets) and Tracked Portfolio alone
- **Monte Carlo Simulation** — 400 simulated retirement paths with P10 / P25 / P50 / P75 / P90 percentile outcomes, run in parallel for speed
- **Deterministic Projection** — Year-by-year growth chart from today to retirement age
- **Savings Gap Analysis** — Calculates the exact annual savings rate needed to hit your target; flags if you're on track or behind
- **Portfolio Fitness Score** — Rates your current portfolio's alignment with your aggression level and timeline
- **Personalized Recommendations** — Flags concentration risk, missing sectors, beta mismatches, and drawdown timing as you approach retirement
- **Persistent Inputs** — All planner fields (age, target, savings, external assets) are saved to `localStorage` and restored on every visit

---

## Tech Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Frontend    | React 18 + TypeScript + Vite        |
| Styling     | Tailwind CSS + shadcn/ui            |
| Animations  | Framer Motion                       |
| Charts      | Recharts                            |
| Backend     | FastAPI (Python 3.9+)               |
| Market Data | yfinance                            |
| State       | TanStack Query (React Query)        |
| Data store  | `holdings.json` (local file)        |

---

## Getting Started

### Prerequisites
- Python 3.9+
- Node.js 18+

### 1. Clone the repo

```bash
git clone https://github.com/snkakkar/portfolio-tracker.git
cd portfolio-tracker
```

### 2. Set up your holdings

```bash
cp backend/holdings.sample.json backend/holdings.json
```

Edit `backend/holdings.json` with your own positions. All metrics (current price, gain, alpha, recommendations) are computed automatically at runtime.

**holdings.json structure:**
```json
{
  "stocks":            [{ "ticker": "AAPL", "shares": 10, "cost_per_share": 150.00, "purchase_date": "2022-01-15" }],
  "etfs":              [...],
  "retirement_stocks": [...],
  "retirement_etfs":   [...],
  "watchlist":         [{ "ticker": "NVDA", "shares": 0, "cost_per_share": 500.00, "purchase_date": "2024-01-01" }],
  "exited":            []
}
```

> `holdings.json` is in `.gitignore` — your personal portfolio data is never committed.

### 3. Start the backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 4. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

Or use the convenience script from the project root:

```bash
chmod +x start.sh && ./start.sh
```

---

## Project Structure

```
portfolio-tracker/
├── backend/
│   ├── main.py               # FastAPI app & all API routes
│   ├── recommendations.py    # 7-signal scoring engine (long-term calibrated)
│   ├── market_data.py        # yfinance wrapper with in-memory caching & batch fetch
│   ├── holdings.py           # CRUD for holdings.json (active + exited positions)
│   ├── holdings.sample.json  # Template — copy to holdings.json to get started
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Overview.tsx          # Dashboard (Overview / Analytics / Discovery tabs)
│       │   ├── PortfolioPage.tsx     # Per-portfolio page (Overview / Analytics / Recs / Closed)
│       │   ├── WatchlistPage.tsx     # Watchlist monitoring
│       │   └── RetirementPlanner.tsx # Full retirement planning tool
│       ├── components/
│       │   ├── HoldingsTable.tsx         # Editable holdings grid with exit & exclusion
│       │   ├── RecommendationsPanel.tsx  # Buy/Hold/Sell card columns + Suggested Additions
│       │   ├── AnalystReport.tsx         # Wall Street-style portfolio grade & narrative
│       │   ├── ExitPositionModal.tsx     # Modal for recording a position exit
│       │   ├── ClosedPositionsTable.tsx  # Historical closed trades with P&L summary
│       │   ├── MetricsPanel.tsx          # Summary KPIs (alpha, CAGR, beta, sector)
│       │   ├── StockDiscovery.tsx        # Universe scan for new buy ideas
│       │   └── ...
│       ├── api/client.ts     # Axios API client with typed methods
│       └── types.ts          # TypeScript interfaces for all data shapes
├── start.sh
└── README.md
```

---

## API Reference

### Portfolio & Holdings

| Method | Endpoint                                  | Description                                  |
|--------|-------------------------------------------|----------------------------------------------|
| GET    | `/api/portfolio`                          | All portfolios combined (dashboard view)     |
| GET    | `/api/portfolio/{name}`                   | Single portfolio with enriched holdings      |
| POST   | `/api/holdings/{portfolio}`               | Add a position                               |
| PUT    | `/api/holdings/{portfolio}/{ticker}`      | Update shares / cost / date                  |
| DELETE | `/api/holdings/{portfolio}/{ticker}`      | Permanently remove a position                |
| POST   | `/api/holdings/{portfolio}/{ticker}/exit` | Exit a position — records realized P&L       |

### Exited Positions

| Method | Endpoint                   | Description                             |
|--------|----------------------------|-----------------------------------------|
| GET    | `/api/exited`              | All closed trades across all portfolios |
| GET    | `/api/exited/{portfolio}`  | Closed trades for one portfolio         |
| DELETE | `/api/exited/{record_id}`  | Permanently delete a closed trade       |

### Watchlist

| Method | Endpoint                    | Description                   |
|--------|-----------------------------|-------------------------------|
| GET    | `/api/watchlist`            | Watchlist with live data      |
| POST   | `/api/watchlist`            | Add ticker to watchlist       |
| DELETE | `/api/watchlist/{ticker}`   | Remove from watchlist         |

### Discovery & Suggestions

| Method | Endpoint                              | Description                                        |
|--------|---------------------------------------|----------------------------------------------------|
| GET    | `/api/discover`                       | Buy signals for stocks not in any portfolio        |
| GET    | `/api/portfolio/{portfolio}/suggestions` | Targeted additions to fill portfolio gaps       |

### Utilities

| Method | Endpoint                  | Description                              |
|--------|---------------------------|------------------------------------------|
| GET    | `/api/history/{ticker}`   | OHLCV price history for charting         |
| GET    | `/api/validate/{ticker}`  | Validate a ticker symbol                 |

### Retirement Planner

| Method | Endpoint       | Description                                                     |
|--------|----------------|-----------------------------------------------------------------|
| POST   | `/api/planner` | Run Monte Carlo + deterministic retirement projections          |

**Request body fields:**

| Field                   | Type    | Description                                          |
|-------------------------|---------|------------------------------------------------------|
| `current_age`           | int     | Your current age                                     |
| `retirement_age`        | int     | Target retirement age                                |
| `retirement_target_value` | float | Total portfolio value you want at retirement         |
| `aggression_early`      | string  | `aggressive` / `moderate_aggressive` / `moderate` / `conservative` |
| `aggression_late`       | string  | Same options for the phase approaching retirement    |
| `annual_401k`           | float   | Annual 401k contributions                            |
| `annual_roth_ira`       | float   | Annual Roth IRA contributions                        |
| `annual_other_savings`  | float   | All other annual savings added to portfolio          |
| `external_401k`         | float   | Current 401k balance held outside this tracker      |
| `external_ira`          | float   | Current IRA balance held outside this tracker       |
| `external_cash`         | float   | Cash / HYSA outside this tracker                    |
| `external_real_estate`  | float   | Real estate equity outside this tracker             |
| `external_other`        | float   | Any other assets outside this tracker               |

---

## Recommendation Engine

Each holding is scored on a scale of roughly −75 to +75 using 7 factors, calibrated for a **long-term investor** (multi-decade horizon, not a 1-year view). S&P 500 index trackers (VOO, SPY, IVV, etc.) are scored separately — alpha is set to zero and proximity to 52-week highs is treated as a bullish signal rather than a frothiness risk.

| Signal                           | Max Points |
|----------------------------------|-----------|
| Alpha vs S&P 500 since purchase  | ±35       |
| 52-week price position (context-aware) | ±20 |
| P/E ratio                        | ±15       |
| Today's momentum                 | ±3        |
| Beta (volatility)                | ±10       |
| Market cap / liquidity           | ±5        |
| Distance from 52-week high       | ±5        |

| Score  | Recommendation |
|--------|---------------|
| ≥ 40   | STRONG BUY    |
| ≥ 18   | BUY           |
| ≥ −12  | HOLD          |
| ≥ −35  | SELL          |
| < −35  | STRONG SELL   |

The 52-week range factor is context-aware: a stock near its 52-week high with extreme P/E and negative alpha is penalized (frothy), while strong price momentum with reasonable valuation is rewarded. This prevents the engine from blindly flagging healthy momentum stocks as sells.

---

## Notes

- `holdings.json` is in `.gitignore` — your personal portfolio data is never committed
- Market data is cached in memory for 60 seconds to avoid excessive API calls
- The Retirement Planner uses previous-day close prices fetched in a single batch request, making it significantly faster than live per-ticker lookups
- Prices from Yahoo Finance may be delayed ~15 minutes during market hours
- This is a personal finance tool, not professional financial advice
