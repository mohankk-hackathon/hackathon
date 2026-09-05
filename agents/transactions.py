"""TransactionAgent - anomaly + mis-categorization detector for the Transactions tab."""
from __future__ import annotations

import statistics
from collections import defaultdict
from typing import Any

from .base import BaseAgent


class TransactionAgent(BaseAgent):
    name = "transactions"
    temperature = 0.2  # more deterministic for auditing

    @property
    def system_prompt(self) -> str:
        return (
            "You are the Transactions agent. Audit the ledger for issues.\n"
            "Return two lists:\n"
            "  - anomalies: transactions that look unusual (much larger than category average, "
            "    possible duplicates flagged in the pre-computed data, or suspicious descriptions).\n"
            "  - suggested_recategorizations: rows whose current category likely does not match the merchant.\n"
            "Rules:\n"
            "- Use tx_id values exactly as given in the input.\n"
            "- severity is one of: low, medium, high.\n"
            "- Only include items you are confident about. An empty list is fine.\n"
        )

    @property
    def output_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "anomalies": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "tx_id": {"type": "string"},
                            "reason": {"type": "string"},
                            "severity": {"type": "string", "enum": ["low", "medium", "high"]},
                        },
                        "required": ["tx_id", "reason", "severity"],
                    },
                },
                "suggested_recategorizations": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "tx_id": {"type": "string"},
                            "from_category": {"type": "string"},
                            "to_category": {"type": "string"},
                            "reason": {"type": "string"},
                        },
                        "required": ["tx_id", "from_category", "to_category", "reason"],
                    },
                },
            },
            "required": ["anomalies", "suggested_recategorizations"],
        }

    def build_stats(self, transactions: list[dict]) -> dict[str, Any]:
        # Compute per-category mean and stdev for expense outlier hints
        cat_amounts: dict[str, list[float]] = defaultdict(list)
        for t in transactions:
            if t.get("type") == "expense":
                cat_amounts[t.get("category", "Other")].append(float(t["amount"]))

        cat_stats = {}
        for cat, amounts in cat_amounts.items():
            cat_stats[cat] = {
                "count": len(amounts),
                "mean": round(statistics.fmean(amounts), 2),
                "stdev": round(statistics.pstdev(amounts), 2) if len(amounts) > 1 else 0.0,
                "max": max(amounts),
            }

        # Duplicate hints: same date + same amount + same type
        dup_keys: dict[tuple, list[str]] = defaultdict(list)
        for t in transactions:
            key = (str(t.get("date", ""))[:10], round(float(t["amount"]), 2), t.get("type"))
            dup_keys[key].append(t.get("id", ""))
        duplicate_groups = [ids for ids in dup_keys.values() if len(ids) > 1]

        # Ship trimmed ledger to the model (avoid huge payloads)
        ledger = [
            {
                "tx_id": t.get("id", ""),
                "date": str(t.get("date", ""))[:10],
                "note": t.get("note", ""),
                "category": t.get("category", "Other"),
                "amount": float(t["amount"]),
                "type": t.get("type", "expense"),
            }
            for t in transactions
        ]

        return {
            "category_baseline": cat_stats,
            "duplicate_id_groups": duplicate_groups,
            "ledger": ledger,
        }
