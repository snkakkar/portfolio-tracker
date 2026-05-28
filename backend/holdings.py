import json
import uuid
from pathlib import Path
from typing import Optional

HOLDINGS_FILE = Path(__file__).parent / "holdings.json"

PORTFOLIO_KEYS = ["stocks", "etfs", "retirement_stocks", "retirement_etfs", "watchlist"]


def load_holdings() -> dict:
    with open(HOLDINGS_FILE, "r") as f:
        return json.load(f)


def save_holdings(data: dict) -> None:
    with open(HOLDINGS_FILE, "w") as f:
        json.dump(data, f, indent=2)


def _ensure_exited(data: dict) -> None:
    """Ensure the exited list exists in the data dict."""
    if "exited" not in data:
        data["exited"] = []


def get_portfolio(portfolio: str) -> list[dict]:
    data = load_holdings()
    if portfolio not in data:
        raise KeyError(f"Portfolio '{portfolio}' not found")
    return data[portfolio]


def add_holding(portfolio: str, ticker: str, shares: float, cost_per_share: float, purchase_date: str) -> dict:
    data = load_holdings()
    holdings = data[portfolio]
    # Check for existing ticker — update if found
    for h in holdings:
        if h["ticker"].upper() == ticker.upper():
            h["shares"] = shares
            h["cost_per_share"] = cost_per_share
            h["purchase_date"] = purchase_date
            save_holdings(data)
            return h
    new_holding = {
        "ticker": ticker.upper(),
        "shares": shares,
        "cost_per_share": cost_per_share,
        "purchase_date": purchase_date,
    }
    holdings.append(new_holding)
    data[portfolio] = holdings
    save_holdings(data)
    return new_holding


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


def exit_holding(
    portfolio: str,
    ticker: str,
    exit_price: float,
    exit_date: str,
) -> dict:
    """
    Move a holding from the active portfolio to the exited list,
    recording the exit price, date, and realized P&L.
    Returns the exited record.
    """
    data = load_holdings()
    _ensure_exited(data)

    # Find and remove from active portfolio
    original = data[portfolio]
    match = next((h for h in original if h["ticker"].upper() == ticker.upper()), None)
    if not match:
        raise KeyError(f"Ticker '{ticker}' not found in '{portfolio}'")

    data[portfolio] = [h for h in original if h["ticker"].upper() != ticker.upper()]

    # Compute realized P&L
    shares         = match["shares"]
    cost_per_share = match["cost_per_share"]
    purchase_date  = match["purchase_date"]
    total_cost     = round(shares * cost_per_share, 2)
    exit_value     = round(shares * exit_price, 2)
    realized_gain  = round(exit_value - total_cost, 2)
    gain_pct       = round((realized_gain / total_cost * 100) if total_cost else 0.0, 4)

    # Hold duration
    from datetime import date
    try:
        buy_dt  = date.fromisoformat(purchase_date)
        exit_dt = date.fromisoformat(exit_date)
        hold_days = (exit_dt - buy_dt).days
    except ValueError:
        hold_days = None

    record = {
        "id":              str(uuid.uuid4()),
        "portfolio":       portfolio,
        "ticker":          ticker.upper(),
        "shares":          shares,
        "cost_per_share":  cost_per_share,
        "purchase_date":   purchase_date,
        "exit_price":      exit_price,
        "exit_date":       exit_date,
        "total_cost":      total_cost,
        "exit_value":      exit_value,
        "realized_gain":   realized_gain,
        "realized_gain_pct": gain_pct,
        "hold_days":       hold_days,
    }
    data["exited"].append(record)
    save_holdings(data)
    return record


def get_exited(portfolio: Optional[str] = None) -> list[dict]:
    """Return exited positions, optionally filtered by portfolio."""
    data = load_holdings()
    _ensure_exited(data)
    records = data["exited"]
    if portfolio:
        records = [r for r in records if r["portfolio"] == portfolio]
    # Return newest first
    return sorted(records, key=lambda r: r["exit_date"], reverse=True)


def delete_exited(record_id: str) -> None:
    """Permanently delete an exited position record."""
    data = load_holdings()
    _ensure_exited(data)
    original = data["exited"]
    filtered = [r for r in original if r["id"] != record_id]
    if len(filtered) == len(original):
        raise KeyError(f"Exited record '{record_id}' not found")
    data["exited"] = filtered
    save_holdings(data)
