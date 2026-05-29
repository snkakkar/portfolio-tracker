import yfinance as yf
from datetime import datetime, timedelta
from functools import lru_cache
import time
from typing import Optional
import pandas as pd

# Simple in-memory cache with TTL
_cache: dict = {}
_cache_ttl = 60  # seconds


def _cache_get(key: str):
    if key in _cache:
        val, ts = _cache[key]
        if time.time() - ts < _cache_ttl:
            return val
    return None


def _cache_set(key: str, val):
    _cache[key] = (val, time.time())


# yfinance routinely returns null `sector` and `beta` for ETFs (it only fills
# those for individual equities). Without these, downstream analytics
# (sector-diversification check, weighted portfolio beta, fit assessment) get
# systematically penalised on ETF-heavy portfolios. We patch the gap with a
# small curated table of common ETF metadata. The "Broad Market" sector tag is
# special: AnalystReport treats it as inherently multi-sector and excludes it
# from sector-concentration math.
ETF_DEFAULTS: dict[str, dict] = {
    # Broad-market index funds (S&P 500 / Total Market / Nasdaq-100 / small-cap)
    "VOO":  {"sector": "Broad Market", "beta": 1.00},
    "SPY":  {"sector": "Broad Market", "beta": 1.00},
    "IVV":  {"sector": "Broad Market", "beta": 1.00},
    "SPLG": {"sector": "Broad Market", "beta": 1.00},
    "VTI":  {"sector": "Broad Market", "beta": 1.00},
    "ITOT": {"sector": "Broad Market", "beta": 1.00},
    "VB":   {"sector": "Broad Market", "beta": 1.15},
    "VTV":  {"sector": "Broad Market", "beta": 0.90},
    "VUG":  {"sector": "Broad Market", "beta": 1.10},
    # QQQ/QQQM are ~50% Technology, ~17% Communication Services. Treating
    # them as "Broad Market" inflates the diversification score; tag as Technology.
    "QQQ":  {"sector": "Technology", "beta": 1.15},
    "QQQM": {"sector": "Technology", "beta": 1.15},
    "DIA":  {"sector": "Broad Market", "beta": 0.95},
    "IWM":  {"sector": "Broad Market", "beta": 1.20},
    "VEA":  {"sector": "Broad Market", "beta": 0.90},
    "VWO":  {"sector": "Broad Market", "beta": 0.95},
    "VXUS": {"sector": "Broad Market", "beta": 0.90},
    # Sector ETFs
    "VGT":  {"sector": "Technology",     "beta": 1.20},
    "XLK":  {"sector": "Technology",     "beta": 1.15},
    "SOXX": {"sector": "Technology",     "beta": 1.60},
    "SMH":  {"sector": "Technology",     "beta": 1.55},
    "ARKQ": {"sector": "Technology",     "beta": 1.55},
    "ARKW": {"sector": "Technology",     "beta": 1.60},
    "ARKK": {"sector": "Technology",     "beta": 1.65},
    # Mega-cap growth ETFs are 50-65% Tech under the hood — tag accordingly
    # so they don't escape Tech-concentration accounting.
    "MGK":  {"sector": "Technology",     "beta": 1.20},
    "MGC":  {"sector": "Technology",     "beta": 1.10},
    "SCHG": {"sector": "Technology",     "beta": 1.20},
    "IUSG": {"sector": "Technology",     "beta": 1.15},
    "VDE":  {"sector": "Energy",         "beta": 0.90},
    "XLE":  {"sector": "Energy",         "beta": 0.90},
    "XLV":  {"sector": "Healthcare",     "beta": 0.75},
    "VHT":  {"sector": "Healthcare",     "beta": 0.75},
    "XLF":  {"sector": "Financials",     "beta": 1.10},
    "VFH":  {"sector": "Financials",     "beta": 1.10},
    "XLP":  {"sector": "Consumer Staples","beta": 0.65},
    "VDC":  {"sector": "Consumer Staples","beta": 0.65},
    "XLY":  {"sector": "Consumer Discretionary","beta": 1.25},
    "VCR":  {"sector": "Consumer Discretionary","beta": 1.25},
    "XLI":  {"sector": "Industrials",    "beta": 1.05},
    "VIS":  {"sector": "Industrials",    "beta": 1.05},
    "PPA":  {"sector": "Industrials",    "beta": 0.95},
    "ITA":  {"sector": "Industrials",    "beta": 0.95},
    "XLU":  {"sector": "Utilities",      "beta": 0.55},
    "VPU":  {"sector": "Utilities",      "beta": 0.55},
    "XLB":  {"sector": "Materials",      "beta": 1.10},
    "VAW":  {"sector": "Materials",      "beta": 1.10},
    "XLRE": {"sector": "Real Estate",    "beta": 0.85},
    "VNQ":  {"sector": "Real Estate",    "beta": 0.95},
    "XLC":  {"sector": "Communication Services","beta": 1.15},
    "VOX":  {"sector": "Communication Services","beta": 1.15},
    # Commodities / precious metals — bucketed under Materials for sector counts.
    "GLD":  {"sector": "Materials",      "beta": 0.10},
    "GLTR": {"sector": "Materials",      "beta": 0.10},
    "SLV":  {"sector": "Materials",      "beta": 0.20},
    "IAU":  {"sector": "Materials",      "beta": 0.10},
    # Bond ETFs — low/negative correlation to equities.
    "BND":  {"sector": "Broad Market",   "beta": 0.05},
    "AGG":  {"sector": "Broad Market",   "beta": 0.05},
    "TLT":  {"sector": "Broad Market",   "beta": -0.20},
    "VGLT": {"sector": "Broad Market",   "beta": -0.10},
}


