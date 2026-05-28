from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
import concurrent.futures

import holdings as h_store
import market_data as md
from recommendations import score_holding

app = FastAPI(title="Portfolio Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PORTFOLIO_LABELS = {
    "stocks": "Brokerage Stocks",
    "etfs": "Brokerage ETFs",
    "retirement_stocks": "Retirement Stocks",
    "retirement_etfs": "Retirement ETFs",
}

# Watchlist is separate — not a portfolio, just stocks to monitor
WATCHLIST_KEY = "watchlist"


# ─── Pydantic models ──────────────────────────────────────────────────────────

class HoldingIn(BaseModel):
    ticker: str
    shares: float
    purchase_date: str  # YYYY-MM-DD
    cost_per_share: Optional[float] = None  # auto-fetched if omitted


class HoldingUpdate(BaseModel):
    shares: Optional[float] = None
    purchase_date: Optional[str] = None
    cost_per_share: Optional[float] = None


# ─── Helper ───────────────────────────────────────────────────────────────────

def enrich_holding(raw: dict) -> dict:
    ticker = raw["ticker"]
    shares = raw["shares"]
    cost_per_share = raw["cost_per_share"]
    purchase_date = raw["purchase_date"]

    quote = md.get_quote(ticker)
    price = quote["price"]

    total_cost = round(shares * cost_per_share, 2)
    current_value = round(shares * price, 2)
    gain = round(current_value - total_cost, 2)
    gain_pct = round((gain / total_cost * 100) if total_cost else 0.0, 4)

    # S&P 500 (VOO) benchmark since purchase date
    voo_at_purchase = md.get_voo_price_on_date(purchase_date)
    voo_now = md.get_quote("VOO")["price"]
    if voo_at_purchase and voo_at_purchase > 0 and voo_now > 0:
        sp_gain_pct = round((voo_now - voo_at_purchase) / voo_at_purchase * 100, 4)
        sp_gain_dollar = round((voo_now - voo_at_purchase) / voo_at_purchase * total_cost, 2)
        alpha = round((gain_pct - sp_gain_pct) / 100, 4)  # stored as decimal ratio
    else:
        sp_gain_pct = 0.0
        sp_gain_dollar = 0.0
        alpha = 0.0

    rec = score_holding(
        ticker=ticker,
        gain_pct=gain_pct / 100,
        alpha=alpha,
        price=price,
        week_52_high=quote.get("week_52_high"),
        week_52_low=quote.get("week_52_low"),
        pe_ratio=quote.get("pe_ratio"),
        beta=quote.get("beta"),
        change_pct=quote.get("change_pct", 0),
        market_cap=quote.get("market_cap"),
    )

    return {
        "ticker": ticker,
        "name": quote["name"],
        "shares": shares,
        "cost_per_share": cost_per_share,
        "purchase_date": purchase_date,
        "price": price,
        "change": quote["change"],
        "change_pct": quote["change_pct"],
        "total_cost": total_cost,
        "current_value": current_value,
        "gain": gain,
        "gain_pct": gain_pct,
        "sp_gain_pct": sp_gain_pct,
        "sp_gain_dollar": sp_gain_dollar,
        "alpha": alpha,
        "week_52_high": quote.get("week_52_high"),
        "week_52_low": quote.get("week_52_low"),
        "pe_ratio": quote.get("pe_ratio"),
        "beta": quote.get("beta"),
        "market_cap": quote.get("market_cap"),
        "sector": quote.get("sector"),
        "recommendation": rec["recommendation"],
        "rec_score": rec["score"],
        "rec_color": rec["color"],
        "rec_reasons": rec["reasons"],
    }


