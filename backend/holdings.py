import json
import re
import uuid
from datetime import date
from pathlib import Path
from typing import Optional

HOLDINGS_FILE = Path(__file__).parent / "holdings.json"

# ── Built-in portfolios (always present, cannot be deleted) ──────────────────
_BUILTIN_PORTFOLIOS: dict[str, dict] = {
    "stocks":            {"key": "stocks",            "label": "Brokerage Stocks",  "color": "blue",   "builtin": True},
    "etfs":              {"key": "etfs",              "label": "Brokerage ETFs",    "color": "violet", "builtin": True},
    "retirement_stocks": {"key": "retirement_stocks", "label": "Retirement Stocks", "color": "emerald","builtin": True},
    "retirement_etfs":   {"key": "retirement_etfs",   "label": "Retirement ETFs",   "color": "teal",   "builtin": True},
}

# Legacy flat list of recognised keys (kept for backwards compat)
PORTFOLIO_KEYS = list(_BUILTIN_PORTFOLIOS.keys()) + ["watchlist"]


# ── Persistence helpers ───────────────────────────────────────────────────────

def load_holdings() -> dict:
    with open(HOLDINGS_FILE, "r") as f:
        return json.load(f)


def save_holdings(data: dict) -> None:
    with open(HOLDINGS_FILE, "w") as f:
        json.dump(data, f, indent=2)


def _ensure_exited(data: dict) -> None:
    if "exited" not in data:
        data["exited"] = []


def _ensure_portfolios(data: dict) -> None:
    """Guarantee _portfolios metadata block and built-in holding lists exist."""
    if "_portfolios" not in data:
        data["_portfolios"] = {}
    for key, meta in _BUILTIN_PORTFOLIOS.items():
        if key not in data:
            data[key] = []
        if key not in data["_portfolios"]:
            data["_portfolios"][key] = dict(meta)
    if "watchlist" not in data:
        data["watchlist"] = []


# ── Portfolio metadata CRUD ───────────────────────────────────────────────────

def get_all_portfolio_meta() -> list[dict]:
    """Return metadata for every portfolio (built-in + custom), ordered built-ins first."""
    data = load_holdings()
    _ensure_portfolios(data)
    save_holdings(data)  # persist any newly initialised meta

    meta_map: dict[str, dict] = data["_portfolios"]
    # Built-ins first (in declaration order), then custom alphabetically
    result = [meta_map[k] for k in _BUILTIN_PORTFOLIOS if k in meta_map]
    custom = sorted(
        [m for m in meta_map.values() if not m.get("builtin")],
        key=lambda m: m["label"].lower(),
    )
    return result + custom


def create_portfolio(label: str, color: str = "blue") -> dict:
    """Create a new custom portfolio. Raises ValueError on duplicate / bad name."""
    key = re.sub(r"[^a-z0-9]+", "_", label.strip().lower()).strip("_")
    if not key:
        raise ValueError("Invalid portfolio name")

    data = load_holdings()
    _ensure_portfolios(data)

    if key in data["_portfolios"]:
        raise ValueError(f"A portfolio with the key '{key}' already exists")

    meta = {"key": key, "label": label.strip(), "color": color, "builtin": False}
    data["_portfolios"][key] = meta
    data[key] = []
    save_holdings(data)
    return meta


def update_portfolio(key: str, new_label: Optional[str] = None, new_color: Optional[str] = None) -> dict:
    """Rename or recolour a portfolio (works on built-ins too)."""
    data = load_holdings()
    _ensure_portfolios(data)

    if key not in data["_portfolios"]:
        raise KeyError(f"Portfolio '{key}' not found")

    if new_label is not None:
        data["_portfolios"][key]["label"] = new_label.strip()
    if new_color is not None:
        data["_portfolios"][key]["color"] = new_color

    save_holdings(data)
    return data["_portfolios"][key]


def delete_portfolio(key: str) -> None:
    """Delete a custom portfolio. Raises if built-in or still holds positions."""
    data = load_holdings()
    _ensure_portfolios(data)

    if key not in data["_portfolios"]:
        raise KeyError(f"Portfolio '{key}' not found")
    if data["_portfolios"][key].get("builtin"):
        raise ValueError("Built-in portfolios cannot be deleted")
    if data.get(key):
        raise ValueError(f"Portfolio still has {len(data[key])} holding(s). Remove them first.")

    del data["_portfolios"][key]
    data.pop(key, None)
    save_holdings(data)


# ── Holdings CRUD ─────────────────────────────────────────────────────────────

