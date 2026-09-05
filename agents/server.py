"""FastAPI wrapper around the LangGraph app.

Run locally:
    cd /app
    uvicorn agents.server:app --host 0.0.0.0 --port 8001 --reload

Endpoints:
    GET  /health
    GET  /tabs
    GET  /graph                    # ASCII graph diagram
    POST /agent/{tab}   body: { "transactions": [...] }
"""
from __future__ import annotations

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from agents.graph import run_tab, tabs, render_diagram

app = FastAPI(title="Finance Tracker - LangGraph Multi-Agent API", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class AgentRequest(BaseModel):
    transactions: list[dict[str, Any]] = Field(default_factory=list)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "tabs": tabs(), "engine": "langgraph"}


@app.get("/tabs")
def list_tabs() -> dict:
    return {"tabs": tabs()}


@app.get("/graph", response_model=None)
def graph_diagram() -> dict:
    return {"graph": render_diagram()}


@app.post("/agent/{tab}")
def run_agent(tab: str, payload: AgentRequest) -> dict:
    if tab not in tabs():
        raise HTTPException(status_code=404, detail=f"Unknown tab '{tab}'. Valid tabs: {tabs()}")
    try:
        return run_tab(tab, payload.transactions)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc))