def build_portfolio_summary(holdings: list[dict]) -> dict:
    total_cost = sum(h["total_cost"] for h in holdings)
    total_value = sum(h["current_value"] for h in holdings)
    total_gain = round(total_value - total_cost, 2)
    gain_pct = round((total_gain / total_cost * 100) if total_cost else 0.0, 4)
    todays_gain = round(sum(h["change_pct"] / 100 * h["current_value"] for h in holdings), 2)

    return {
        "total_cost": round(total_cost, 2),
        "total_value": round(total_value, 2),
        "total_gain": total_gain,
        "gain_pct": gain_pct,
        "todays_gain": todays_gain,
    }


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/api/portfolio/{portfolio}")
def get_portfolio(portfolio: str):
    if portfolio not in PORTFOLIO_LABELS:
        raise HTTPException(status_code=404, detail=f"Portfolio '{portfolio}' not found")
    raw_holdings = h_store.get_portfolio(portfolio)

    # Fetch VOO once
    md.get_quote("VOO")

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
        enriched = list(ex.map(enrich_holding, raw_holdings))

    summary = build_portfolio_summary(enriched)
    return {
        "portfolio": portfolio,
        "label": PORTFOLIO_LABELS[portfolio],
        "summary": summary,
        "holdings": enriched,
    }


@app.get("/api/portfolio")
def get_all_portfolios():
    """Returns summary for all portfolios combined (for the dashboard)."""
    all_holdings = []

    md.get_quote("VOO")

    raw_all = []
    for portfolio in PORTFOLIO_LABELS:
        for raw in h_store.get_portfolio(portfolio):
            raw_all.append((portfolio, raw))

    def enrich_with_portfolio(item):
        portfolio, raw = item
        enriched = enrich_holding(raw)
        enriched["portfolio"] = portfolio
        enriched["portfolio_label"] = PORTFOLIO_LABELS[portfolio]
        return enriched

    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as ex:
        all_holdings = list(ex.map(enrich_with_portfolio, raw_all))

    per_portfolio = {}
    for portfolio in PORTFOLIO_LABELS:
        ph = [h for h in all_holdings if h["portfolio"] == portfolio]
        per_portfolio[portfolio] = {
            "label": PORTFOLIO_LABELS[portfolio],
            "summary": build_portfolio_summary(ph),
            "holdings": ph,
        }

    overall_summary = build_portfolio_summary(all_holdings)

    sorted_by_gain = sorted(all_holdings, key=lambda h: h["gain_pct"], reverse=True)
    top_performers = sorted_by_gain[:5]
    worst_performers = sorted_by_gain[-5:][::-1]

    return {
        "overall_summary": overall_summary,
        "portfolios": per_portfolio,
        "top_performers": top_performers,
        "worst_performers": worst_performers,
        "all_holdings": all_holdings,
    }


@app.get("/api/history/{ticker}")
def get_history(ticker: str, period: str = "1y"):
    valid_periods = ["1mo", "3mo", "6mo", "1y", "2y", "5y"]
    if period not in valid_periods:
        period = "1y"
    data = md.get_price_history(ticker.upper(), period)
    return {"ticker": ticker.upper(), "period": period, "history": data}


@app.get("/api/quote/{ticker}")
def get_single_quote(ticker: str):
    return md.get_quote(ticker.upper())


# ─── Watchlist endpoint ───────────────────────────────────────────────────────