def _safe_ma10(t) -> Optional[float]:
    """10-day moving average. yfinance's info dict only exposes 50d/200d, so
    pull a one-month window and average the last 10 closes ourselves."""
    try:
        closes = t.history(period="1mo")["Close"].dropna()
        if len(closes) >= 10:
            return round(float(closes.tail(10).mean()), 4)
    except Exception:
        pass
    return None


def get_quote(ticker: str) -> dict:
    key = f"quote:{ticker}"
    cached = _cache_get(key)
    if cached:
        return cached

    try:
        t = yf.Ticker(ticker)
        info = t.fast_info
        hist = t.history(period="2d")

        price = float(info.last_price) if hasattr(info, "last_price") and info.last_price else 0.0
        prev_close = float(info.previous_close) if hasattr(info, "previous_close") and info.previous_close else price

        change = price - prev_close
        change_pct = (change / prev_close * 100) if prev_close else 0.0

        # Try full info for richer data
        full_info = {}
        try:
            full_info = t.info or {}
        except Exception:
            pass

        ma_50 = full_info.get("fiftyDayAverage")
        ma_200 = full_info.get("twoHundredDayAverage")
        ma_10 = _safe_ma10(t)

        # ETF metadata fallback: yfinance leaves sector/beta null for funds, so
        # patch from our curated table when available. Only fills nulls — never
        # overwrites a value yfinance actually returned.
        etf_meta = ETF_DEFAULTS.get(ticker.upper())
        sector_val = full_info.get("sector") or (etf_meta or {}).get("sector")
        beta_val = full_info.get("beta")
        if beta_val is None and etf_meta is not None:
            beta_val = etf_meta.get("beta")

        result = {
            "ticker": ticker.upper(),
            "name": full_info.get("longName") or full_info.get("shortName") or ticker.upper(),
            "price": round(price, 4),
            "prev_close": round(prev_close, 4),
            "change": round(change, 4),
            "change_pct": round(change_pct, 4),
            "week_52_high": full_info.get("fiftyTwoWeekHigh") or float(getattr(info, "year_high", 0) or 0),
            "week_52_low": full_info.get("fiftyTwoWeekLow") or float(getattr(info, "year_low", 0) or 0),
            "market_cap": full_info.get("marketCap"),
            "pe_ratio": full_info.get("trailingPE"),
            "beta": beta_val,
            "volume": full_info.get("volume") or full_info.get("regularMarketVolume"),
            "sector": sector_val,
            "industry": full_info.get("industry"),

            # Moving averages (used by All Positions vs-200D column + equity detail)
            "ma_10": ma_10,
            "ma_50": round(float(ma_50), 4) if ma_50 else None,
            "ma_200": round(float(ma_200), 4) if ma_200 else None,

            # Extended fundamentals (used by equity detail page)
            "forward_pe": full_info.get("forwardPE"),
            "peg_ratio": full_info.get("trailingPegRatio") or full_info.get("pegRatio"),
            "eps": full_info.get("trailingEps"),
            "forward_eps": full_info.get("forwardEps"),
            "dividend_yield": full_info.get("dividendYield"),
            "profit_margin": full_info.get("profitMargins"),
            "roe": full_info.get("returnOnEquity"),
            "debt_equity": full_info.get("debtToEquity"),
            "revenue_growth": full_info.get("revenueGrowth"),
            "earnings_growth": full_info.get("earningsGrowth"),
            "target_mean": full_info.get("targetMeanPrice"),
            "recommendation_key": full_info.get("recommendationKey"),
            "avg_volume": full_info.get("averageVolume"),
            "long_business_summary": full_info.get("longBusinessSummary"),
        }
        _cache_set(key, result)
        return result
    except Exception as e:
        return {
            "ticker": ticker.upper(),
            "name": ticker.upper(),
            "price": 0.0,
            "prev_close": 0.0,
            "change": 0.0,
            "change_pct": 0.0,
            "week_52_high": None,
            "week_52_low": None,
            "market_cap": None,
            "pe_ratio": None,
            "beta": None,
            "volume": None,
            "sector": None,
            "industry": None,
            "ma_10": None,
            "ma_50": None,
            "ma_200": None,
            "forward_pe": None,
            "peg_ratio": None,
            "eps": None,
            "forward_eps": None,
            "dividend_yield": None,
            "profit_margin": None,
            "roe": None,
            "debt_equity": None,
            "revenue_growth": None,
            "earnings_growth": None,
            "target_mean": None,
            "recommendation_key": None,
            "avg_volume": None,
            "long_business_summary": None,
            "error": str(e),
        }


