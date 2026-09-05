"""DashboardAgent - quick financial health snapshot for the Dashboard tab."""
from __future__ import annotations

from typing import Any

from .base import BaseAgent, sum_by_type, sum_by_category


class DashboardAgent(BaseAgent):
    name = "dashboard"
    temperature = 0.5

    @property
    def system_prompt(self) -> str:
        return (
            "You are the Dashboard agent for a personal finance app. "
            "Given pre-computed stats, produce a one-line headline, a health score "
            "between 0 and 100 (higher is healthier), and exactly 3 concise highlights.\n"
            "Rules:\n"
            "- Use concrete numbers from the stats; never invent figures.\n"
            "- Health score reflects savings rate: >50% saved => 85+, break-even => 50, spending > income => below 40.\n"
            "- Highlights are one short sentence each with a single emoji.\n"
            "- Tone: warm, motivating, honest."
        )

    @property
    def output_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "headline": {"type": "string"},
                "health_score": {"type": "integer"},
                "highlights": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "emoji": {"type": "string"},
                            "text": {"type": "string"},
                        },
                        "required": ["emoji", "text"],
                    },
                },
            },
            "required": ["headline", "health_score", "highlights"],
        }

    def build_stats(self, transactions: list[dict]) -> dict[str, Any]:
        income = sum_by_type(transactions, "income")
        expense = sum_by_type(transactions, "expense")
        net = round(income - expense, 2)
        savings_rate = round((net / income) * 100, 1) if income else 0.0
        return {
            "transaction_count": len(transactions),
            "income": income,
            "expense": expense,
            "net": net,
            "savings_rate_pct": savings_rate,
            "expense_by_category": sum_by_category(transactions),
        }
