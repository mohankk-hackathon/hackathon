"""Orchestrator - thin wrapper around the LangGraph app.

Kept for backwards compatibility with the previous simple-pattern API.
"""
from __future__ import annotations

from typing import Any

from .graph import run_tab, tabs


class Orchestrator:
    """LangGraph-backed orchestrator. `run(tab, txs)` invokes the graph."""

    @property
    def tabs(self) -> list[str]:
        return tabs()

    def run(self, tab: str, transactions: list[dict]) -> dict[str, Any]:
        return run_tab(tab, transactions)