def get_historical_price(ticker: str, date_str: str) -> Optional[float]:
    """Get closing price of a ticker on or near a given date."""
    key = f"hist:{ticker}:{date_str}"
    cached = _cache_get(key)
    if cached is not None:
        return cached

    try:
        target = datetime.strptime(date_str, "%Y-%m-%d")
        start = target - timedelta(days=7)
        end = target + timedelta(days=7)
        t = yf.Ticker(ticker)
        hist = t.history(start=start.strftime("%Y-%m-%d"), end=end.strftime("%Y-%m-%d"))
        if hist.empty:
            return None
        # Get the closest date to or after the target
        hist.index = pd.to_datetime(hist.index).tz_localize(None)
        after = hist[hist.index >= target]
        if after.empty:
            after = hist
        price = float(after["Close"].iloc[0])
        _cache_set(key, price)
        return price
    except Exception:
        return None


def get_price_history(ticker: str, period: str = "1y", interval: str = "1d") -> list[dict]:
    """Get OHLCV history for charting. Supports intraday intervals for short
    periods (1d → 5m bars, 5d → 30m bars). yfinance has no native '3y' period
    so we fall back to a date-range request for it."""
    key = f"history:{ticker}:{period}:{interval}"
    cached = _cache_get(key)
    if cached is not None:
        return cached

    try:
        t = yf.Ticker(ticker)
        if period == "3y":
            end = datetime.now()
            start = end - timedelta(days=365 * 3)
            hist = t.history(start=start.strftime("%Y-%m-%d"),
                             end=end.strftime("%Y-%m-%d"),
                             interval=interval)
        else:
            hist = t.history(period=period, interval=interval)
        result = []
        # For intraday data we want the timestamp (not just the date) so the
        # chart x-axis isn't a single value for "1D".
        use_datetime = interval not in ("1d", "1wk", "1mo")
        for dt, row in hist.iterrows():
            result.append({
                "date": dt.strftime("%Y-%m-%d %H:%M") if use_datetime else dt.strftime("%Y-%m-%d"),
                "open": round(float(row["Open"]), 4),
                "high": round(float(row["High"]), 4),
                "low": round(float(row["Low"]), 4),
                "close": round(float(row["Close"]), 4),
                "volume": int(row["Volume"]) if row["Volume"] == row["Volume"] else 0,
            })
        _cache_set(key, result)
        return result
    except Exception:
        return []


