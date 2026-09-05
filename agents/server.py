"""FastAPI wrapper exposing each agent as an HTTP endpoint.

Run locally:
    cd /app/agents
    uvicorn agents.server:app --host 0.0.0.0 --port 8001 --reload

Endpoints:
    GET  /health
    GET  /tabs
    POST /agent/{tab}   body: { "transactions": [...] }
"""
from __future__ import annotations

import sys
import os
# Make sibling imports work when uvicorn is launched from /app
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from agents.orchestrator import Orchestrator

app = FastAPI(title="Finance Tracker - Multi-Agent API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_orch = Orchestrator()


class AgentRequest(BaseModel):
    transactions: list[dict[str, Any]] = Field(default_factory=list)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "tabs": _orch.tabs}


@app.get("/tabs")
def tabs() -> dict:
    return {"tabs": _orch.tabs}


@app.post("/agent/{tab}")
def run_agent(tab: str, payload: AgentRequest) -> dict:
    try:
        return _orch.run(tab, payload.transactions)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc))
