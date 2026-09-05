"""LangGraph orchestration for the Finance Tracker multi-agent system.

Graph layout:

              +--------------+
              |   START      |
              +------+-------+
                     |
              +------v-------+
              |   router     |   picks node from state["tab"]
              +--+--+--+--+--+
                 |  |  |  |
     +-----------+  |  |  +----------+
     |              |  |             |
     v              v  v             v
 +---------+  +-----------+  +---------+  +---------+
 |Dashboard|  |Transaction|  |Analytics|  |Settings |
 +----+----+  +-----+-----+  +----+----+  +----+----+
      |             |             |            |
      +------+------+-------------+------------+
             |
             v
           +----+
           | END|
           +----+

Each node reads the pre-computed stats from the corresponding agent class
(dashboard.py / transactions.py / …) and calls GPT-4o-mini through the
Emergent Universal LLM Key via `langchain_openai.ChatOpenAI`.

Structured Outputs are enforced by binding the JSON schema through
`ChatOpenAI.bind(response_format=...)` – identical to the raw SDK path.
"""
from __future__ import annotations

import os
import json
from typing import Any, TypedDict, Literal

from dotenv import load_dotenv
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, START, END

from .dashboard import DashboardAgent
from .transactions import TransactionAgent
from .analytics import AnalyticsAgent
from .settings_agent import SettingsAgent

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))


# ------------------------- Shared state -------------------------

class AgentState(TypedDict, total=False):
    tab: Literal["dashboard", "transactions", "analytics", "settings"]
    transactions: list[dict]
    stats: dict[str, Any]
    result: dict[str, Any]
    agent: str
    model: str


# ------------------------- LLM factory -------------------------

_LLM_CACHE: dict[str, ChatOpenAI] = {}


def _llm(schema_name: str, schema: dict[str, Any], temperature: float) -> ChatOpenAI:
    """Return a ChatOpenAI bound to a specific JSON schema."""
    cache_key = f"{schema_name}:{temperature}"
    if cache_key not in _LLM_CACHE:
        base = ChatOpenAI(
            model="gpt-4o-mini",
            temperature=temperature,
            api_key=os.environ["EMERGENT_LLM_KEY"],
            base_url=os.environ["EMERGENT_BASE_URL"],
        )
        _LLM_CACHE[cache_key] = base.bind(
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": schema_name,
                    "strict": True,
                    "schema": schema,
                },
            }
        )
    return _LLM_CACHE[cache_key]


# ------------------------- Node factory -------------------------

_AGENTS = {
    "dashboard":    DashboardAgent(),
    "transactions": TransactionAgent(),
    "analytics":    AnalyticsAgent(),
    "settings":     SettingsAgent(),
}


def _make_node(tab: str):
    agent = _AGENTS[tab]

    def node_fn(state: AgentState) -> AgentState:
        stats = agent.build_stats(state["transactions"])
        llm = _llm(f"{agent.name}_output", agent.output_schema, agent.temperature)
        response = llm.invoke([
            SystemMessage(content=agent.system_prompt),
            HumanMessage(content=(
                "Pre-computed statistics (trust these numbers, never invent):\n\n"
                + json.dumps(stats, indent=2, default=str)
            )),
        ])
        return {
            "stats": stats,
            "result": json.loads(response.content),
            "agent": agent.name,
            "model": "gpt-4o-mini",
        }

    return node_fn


# ------------------------- Router -------------------------

def _route(state: AgentState) -> str:
    tab = state.get("tab")
    if tab not in _AGENTS:
        raise ValueError(f"Unknown tab '{tab}'. Must be one of: {list(_AGENTS)}")
    return tab


# ------------------------- Graph builder -------------------------

def build_graph():
    """Compile and return the LangGraph app."""
    graph = StateGraph(AgentState)

    # Register every agent as a node
    for tab in _AGENTS:
        graph.add_node(tab, _make_node(tab))

    # START -> conditional -> {tab node}
    graph.add_conditional_edges(
        START,
        _route,
        {tab: tab for tab in _AGENTS},
    )

    # Every tab node terminates the run
    for tab in _AGENTS:
        graph.add_edge(tab, END)

    return graph.compile()


# Compile once at import time so the demo & server share it
app_graph = build_graph()


# ------------------------- Public entry -------------------------

def run_tab(tab: str, transactions: list[dict]) -> dict:
    """Invoke the graph for a single tab click and return the final state."""
    final = app_graph.invoke({"tab": tab, "transactions": transactions})
    return {
        "agent": final.get("agent"),
        "model": final.get("model"),
        "stats": final.get("stats"),
        "result": final.get("result"),
    }


def tabs() -> list[str]:
    return list(_AGENTS.keys())


def render_diagram() -> str:
    """Return an ASCII rendering of the compiled graph (useful for the CLI)."""
    try:
        return app_graph.get_graph().draw_ascii()
    except Exception:
        # draw_ascii needs `grandalf`; return a hand-drawn fallback
        return (
            "START ──(router)─▶ dashboard\n"
            "                └─▶ transactions\n"
            "                └─▶ analytics\n"
            "                └─▶ settings   ─▶ END"
        )