@app.get("/api/watchlist")
def get_watchlist():
    """Returns watchlist items enriched with live quote data (no portfolio math)."""
    raw = h_store.get_portfolio(WATCHLIST_KEY)
    md.get_quote("VOO")

    def enrich_watch(item: dict) -> dict:
        ticker = item["ticker"]
        quote = md.get_quote(ticker)
        price = quote["price"]
        cost = item.get("cost_per_share", 0)
        shares = item.get("shares", 0)
        purchase_date = item.get("purchase_date", "")

        # Hypothetical gain if tracking cost
        hyp_gain = round((price - cost) * shares, 2) if cost and price else None
        hyp_gain_pct = round((price - cost) / cost * 100, 4) if cost and price else None

        voo_at_purchase = md.get_voo_price_on_date(purchase_date) if purchase_date else None
        voo_now = md.get_quote("VOO")["price"]
        if voo_at_purchase and voo_at_purchase > 0 and voo_now > 0:
            sp_gain_pct = round((voo_now - voo_at_purchase) / voo_at_purchase * 100, 4)
            alpha = round(((hyp_gain_pct or 0) - sp_gain_pct) / 100, 4)
        else:
            sp_gain_pct = 0.0
            alpha = 0.0

        rec = score_holding(
            ticker=ticker,
            gain_pct=(hyp_gain_pct or 0) / 100,
            alpha=alpha,
            price=price,
            week_52_high=quote.get("week_52_high"),
            week_52_low=quote.get("week_52_low"),
            pe_ratio=quote.get("pe_ratio"),
            beta=quote.get("beta"),
            change_pct=quote.get("change_pct", 0),
            market_cap=quote.get("market_cap"),
        )

        return {
            "ticker": ticker,
            "name": quote["name"],
            "price": price,
            "change": quote["change"],
            "change_pct": quote["change_pct"],
            "week_52_high": quote.get("week_52_high"),
            "week_52_low": quote.get("week_52_low"),
            "pe_ratio": quote.get("pe_ratio"),
            "beta": quote.get("beta"),
            "market_cap": quote.get("market_cap"),
            "sector": quote.get("sector"),
            "tracked_since": purchase_date,
            "tracked_price": cost,
            "hyp_gain": hyp_gain,
            "hyp_gain_pct": hyp_gain_pct,
            "sp_gain_pct": sp_gain_pct,
            "alpha": alpha,
            "recommendation": rec["recommendation"],
            "rec_score": rec["score"],
            "rec_color": rec["color"],
            "rec_reasons": rec["reasons"],
        }

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
        items = list(ex.map(enrich_watch, raw))

    return {"items": items}


@app.post("/api/watchlist")
def add_to_watchlist(body: HoldingIn):
    ticker = body.ticker.upper()
    cost = body.cost_per_share
    if cost is None:
        quote = md.get_quote(ticker)
        if quote["price"] == 0:
            raise HTTPException(status_code=400, detail=f"Could not find ticker '{ticker}'")
        cost = quote["price"]
    item = h_store.add_holding(WATCHLIST_KEY, ticker, body.shares or 0, cost, body.purchase_date)
    return item


@app.delete("/api/watchlist/{ticker}")
def remove_from_watchlist(ticker: str):
    try:
        h_store.delete_holding(WATCHLIST_KEY, ticker.upper())
        return {"ok": True}
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ─── Holdings CRUD (portfolios only, not watchlist) ──────────────────────────

def _require_portfolio(portfolio: str):
    if portfolio not in PORTFOLIO_LABELS:
        raise HTTPException(status_code=404, detail="Portfolio not found")


@app.get("/api/holdings/{portfolio}")
def list_holdings(portfolio: str):
    _require_portfolio(portfolio)
    return h_store.get_portfolio(portfolio)


@app.post("/api/holdings/{portfolio}")
def add_holding(portfolio: str, body: HoldingIn):
    _require_portfolio(portfolio)
    ticker = body.ticker.upper()

    cost = body.cost_per_share
    if cost is None:
        quote = md.get_quote(ticker)
        if quote["price"] == 0:
            raise HTTPException(status_code=400, detail=f"Could not find ticker '{ticker}'")
        cost = quote["price"]

    holding = h_store.add_holding(portfolio, ticker, body.shares, cost, body.purchase_date)
    return enrich_holding(holding)


@app.put("/api/holdings/{portfolio}/{ticker}")
def update_holding(portfolio: str, ticker: str, body: HoldingUpdate):
    _require_portfolio(portfolio)
    try:
        updates = body.model_dump(exclude_none=True)
        holding = h_store.update_holding(portfolio, ticker.upper(), updates)
        return enrich_holding(holding)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.delete("/api/holdings/{portfolio}/{ticker}")
def remove_holding(portfolio: str, ticker: str):
    _require_portfolio(portfolio)
    try:
        h_store.delete_holding(portfolio, ticker.upper())
        return {"ok": True}
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/validate/{ticker}")
def validate_ticker(ticker: str):
    """Check if a ticker symbol is valid before adding it."""
    quote = md.get_quote(ticker.upper())
    if quote["price"] == 0 and "error" in quote:
        return {"valid": False, "ticker": ticker.upper()}
    return {"valid": True, "ticker": ticker.upper(), "name": quote["name"], "price": quote["price"]}


# ─── Stock Discovery ──────────────────────────────────────────────────────────

