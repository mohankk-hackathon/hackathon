"""CoachMoney multi-agent package.

Each tab in the Next.js UI is served by a specialised agent:
  - Dashboard    -> DashboardAgent
  - Transactions -> TransactionAgent
  - Analytics    -> AnalyticsAgent
  - Settings     -> SettingsAgent

Every agent uses GPT-4o-mini via the Emergent Universal LLM Key
and returns strict JSON via OpenAI Structured Outputs.
"""
from .orchestrator import Orchestrator
from .base import BaseAgent, LLMClient

__all__ = ["Orchestrator", "BaseAgent", "LLMClient"]
