"""LangGraph orchestration for the CoachMoney multi-agent system.

Two graph paths compiled into one app:

  1. Single-tab path      (Transactions / Analytics / Settings clicks)
     START -> router -> {tab node} -> END

  2. Supervisor fan-out   (Dashboard click)
     START -> router -> supervisor -> [worker_transactions,
                                       worker_analytics,
                                       worker_settings]   (parallel)
                                    -> synthesizer -> END

Each worker writes into `sub_results` (a list with an append reducer, so
LangGraph merges the three parallel writes automatically). The synthesizer
then reads all three specialist outputs and asks GPT-4o-mini to fold them
into one unified "command centre" summary card for the Dashboard.
"""
from __future__ import annotations

import os
import json
from operator import add
from typing import Any, Annotated, TypedDict, Literal

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
    # Filled in parallel by supervisor workers. `operator.add` on lists
    # is concatenation, which is exactly the reducer we want.
    sub_results: Annotated[list[dict[str, Any]], add]


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


# ------------------------- Agent registry -------------------------

_AGENTS = {
    "dashboard":    DashboardAgent(),
    "transactions": TransactionAgent(),
    "analytics":    AnalyticsAgent(),
    "settings":     SettingsAgent(),
}


# ------------------------- Node factories -------------------------

def _single_node(tab: str):
    """Node used when the user clicks a specialist tab directly."""
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


def _worker_node(tab: str):
    """Parallel worker: appends to `sub_results` for the synthesizer."""
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
            "sub_results": [{
                "agent": agent.name,
                "stats": stats,
                "result": json.loads(response.content),
            }],
        }

    return node_fn


def _supervisor(state: AgentState) -> AgentState:
    """No-op fan-out point. Its outgoing edges run in parallel."""
    return {"sub_results": []}  # ensure the field exists


# ------------------------- Synthesizer -------------------------

_SYNTHESIZER_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "headline": {"type": "string"},
        "health_score": {"type": "integer"},
        "summary": {"type": "string"},
        "top_actions": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "emoji": {"type": "string"},
                    "title": {"type": "string"},
                    "detail": {"type": "string"},
                    "source_agent": {
                        "type": "string",
                        "enum": ["transactions", "analytics", "settings"],
                    },
                },
                "required": ["emoji", "title", "detail", "source_agent"],
            },
        },
        "sub_agent_calls": {
            "type": "array",
            "items": {"type": "string", "enum": ["transactions", "analytics", "settings"]},
        },
    },
    "required": ["headline", "health_score", "summary", "top_actions", "sub_agent_calls"],
}

_SYNTHESIZER_PROMPT = (
    "You are the Dashboard SUPERVISOR agent. Three specialist agents just ran in parallel "
    "and produced structured findings. Your job is to fold their outputs into ONE unified "
    "command-centre card for the user.\n"
    "Rules:\n"
    "- headline: a single motivating sentence.\n"
    "- health_score: integer 0-100 (higher is healthier), based on the specialists' data.\n"
    "- summary: one short paragraph.\n"
    "- top_actions: 3-5 concrete action items, each traced back to which specialist raised it "
    "(transactions | analytics | settings) via source_agent.\n"
    "- sub_agent_calls: list every specialist you drew from (the parallel branch names).\n"
    "- Use ONLY the numbers present in the specialist outputs. Never invent figures."
)


def _synthesize(state: AgentState) -> AgentState:
    subs = state.get("sub_results", [])
    payload = {r["agent"]: r["result"] for r in subs}

    llm = _llm("supervisor_output", _SYNTHESIZER_SCHEMA, 0.4)
    response = llm.invoke([
        SystemMessage(content=_SYNTHESIZER_PROMPT),
        HumanMessage(content=(
            "Specialist agent outputs (parallel fan-out):\n\n"
            + json.dumps(payload, indent=2, default=str)
        )),
    ])
    return {
        "result": json.loads(response.content),
        "agent": "supervisor",
        "model": "gpt-4o-mini",
    }


# ------------------------- Router -------------------------

def _route(state: AgentState) -> str:
    tab = state.get("tab")
    if tab == "dashboard":
        return "supervisor"
    if tab in ("transactions", "analytics", "settings"):
        return tab
    raise ValueError(f"Unknown tab '{tab}'.")


# ------------------------- Graph builder -------------------------

def build_graph():
    graph = StateGraph(AgentState)

    # Single-tab specialist nodes
    graph.add_node("transactions", _single_node("transactions"))
    graph.add_node("analytics",    _single_node("analytics"))
    graph.add_node("settings",     _single_node("settings"))

    # Supervisor fan-out subgraph
    graph.add_node("supervisor",         _supervisor)
    graph.add_node("worker_transactions", _worker_node("transactions"))
    graph.add_node("worker_analytics",    _worker_node("analytics"))
    graph.add_node("worker_settings",     _worker_node("settings"))
    graph.add_node("synthesizer",         _synthesize)

    # START -> router -> {supervisor | specialist}
    graph.add_conditional_edges(
        START,
        _route,
        {
            "supervisor":   "supervisor",
            "transactions": "transactions",
            "analytics":    "analytics",
            "settings":     "settings",
        },
    )

    # Supervisor fans out to 3 workers in parallel
    graph.add_edge("supervisor", "worker_transactions")
    graph.add_edge("supervisor", "worker_analytics")
    graph.add_edge("supervisor", "worker_settings")

    # Workers converge on the synthesizer (LangGraph waits for all three)
    graph.add_edge("worker_transactions", "synthesizer")
    graph.add_edge("worker_analytics",    "synthesizer")
    graph.add_edge("worker_settings",     "synthesizer")

    # Terminal edges
    graph.add_edge("synthesizer", END)
    graph.add_edge("transactions", END)
    graph.add_edge("analytics",    END)
    graph.add_edge("settings",     END)

    return graph.compile()


app_graph = build_graph()


# ------------------------- Public entry -------------------------

def run_tab(tab: str, transactions: list[dict]) -> dict:
    """Invoke the graph for a single tab click and return the final state."""
    final = app_graph.invoke({"tab": tab, "transactions": transactions, "sub_results": []})
    payload = {
        "agent": final.get("agent"),
        "model": final.get("model"),
        "stats": final.get("stats"),
        "result": final.get("result"),
    }
    # Include the parallel specialist outputs when running the supervisor path
    if tab == "dashboard":
        payload["sub_results"] = final.get("sub_results", [])
    return payload


def tabs() -> list[str]:
    return ["dashboard", "transactions", "analytics", "settings"]


def render_diagram() -> str:
    try:
        return app_graph.get_graph().draw_ascii()
    except Exception:
        return (
            "START ─(router)─▶ supervisor ─fan-out─▶ worker_transactions ┐\n"
            "                                    ├─▶ worker_analytics    ├─▶ synthesizer ─▶ END\n"
            "                                    └─▶ worker_settings     ┘\n"
            "              └▶ transactions ─▶ END\n"
            "              └▶ analytics    ─▶ END\n"
            "              └▶ settings     ─▶ END"
        )
