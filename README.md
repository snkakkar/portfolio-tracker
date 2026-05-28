# Portfolio Tracker

A full-stack brokerage portfolio tracker with live market data, advanced analytics, and AI-powered buy/sell recommendations.

![Dashboard](https://img.shields.io/badge/status-active-brightgreen) ![Python](https://img.shields.io/badge/python-3.9%2B-blue) ![React](https://img.shields.io/badge/react-18-61dafb)

## Features

- **Live Market Data** — Real-time prices, daily changes, and fundamentals via Yahoo Finance
- **4 Portfolio Accounts** — Brokerage Stocks, Brokerage ETFs, Retirement Stocks, Retirement ETFs
- **Watchlist** — Monitor stocks without adding them to a portfolio
- **Buy/Sell Recommendations** — 7-signal scoring engine (alpha, 52W range, P/E, momentum, beta, market cap, distance from 52W high)
- **Stock Discovery** — Scans a curated 60+ stock universe and surfaces buy opportunities not currently in your portfolio
- **Analytics Tab** — Win rate, annualized return (CAGR), portfolio beta, sector weights, today's movers
- **52-Week Range Visualizer** — Color-coded slider showing where each stock sits in its annual range
- **Add / Edit / Remove** positions with live validation
- **Dark mode** UI with Inter + JetBrains Mono fonts

## Tech Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Frontend  | React 18 + TypeScript + Vite        |
| Styling   | Tailwind CSS + Framer Motion        |
| Charts    | Recharts                            |
| Backend   | FastAPI (Python)                    |
| Market Data | yfinance                          |
| State     | TanStack Query (React Query)        |
| Data store | `holdings.json` (local file)       |

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

Copy the sample holdings file and edit it with your own positions:

```bash
cp backend/holdings.sample.json backend/holdings.json
```

Edit `backend/holdings.json` — add your tickers, share counts, average cost, and purchase dates. All other metrics (current price, gain, S&P comparison, alpha, recommendations) are computed automatically.

**holdings.json structure:**
```json
{
  "stocks":            [{ "ticker": "AAPL", "shares": 10, "cost_per_share": 150.00, "purchase_date": "2022-01-15" }],
  "etfs":              [...],
  "retirement_stocks": [...],
  "retirement_etfs":   [...],
  "watchlist":         [{ "ticker": "NVDA", "shares": 0, "cost_per_share": 500.00, "purchase_date": "2024-01-01" }]
}
```

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

## Project Structure

```
portfolio-tracker/
├── backend/
│   ├── main.py               # FastAPI app & all API routes
│   ├── recommendations.py    # 7-signal scoring engine
│   ├── market_data.py        # yfinance wrapper with caching
│   ├── holdings.py           # CRUD for holdings.json
│   ├── holdings.sample.json  # Template — copy to holdings.json
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/            # Overview, PortfolioPage, WatchlistPage
│   │   ├── components/       # SummaryCard, HoldingsTable, StockDiscovery, ...
│   │   ├── api/client.ts     # Axios API client
│   │   └── types.ts          # TypeScript interfaces
│   ├── tailwind.config.js
│   └── vite.config.ts
├── start.sh
└── README.md
```

## API Endpoints

| Method | Endpoint                          | Description                             |
|--------|-----------------------------------|-----------------------------------------|
| GET    | `/api/portfolio`                  | All portfolios combined (dashboard)     |
| GET    | `/api/portfolio/{name}`           | Single portfolio with enriched holdings |
| POST   | `/api/holdings/{portfolio}`       | Add a position                          |
| PUT    | `/api/holdings/{portfolio}/{ticker}` | Update shares / cost / date          |
| DELETE | `/api/holdings/{portfolio}/{ticker}` | Remove a position                    |
| GET    | `/api/watchlist`                  | Watchlist with live data                |
| POST   | `/api/watchlist`                  | Add to watchlist                        |
| DELETE | `/api/watchlist/{ticker}`         | Remove from watchlist                   |
| GET    | `/api/discover`                   | Buy/sell signals for stocks not owned   |
| GET    | `/api/history/{ticker}`           | OHLCV price history for charting        |
| GET    | `/api/validate/{ticker}`          | Validate a ticker symbol                |

## Recommendation Engine

Each holding is scored on a scale of roughly −75 to +75 using 7 factors:

| Signal | Max Points |
|--------|-----------|
| Alpha vs S&P 500 since purchase | ±35 |
| 52-week price position | ±20 |
| P/E ratio | ±15 |
| Today's momentum | ±10 |
| Beta (volatility) | ±10 |
| Market cap / liquidity | ±5 |
| Distance from 52-week high | ±5 |

| Score | Recommendation |
|-------|---------------|
| ≥ 55  | STRONG BUY    |
| ≥ 28  | BUY           |
| ≥ −8  | HOLD          |
| ≥ −28 | SELL          |
| < −28 | STRONG SELL   |

## Notes

- `holdings.json` is in `.gitignore` — your personal portfolio data is never committed
- Market data is cached in memory for 60 seconds to avoid excessive API calls
- Prices from Yahoo Finance may be delayed ~15 minutes
- This is a personal tool, not financial advice