# Curated universe of high-quality stocks across sectors for discovery
DISCOVERY_UNIVERSE = [
    # Technology
    "MSFT", "AAPL", "GOOGL", "META", "AMZN", "NVDA", "AMD", "AVGO", "ORCL", "CRM",
    "ADBE", "INTC", "QCOM", "TXN", "AMAT", "NOW", "SNOW", "MDB", "PLTR", "DDOG",
    # Finance
    "JPM", "BAC", "GS", "MS", "V", "MA", "AXP", "BRK-B", "BLK", "SCHW",
    # Healthcare
    "UNH", "JNJ", "LLY", "ABBV", "MRK", "PFE", "TMO", "DHR", "ISRG", "CVS",
    # Consumer
    "AMZN", "TSLA", "HD", "MCD", "SBUX", "NKE", "TGT", "WMT", "COST", "PG",
    # Energy
    "XOM", "CVX", "COP", "SLB", "EOG", "MPC",
    # Industrials / Other
    "RTX", "BA", "CAT", "DE", "HON", "LMT", "GE", "UPS", "FDX",
    # ETFs worth considering
    "SPY", "QQQ", "IWM", "ARKK", "XLK", "XLF", "XLE", "XLV",
]


@app.get("/api/discover")
def discover_stocks():
    """
    Returns buy/sell signals for stocks NOT already in any portfolio,
    ranked by recommendation score descending.
    """
    # Collect all owned tickers
    owned: set[str] = set()
    for portfolio in PORTFOLIO_LABELS:
        for h in h_store.get_portfolio(portfolio):
            owned.add(h["ticker"].upper())
    for h in h_store.get_portfolio(WATCHLIST_KEY):
        owned.add(h["ticker"].upper())

    candidates = list(dict.fromkeys(
        t for t in DISCOVERY_UNIVERSE if t.upper() not in owned
    ))

    def score_candidate(ticker: str) -> Optional[dict]:
        try:
            quote = md.get_quote(ticker.upper())
            price = quote.get("price", 0)
            if not price:
                return None

            one_year_ago = (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")
            voo_now = md.get_quote("VOO")["price"]
            voo_1y  = md.get_historical_price("VOO", one_year_ago)
            sp_gain = round((voo_now - voo_1y) / voo_1y * 100, 4) if voo_1y else 0.0

            # Use 1-year price change vs S&P as alpha proxy for discovery
            price_1y = md.get_historical_price(ticker.upper(), one_year_ago)
            stock_gain_pct = round((price - price_1y) / price_1y * 100, 4) if price_1y else 0.0
            alpha = round((stock_gain_pct - sp_gain) / 100, 4)

            rec = score_holding(
                ticker=ticker,
                gain_pct=stock_gain_pct / 100,
                alpha=alpha,
                price=price,
                week_52_high=quote.get("week_52_high"),
                week_52_low=quote.get("week_52_low"),
                pe_ratio=quote.get("pe_ratio"),
                beta=quote.get("beta"),
                change_pct=quote.get("change_pct", 0),
                market_cap=quote.get("market_cap"),
            )

            return {
                "ticker": ticker.upper(),
                "name": quote["name"],
                "price": price,
                "change": quote["change"],
                "change_pct": quote["change_pct"],
                "gain_1y_pct": stock_gain_pct,
                "sp_gain_pct": sp_gain,
                "alpha": alpha,
                "week_52_high": quote.get("week_52_high"),
                "week_52_low": quote.get("week_52_low"),
                "pe_ratio": quote.get("pe_ratio"),
                "beta": quote.get("beta"),
                "market_cap": quote.get("market_cap"),
                "sector": quote.get("sector"),
                "recommendation": rec["recommendation"],
                "rec_score": rec["score"],
                "rec_color": rec["color"],
                "rec_reasons": rec["reasons"],
            }
        except Exception:
            return None

    md.get_quote("VOO")
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as ex:
        results = list(ex.map(score_candidate, candidates))

    valid = [r for r in results if r is not None]
    valid.sort(key=lambda x: x["rec_score"], reverse=True)

    return {
        "stocks": valid,
        "owned_count": len(owned),
        "universe_size": len(candidates),
    }


@app.get("/")
def root():
    return {"status": "Portfolio Tracker API running"}