def get_portfolio(portfolio: str) -> list[dict]:
    data = load_holdings()
    if portfolio not in data:
        raise KeyError(f"Portfolio '{portfolio}' not found")
    return data[portfolio]


def add_holding(portfolio: str, holding: dict) -> dict:
    """
    Add or update a holding in a portfolio.
    `holding` must have: ticker, shares, cost_per_share, purchase_date.
    Optional: brokerage.
    """
    data = load_holdings()
    if portfolio not in data:
        raise KeyError(f"Portfolio '{portfolio}' not found")

    holdings = data[portfolio]
    ticker = holding["ticker"].upper()

    for h in holdings:
        if h["ticker"].upper() == ticker:
            h["shares"]         = holding["shares"]
            h["cost_per_share"] = holding["cost_per_share"]
            h["purchase_date"]  = holding["purchase_date"]
            if "brokerage" in holding:
                h["brokerage"] = holding["brokerage"]
            save_holdings(data)
            return h

    new_h = {
        "ticker":         ticker,
        "shares":         holding["shares"],
        "cost_per_share": holding["cost_per_share"],
        "purchase_date":  holding["purchase_date"],
    }
    if "brokerage" in holding:
        new_h["brokerage"] = holding["brokerage"]

    holdings.append(new_h)
    data[portfolio] = holdings
    save_holdings(data)
    return new_h


def update_holding(portfolio: str, ticker: str, updates: dict) -> dict:
    data = load_holdings()
    holdings = data[portfolio]
    for h in holdings:
        if h["ticker"].upper() == ticker.upper():
            if "shares" in updates:
                h["shares"] = updates["shares"]
            if "purchase_date" in updates:
                h["purchase_date"] = updates["purchase_date"]
            if "cost_per_share" in updates:
                h["cost_per_share"] = updates["cost_per_share"]
            save_holdings(data)
            return h
    raise KeyError(f"Ticker '{ticker}' not found in '{portfolio}'")


def delete_holding(portfolio: str, ticker: str) -> None:
    data = load_holdings()
    original = data[portfolio]
    filtered = [h for h in original if h["ticker"].upper() != ticker.upper()]
    if len(filtered) == len(original):
        raise KeyError(f"Ticker '{ticker}' not found in '{portfolio}'")
    data[portfolio] = filtered
    save_holdings(data)


# ── Exit positions ────────────────────────────────────────────────────────────

def exit_holding(portfolio: str, ticker: str, exit_price: float, exit_date: str) -> dict:
    data = load_holdings()
    _ensure_exited(data)

    original = data[portfolio]
    match = next((h for h in original if h["ticker"].upper() == ticker.upper()), None)
    if not match:
        raise KeyError(f"Ticker '{ticker}' not found in '{portfolio}'")

    data[portfolio] = [h for h in original if h["ticker"].upper() != ticker.upper()]

    shares         = match["shares"]
    cost_per_share = match["cost_per_share"]
    purchase_date  = match["purchase_date"]
    total_cost     = round(shares * cost_per_share, 2)
    exit_value     = round(shares * exit_price, 2)
    realized_gain  = round(exit_value - total_cost, 2)
    gain_pct       = round((realized_gain / total_cost * 100) if total_cost else 0.0, 4)

    try:
        hold_days = (date.fromisoformat(exit_date) - date.fromisoformat(purchase_date)).days
    except ValueError:
        hold_days = None

    record = {
        "id":               str(uuid.uuid4()),
        "portfolio":        portfolio,
        "ticker":           ticker.upper(),
        "shares":           shares,
        "cost_per_share":   cost_per_share,
        "purchase_date":    purchase_date,
        "exit_price":       exit_price,
        "exit_date":        exit_date,
        "total_cost":       total_cost,
        "exit_value":       exit_value,
        "realized_gain":    realized_gain,
        "realized_gain_pct": gain_pct,
        "hold_days":        hold_days,
    }
    data["exited"].append(record)
    save_holdings(data)
    return record


def get_exited(portfolio: Optional[str] = None) -> list[dict]:
    data = load_holdings()
    _ensure_exited(data)
    records = data["exited"]
    if portfolio:
        records = [r for r in records if r["portfolio"] == portfolio]
    return sorted(records, key=lambda r: r["exit_date"], reverse=True)


def delete_exited(record_id: str) -> None:
    data = load_holdings()
    _ensure_exited(data)
    original = data["exited"]
    filtered = [r for r in original if r["id"] != record_id]
    if len(filtered) == len(original):
        raise KeyError(f"Exited record '{record_id}' not found")
    data["exited"] = filtered
    save_holdings(data)
