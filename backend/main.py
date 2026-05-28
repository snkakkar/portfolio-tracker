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

# Tickers that ARE the S&P 500 benchmark — comparing them to themselves is
# meaningless, so we zero out alpha and treat sp_gain = their own gain.
SP500_TRACKERS = {"VOO", "SPY", "IVV", "SPLG", "VFINX", "FXAIX", "SWPPX"}


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

    # S&P 500 (VOO) benchmark since purchase date.
    # For tickers that ARE S&P 500 trackers, alpha is always 0 by definition.
    if ticker.upper() in SP500_TRACKERS:
        sp_gain_pct = gain_pct
        sp_gain_dollar = gain
        alpha = 0.0
    else:
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
        "rec_breakdown": rec["breakdown"],
        "rec_next_tier": rec.get("next_tier"),
        "rec_next_pts": rec.get("next_pts_needed"),
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

        if ticker.upper() in SP500_TRACKERS:
            sp_gain_pct = hyp_gain_pct or 0.0
            alpha = 0.0
        else:
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
            "rec_breakdown": rec["breakdown"],
            "rec_next_tier": rec.get("next_tier"),
            "rec_next_pts": rec.get("next_pts_needed"),
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
    # ETFs worth considering (excluding S&P trackers — alpha comparison meaningless)
    "QQQ", "IWM", "ARKK", "XLK", "XLF", "XLE", "XLV",
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
            # S&P trackers have no alpha by definition
            if ticker.upper() in SP500_TRACKERS:
                alpha = 0.0
            else:
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
                "rec_breakdown": rec["breakdown"],
                "rec_next_tier": rec.get("next_tier"),
                "rec_next_pts": rec.get("next_pts_needed"),
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


# ─── Portfolio Suggestions ────────────────────────────────────────────────────

# Candidates to consider when a gap is detected.
# Key = gap_type, value = (etf_candidates, stock_candidates)
_GAP_CANDIDATES: dict[str, tuple[list[str], list[str]]] = {
    "Technology":               (["XLK", "VGT", "SOXX"],             ["MSFT", "AAPL", "NVDA", "AVGO", "CRM", "NOW"]),
    "Healthcare":               (["XLV", "VHT"],                     ["UNH", "LLY", "ABBV", "ISRG", "TMO"]),
    "Financials":               (["XLF", "VFH"],                     ["JPM", "V", "MA", "GS", "BRK-B"]),
    "Consumer Discretionary":   (["XLY", "VCR"],                     ["AMZN", "HD", "MCD", "COST", "NKE"]),
    "Consumer Staples":         (["XLP", "VDC"],                     ["PG", "KO", "WMT", "CL"]),
    "Energy":                   (["XLE", "VDE"],                     ["XOM", "CVX", "COP", "MPC"]),
    "Industrials":              (["XLI", "VIS"],                     ["HON", "CAT", "RTX", "DE", "UPS"]),
    "Communication Services":   (["XLC", "VOX"],                     ["META", "GOOGL", "NFLX", "VZ"]),
    "Utilities":                (["XLU", "VPU"],                     ["NEE", "DUK", "SO"]),
    "Real Estate":              (["XLRE", "VNQ"],                    ["AMT", "PLD", "WELL"]),
    "Materials":                (["XLB", "VAW"],                     ["LIN", "APD", "NEM"]),
    # Structural gaps
    "reduce_beta":              (["XLP", "XLU", "USMV", "SPLV"],    ["JNJ", "PG", "KO", "WMT", "NEE"]),
    "add_value":                (["IVE", "VTV", "SCHV", "VYM"],     ["BRK-B", "JPM", "XOM", "CVX", "BAC"]),
    "add_diversification":      (["QQQ", "IWM", "VTI", "SCHD"],    ["BRK-B", "MSFT", "JNJ", "JPM", "PG"]),
    "add_income":               (["SCHD", "VYM", "HDV", "DGRO"],   ["KO", "PG", "JNJ", "MMM", "VZ"]),
}

# All main GICS sectors for gap detection
ALL_SECTORS = [
    "Technology", "Healthcare", "Financials", "Consumer Discretionary",
    "Consumer Staples", "Energy", "Industrials", "Communication Services",
    "Utilities", "Real Estate", "Materials",
]

IS_ETF_PORTFOLIO = {"etfs", "retirement_etfs"}


