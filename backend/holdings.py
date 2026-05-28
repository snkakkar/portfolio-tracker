import json
import os
from pathlib import Path
from typing import Any

HOLDINGS_FILE = Path(__file__).parent / "holdings.json"

PORTFOLIO_KEYS = ["stocks", "etfs", "retirement_stocks", "retirement_etfs", "watchlist"]


def load_holdings() -> dict[str, list[dict]]:
    with open(HOLDINGS_FILE, "r") as f:
        return json.load(f)


def save_holdings(data: dict[str, list[dict]]) -> None:
    with open(HOLDINGS_FILE, "w") as f:
        json.dump(data, f, indent=2)


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
