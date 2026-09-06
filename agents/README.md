# CoachMoney — LangGraph Multi-Agent System

Four specialised GPT-4o-mini agents wired as nodes in a LangGraph `StateGraph`,
one per tab of the Next.js UI:

| Tab | Node | Job |
| --- | --- | --- |
| Dashboard | `DashboardAgent` | Health snapshot + 3 highlights |
| Transactions | `TransactionAgent` | Detect anomalies & mis-categorisations |
| Analytics | `AnalyticsAgent` | Trends + next-month forecast |
| Settings | `SettingsAgent` | Budget & savings recommendations |

## Graph

```
              START
                |
           +----v----+
           | router  |   picks node from state["tab"]
           +--+---+--+---+---+
              |   |   |   |
              v   v   v   v
         dashboard trans analytics settings
              |   |   |   |
              +---+---+---+
                  |
                 END
```

Every node:
1. Pre-computes deterministic stats in Python (the LLM never invents numbers).
2. Calls GPT-4o-mini via `langchain_openai.ChatOpenAI`, bound to a strict JSON
   schema through OpenAI Structured Outputs.
3. Writes `stats` + `result` back to the shared `AgentState`.

## Stack

- `langgraph` – state-graph orchestrator
- `langchain-openai` / `langchain-core` – typed message wrappers
- `openai` – underlying HTTP client
- `fastapi` + `uvicorn` – HTTP layer
- `python-dotenv` – reads `/app/.env`

## Setup

```bash
cd /app/agents
python3 -m pip install -r requirements.txt
```

Requires `EMERGENT_LLM_KEY` and `EMERGENT_BASE_URL` in `/app/.env`.

## Run the CLI demo

```bash
cd /app
python3 -m agents.demo --graph                     # print the graph structure
python3 -m agents.demo --tab dashboard
python3 -m agents.demo --tab all                   # runs every tab in sequence
```

## Run the HTTP service

```bash
cd /app
uvicorn agents.server:app --host 0.0.0.0 --port 8001 --reload

curl -X POST http://localhost:8001/agent/analytics \
  -H "Content-Type: application/json" \
  -d @agents/sample.json

curl http://localhost:8001/graph                   # graph diagram
```

## Why LangGraph?

Compared to the earlier pure-SDK version this refactor gives you:

- **Typed shared state** (`AgentState`) that flows through every node.
- **Conditional edges** at the router so the same graph handles all 4 tabs.
- **Easy future extension**: add a supervisor node, add memory / checkpoints,
  add streaming, or fan out to multiple agents in parallel – all without
  rewriting the surrounding plumbing.
