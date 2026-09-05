"""AnalyticsAgent - month-over-month trends and next-month forecast."""
from __future__ import annotations

from collections import defaultdict
from typing import Any

from .base import BaseAgent, parse_date, sum_by_type


class AnalyticsAgent(BaseAgent):
    name = "analytics"
    temperature = 0.3

    @property
    def system_prompt(self) -> str:
        return (
            "You are the Analytics agent. Produce data-driven trend analysis:\n"
            "- forecast_next_month_expense: a realistic USD estimate given the recent trajectory.\n"
            "- trends: for each meaningful category, direction (up/down/flat) with pct change vs previous month.\n"
            "- best_day / worst_day: ISO date strings (yyyy-mm-dd) of lowest and highest expense days.\n"
            "- narrative: one paragraph explaining the trajectory in plain English.\n"
            "Rules: use only the pre-computed numbers. Never fabricate."
        )

    @property
    def output_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "forecast_next_month_expense": {"type": "number"},
                "trends": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "category": {"type": "string"},
                            "direction": {"type": "string", "enum": ["up", "down", "flat"]},
                            "change_pct": {"type": "number"},
                        },
                        "required": ["category", "direction", "change_pct"],
                    },
                },
                "best_day": {"type": "string"},
                "worst_day": {"type": "string"},
                "narrative": {"type": "string"},
            },
            "required": ["forecast_next_month_expense", "trends", "best_day", "worst_day", "narrative"],
        }

    def build_stats(self, transactions: list[dict]) -> dict[str, Any]:
        # Group expense per month + per (month, category) + per day
        month_totals: dict[str, float] = defaultdict(float)
        month_cat: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
        day_totals: dict[str, float] = defaultdict(float)

        for t in transactions:
            if t.get("type") != "expense":
                continue
            d = parse_date(str(t["date"]))
            mkey = d.strftime("%Y-%m")
            dkey = d.strftime("%Y-%m-%d")
            month_totals[mkey] += float(t["amount"])
            month_cat[mkey][t.get("category", "Other")] += float(t["amount"])
            day_totals[dkey] += float(t["amount"])

        month_totals = {k: round(v, 2) for k, v in sorted(month_totals.items())}
        for m in month_cat:
            month_cat[m] = {k: round(v, 2) for k, v in month_cat[m].items()}

        return {
            "monthly_expense_totals": month_totals,
            "monthly_category_expense": month_cat,
            "daily_expense_totals": dict(sorted(day_totals.items())),
            "overall_income": sum_by_type(transactions, "income"),
            "overall_expense": sum_by_type(transactions, "expense"),
        }
