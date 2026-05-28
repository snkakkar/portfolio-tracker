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
            "beta": full_info.get("beta"),
            "volume": full_info.get("volume") or full_info.get("regularMarketVolume"),
            "sector": full_info.get("sector"),
            "industry": full_info.get("industry"),
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


def get_price_history(ticker: str, period: str = "1y") -> list[dict]:
    """Get OHLCV history for charting."""
    key = f"history:{ticker}:{period}"
    cached = _cache_get(key)
    if cached is not None:
        return cached

    try:
        t = yf.Ticker(ticker)
        hist = t.history(period=period)
        result = []
        for dt, row in hist.iterrows():
            result.append({
                "date": dt.strftime("%Y-%m-%d"),
                "open": round(float(row["Open"]), 4),
                "high": round(float(row["High"]), 4),
                "low": round(float(row["Low"]), 4),
                "close": round(float(row["Close"]), 4),
                "volume": int(row["Volume"]),
            })
        _cache_set(key, result)
        return result
    except Exception:
        return []


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
