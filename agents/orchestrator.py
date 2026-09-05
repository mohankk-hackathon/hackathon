"""Orchestrator - routes a tab name to the correct agent."""
from __future__ import annotations

from typing import Any

from .dashboard import DashboardAgent
from .transactions import TransactionAgent
from .analytics import AnalyticsAgent
from .settings_agent import SettingsAgent


class Orchestrator:
    """Simple registry-based orchestrator (no cross-agent handoffs)."""

    def __init__(self) -> None:
        self._registry = {
            "dashboard": DashboardAgent(),
            "transactions": TransactionAgent(),
            "analytics": AnalyticsAgent(),
            "settings": SettingsAgent(),
        }

    @property
    def tabs(self) -> list[str]:
        return list(self._registry.keys())

    def run(self, tab: str, transactions: list[dict]) -> dict[str, Any]:
        agent = self._registry.get(tab)
        if agent is None:
            raise ValueError(f"Unknown tab '{tab}'. Valid tabs: {self.tabs}")
        return agent.run(transactions)
