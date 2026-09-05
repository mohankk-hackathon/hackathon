"""Shared foundation: LLM client + abstract agent."""
from __future__ import annotations

import os
import json
from abc import ABC, abstractmethod
from collections import defaultdict
from datetime import datetime
from typing import Any

from openai import OpenAI
from dotenv import load_dotenv

# Load /app/.env so the Emergent key is picked up when running as CLI
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))


class LLMClient:
    """Lazy-init singleton wrapper around the OpenAI SDK."""

    _instance: OpenAI | None = None

    @classmethod
    def get(cls) -> OpenAI:
        if cls._instance is None:
            api_key = os.environ.get("EMERGENT_LLM_KEY")
            base_url = os.environ.get("EMERGENT_BASE_URL")
            if not api_key or not base_url:
                raise RuntimeError(
                    "EMERGENT_LLM_KEY and EMERGENT_BASE_URL must be set. "
                    "They live in /app/.env in this project."
                )
            cls._instance = OpenAI(api_key=api_key, base_url=base_url)
        return cls._instance


# ------------------------- Shared helpers -------------------------

def parse_date(value: str) -> datetime:
    """Robust ISO date parser."""
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return datetime.strptime(value[:10], "%Y-%m-%d")


def sum_by_type(transactions: list[dict], type_: str) -> float:
    return round(sum(float(t["amount"]) for t in transactions if t.get("type") == type_), 2)


def sum_by_category(transactions: list[dict]) -> dict[str, float]:
    totals: dict[str, float] = defaultdict(float)
    for t in transactions:
        if t.get("type") == "expense":
            totals[t.get("category", "Other")] += float(t["amount"])
    return {k: round(v, 2) for k, v in totals.items()}


# ------------------------- BaseAgent -------------------------

class BaseAgent(ABC):
    """Every tab agent inherits from this.

    Sub-classes implement:
      - name              (unique tab key)
      - model             (default: gpt-4o-mini)
      - system_prompt     (role/instructions for the LLM)
      - build_stats(...)  (pre-computed facts fed to the LLM)
      - output_schema     (JSON schema for Structured Outputs)
    """

    name: str = "base"
    model: str = "gpt-4o-mini"
    temperature: float = 0.4

    @property
    @abstractmethod
    def system_prompt(self) -> str: ...

    @property
    @abstractmethod
    def output_schema(self) -> dict[str, Any]: ...

    @abstractmethod
    def build_stats(self, transactions: list[dict]) -> dict[str, Any]: ...

    # ---- default LLM call, sub-classes rarely override ----

    def run(self, transactions: list[dict]) -> dict[str, Any]:
        stats = self.build_stats(transactions)
        client = LLMClient.get()
        completion = client.chat.completions.create(
            model=self.model,
            temperature=self.temperature,
            messages=[
                {"role": "system", "content": self.system_prompt},
                {"role": "user", "content": (
                    "Pre-computed statistics (trust these numbers, never invent):\n\n"
                    + json.dumps(stats, indent=2, default=str)
                )},
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": f"{self.name}_output",
                    "strict": True,
                    "schema": self.output_schema,
                },
            },
        )
        raw = completion.choices[0].message.content or "{}"
        return {
            "agent": self.name,
            "model": self.model,
            "stats": stats,
            "result": json.loads(raw),
        }