def _fetch_suggestion(ticker: str, gap_type: str, why: str, voo_1y_data: tuple) -> Optional[dict]:
    """Enrich a single suggestion candidate."""
    try:
        voo_now, voo_1y = voo_1y_data
        quote = md.get_quote(ticker.upper())
        price = quote.get("price", 0)
        if not price:
            return None

        one_year_ago = (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")
        sp_gain = round((voo_now - voo_1y) / voo_1y * 100, 4) if voo_1y else 0.0
        price_1y = md.get_historical_price(ticker.upper(), one_year_ago)
        stock_gain_pct = round((price - price_1y) / price_1y * 100, 4) if price_1y else 0.0

        if ticker.upper() in SP500_TRACKERS:
            alpha = 0.0
        else:
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
            "rec_breakdown": rec["breakdown"],
            "rec_next_tier": rec.get("next_tier"),
            "rec_next_pts": rec.get("next_pts_needed"),
            "gap_type": gap_type,
            "why_it_helps": why,
        }
    except Exception:
        return None


@app.get("/api/portfolio/{portfolio}/suggestions")
def get_portfolio_suggestions(portfolio: str):
    """
    Analyses the current portfolio and suggests external stocks/ETFs
    that would address its specific structural weaknesses.
    """
    if portfolio not in PORTFOLIO_LABELS:
        raise HTTPException(status_code=404, detail=f"Portfolio '{portfolio}' not found")

    raw = h_store.get_portfolio(portfolio)
    if not raw:
        return {"suggestions": [], "gaps": []}

    # Enrich all current holdings (VOO already cached by port endpoint, but ensure fresh)
    md.get_quote("VOO")
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        holdings = list(ex.map(enrich_holding, raw))

    owned: set[str] = {h["ticker"].upper() for h in holdings}

    # ── Compute portfolio profile ─────────────────────────────────────────────
    total_value = sum(h["current_value"] for h in holdings)
    if total_value == 0:
        return {"suggestions": [], "gaps": []}

    sectors_present: set[str] = {h["sector"] for h in holdings if h.get("sector")}
    sector_weights: dict[str, float] = {}
    for h in holdings:
        s = h.get("sector")
        if s:
            sector_weights[s] = sector_weights.get(s, 0) + h["current_value"] / total_value

    beta_holdings = [h for h in holdings if h.get("beta")]
    port_beta = (
        sum(h["beta"] * h["current_value"] / total_value for h in beta_holdings)
        if beta_holdings else None
    )

    pe_holdings = [h for h in holdings if h.get("pe_ratio") and h["pe_ratio"] > 0 and h["pe_ratio"] < 500]
    avg_pe = (
        sum(h["pe_ratio"] for h in pe_holdings) / len(pe_holdings)
        if pe_holdings else None
    )

    avg_alpha = sum(h["alpha"] for h in holdings) / len(holdings)

    sorted_by_value = sorted(holdings, key=lambda h: h["current_value"], reverse=True)
    top3_pct = sum(h["current_value"] / total_value for h in sorted_by_value[:3]) * 100

    # Are dividends/income already represented? (very rough proxy: Consumer Staples, Utilities, REITs)
    income_sectors = {"Consumer Staples", "Utilities", "Real Estate"}
    has_income_exposure = bool(sectors_present & income_sectors)

    use_etfs = portfolio in IS_ETF_PORTFOLIO

    # ── Identify gaps and build candidate list ────────────────────────────────
    # Each entry: (gap_type, why_it_helps, [tickers], priority_score)
    gap_queue: list[tuple[str, str, list[str], int]] = []

    # 1. Missing sectors (pick up to 3 biggest gaps)
    missing_sectors = [s for s in ALL_SECTORS if s not in sectors_present]
    # Prioritise high-value diversifying sectors first
    SECTOR_PRIORITY = ["Healthcare", "Consumer Staples", "Financials", "Energy",
                       "Utilities", "Industrials", "Real Estate", "Materials",
                       "Consumer Discretionary", "Communication Services", "Technology"]
    missing_sectors.sort(key=lambda s: SECTOR_PRIORITY.index(s) if s in SECTOR_PRIORITY else 99)
    for sector in missing_sectors[:3]:
        etf_cands, stock_cands = _GAP_CANDIDATES.get(sector, ([], []))
        candidates = etf_cands if use_etfs else stock_cands
        candidates = [c for c in candidates if c.upper() not in owned][:2]
        if candidates:
            pct_of_sp = {"Healthcare": 12, "Financials": 13, "Consumer Staples": 7,
                         "Energy": 4, "Industrials": 9, "Technology": 29,
                         "Consumer Discretionary": 10, "Communication Services": 9,
                         "Utilities": 2, "Real Estate": 2, "Materials": 3}.get(sector, 5)
            gap_queue.append((
                sector,
                f"Zero {sector} exposure — sector represents ~{pct_of_sp}% of the S&P 500. "
                f"Adding {candidates[0]} would create a defensive anchor in an uncovered area.",
                candidates,
                10 - SECTOR_PRIORITY.index(sector) if sector in SECTOR_PRIORITY else 0,
            ))

    # 2. High portfolio beta → suggest defensive/low-vol
    if port_beta is not None and port_beta > 1.4:
        etf_cands, stock_cands = _GAP_CANDIDATES["reduce_beta"]
        candidates = [c for c in (etf_cands if use_etfs else stock_cands) if c.upper() not in owned][:2]
        if candidates:
            gap_queue.append((
                "reduce_beta",
                f"Portfolio beta of {port_beta:.2f} amplifies market swings by "
                f"{(port_beta-1)*100:.0f}%. Adding low-beta defensives would dampen drawdowns "
                f"without sacrificing much upside.",
                candidates,
                12,
            ))

    # 3. High average P/E → suggest value plays
    if avg_pe is not None and avg_pe > 32:
        etf_cands, stock_cands = _GAP_CANDIDATES["add_value"]
        candidates = [c for c in (etf_cands if use_etfs else stock_cands) if c.upper() not in owned][:2]
        if candidates:
            gap_queue.append((
                "add_value",
                f"Average P/E of {avg_pe:.1f}x leaves the portfolio vulnerable to multiple "
                f"compression. Value names provide a margin-of-safety buffer.",
                candidates,
                9,
            ))

    # 4. High concentration → broad diversifiers
    if top3_pct > 55:
        etf_cands, stock_cands = _GAP_CANDIDATES["add_diversification"]
        candidates = [c for c in (etf_cands if use_etfs else stock_cands) if c.upper() not in owned][:2]
        if candidates:
            gap_queue.append((
                "add_diversification",
                f"Top 3 positions = {top3_pct:.0f}% of portfolio. A single bad quarter "
                f"in one name has outsized impact. Adding a diversified vehicle reduces idiosyncratic risk.",
                candidates,
                11,
            ))

    # 5. No income/dividend exposure
    if not has_income_exposure and not use_etfs:
        etf_cands, stock_cands = _GAP_CANDIDATES["add_income"]
        candidates = [c for c in stock_cands if c.upper() not in owned][:2]
        if candidates:
            gap_queue.append((
                "add_income",
                "No dividend-paying positions detected. Income-generating names reduce overall "
                "portfolio volatility and provide return during flat/down markets.",
                candidates,
                7,
            ))

    # Sort by priority and flatten candidates (deduplicated)
    gap_queue.sort(key=lambda x: x[3], reverse=True)

    # Pick up to 6 unique candidates with their gap context
    seen: set[str] = set()
    fetch_tasks: list[tuple[str, str, str]] = []  # (ticker, gap_type, why)
    for gap_type, why, cands, _ in gap_queue:
        for ticker in cands:
            if ticker.upper() not in seen and ticker.upper() not in owned:
                seen.add(ticker.upper())
                fetch_tasks.append((ticker, gap_type, why))
            if len(fetch_tasks) >= 7:
                break
        if len(fetch_tasks) >= 7:
            break

    if not fetch_tasks:
        return {"suggestions": [], "gaps": [g[0] for g in gap_queue]}

    # ── Enrich candidates in parallel ────────────────────────────────────────
    voo_now = md.get_quote("VOO")["price"]
    one_year_ago = (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")
    voo_1y = md.get_historical_price("VOO", one_year_ago)
    voo_data = (voo_now, voo_1y)

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        results = list(ex.map(lambda t: _fetch_suggestion(t[0], t[1], t[2], voo_data), fetch_tasks))

    # Filter None, keep only HOLD or better (no point suggesting something we'd rate a SELL)
    ACCEPTABLE = {"STRONG BUY", "BUY", "HOLD"}
    suggestions = [
        r for r in results
        if r is not None and r["recommendation"] in ACCEPTABLE
    ]
    # Sort: BUY/STRONG BUY first, then by score
    suggestions.sort(key=lambda x: x["rec_score"], reverse=True)

    return {
        "suggestions": suggestions[:6],
        "gaps": [g[0] for g in gap_queue],
    }


@app.get("/")
def root():
    return {"status": "Portfolio Tracker API running"}
