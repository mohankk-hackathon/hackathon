"""SettingsAgent - budget & savings recommendations for the Settings tab."""
from __future__ import annotations

from collections import defaultdict
from typing import Any

from .base import BaseAgent, parse_date, sum_by_type


class SettingsAgent(BaseAgent):
    name = "settings"
    temperature = 0.5

    @property
    def system_prompt(self) -> str:
        return (
            "You are the Settings agent. Recommend a realistic monthly budget per category and "
            "a savings goal based on the user's history.\n"
            "Rules:\n"
            "- Base recommended_budgets on the average monthly expense per category, rounded to whole dollars.\n"
            "- savings_goal.target_pct is the recommended share of income to save (typical: 15-25%).\n"
            "- Provide 3 concise, actionable tips that reflect the user's actual data.\n"
            "- Use only pre-computed numbers."
        )

    @property
    def output_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "recommended_budgets": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "category": {"type": "string"},
                            "monthly_budget": {"type": "number"},
                        },
                        "required": ["category", "monthly_budget"],
                    },
                },
                "savings_goal": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "monthly_amount": {"type": "number"},
                        "target_pct": {"type": "number"},
                        "rationale": {"type": "string"},
                    },
                    "required": ["monthly_amount", "target_pct", "rationale"],
                },
                "tips": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["recommended_budgets", "savings_goal", "tips"],
        }

    def build_stats(self, transactions: list[dict]) -> dict[str, Any]:
        month_cat: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
        for t in transactions:
            if t.get("type") != "expense":
                continue
            d = parse_date(str(t["date"]))
            mkey = d.strftime("%Y-%m")
            month_cat[mkey][t.get("category", "Other")] += float(t["amount"])

        months = list(month_cat.keys()) or ["n/a"]
        avg_by_cat: dict[str, float] = defaultdict(float)
        for m, cats in month_cat.items():
            for c, v in cats.items():
                avg_by_cat[c] += v
        avg_by_cat = {c: round(v / max(len(months), 1), 2) for c, v in avg_by_cat.items()}

        income = sum_by_type(transactions, "income")
        expense = sum_by_type(transactions, "expense")
        return {
            "months_observed": len(months),
            "avg_monthly_expense_by_category": avg_by_cat,
            "total_income": income,
            "total_expense": expense,
            "net_savings": round(income - expense, 2),
        }