def get_news(ticker: str, limit: int = 8) -> list[dict]:
    """Fetch recent yfinance news for a ticker. yfinance returns a list of
    items whose shape has changed across versions; we normalise here so the
    frontend gets a consistent dict."""
    key = f"news:{ticker}:{limit}"
    cached = _cache_get(key)
    if cached is not None:
        return cached

    items: list[dict] = []
    try:
        t = yf.Ticker(ticker)
        raw = t.news or []
    except Exception:
        raw = []

    for n in raw[:limit]:
        # New yfinance shape: { "id": ..., "content": { "title", "summary", "pubDate", ... } }
        # Old shape: flat dict with title, link, publisher, providerPublishTime
        c = n.get("content") if isinstance(n.get("content"), dict) else None
        title = (c or n).get("title")
        if not title:
            continue
        provider = (c or {}).get("provider") or {}
        publisher = provider.get("displayName") or n.get("publisher") or ""
        canonical = (c or {}).get("canonicalUrl") or {}
        click_through = (c or {}).get("clickThroughUrl") or {}
        link = canonical.get("url") or click_through.get("url") or n.get("link") or ""
        published = (c or {}).get("pubDate")
        if not published and n.get("providerPublishTime"):
            try:
                published = datetime.utcfromtimestamp(int(n["providerPublishTime"])).isoformat() + "Z"
            except Exception:
                published = None
        thumb = None
        thumb_obj = (c or {}).get("thumbnail") or n.get("thumbnail")
        if isinstance(thumb_obj, dict):
            res = thumb_obj.get("resolutions") or []
            if res:
                # Pick the smallest one (usually the last entry); fall back to first
                thumb = res[-1].get("url") or res[0].get("url")
            else:
                thumb = thumb_obj.get("url")
        items.append({
            "title": title,
            "publisher": publisher,
            "link": link,
            "published": published,
            "summary": (c or {}).get("summary"),
            "thumbnail": thumb,
            "ticker": ticker.upper(),
        })

    _cache_set(key, items)
    return items


def get_voo_price_on_date(date_str: str) -> Optional[float]:
    """Get VOO price on the purchase date for S&P benchmark comparison."""
    return get_historical_price("VOO", date_str)


def get_bulk_quotes(tickers: list[str]) -> dict[str, dict]:
    """Fetch multiple tickers efficiently."""
    missing = [t for t in tickers if _cache_get(f"quote:{t}") is None]

    if missing:
        try:
            joined = " ".join(missing)
            data = yf.download(joined, period="2d", progress=False, auto_adjust=True)
        except Exception:
            pass

    return {t: get_quote(t) for t in tickers}


def get_prev_close_batch(tickers: list[str]) -> dict[str, float]:
    """
    Return previous-day closing prices for all tickers in a SINGLE batch download.
    Much faster than N individual get_quote() calls — used by the retirement planner
    where live intraday prices add no value to long-horizon projections.
    Results are cached per ticker so subsequent calls within the TTL window are free.
    """
    cache_key_prefix = "prev_close:"
    result: dict[str, float] = {}
    missing: list[str] = []

    for t in tickers:
        cached = _cache_get(f"{cache_key_prefix}{t}")
        if cached is not None:
            result[t] = cached
        else:
            missing.append(t)

    if missing:
        try:
            joined = " ".join(missing)
            # Download 5 days so we always have at least one trading day regardless
            # of weekends / holidays.
            raw = yf.download(joined, period="5d", progress=False, auto_adjust=True)

            close = raw["Close"] if "Close" in raw else raw

            # yf.download returns a DataFrame with MultiIndex columns when there are
            # multiple tickers, and a plain Series/DataFrame for a single ticker.
            if len(missing) == 1:
                ticker = missing[0]
                if not close.empty:
                    prev = float(close.iloc[-1])
                else:
                    prev = 0.0
                _cache_set(f"{cache_key_prefix}{ticker}", prev)
                result[ticker] = prev
            else:
                for ticker in missing:
                    try:
                        col = ticker.upper()
                        series = close[col] if col in close.columns else close.get(ticker, None)
                        if series is not None and not series.dropna().empty:
                            prev = float(series.dropna().iloc[-1])
                        else:
                            prev = 0.0
                    except Exception:
                        prev = 0.0
                    _cache_set(f"{cache_key_prefix}{ticker}", prev)
                    result[ticker] = prev
        except Exception:
            # Fallback: zero for any ticker we couldn't fetch
            for ticker in missing:
                result[ticker] = 0.0

    return result
