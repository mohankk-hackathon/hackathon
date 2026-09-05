# Finance Tracker — Multi-Agent Python System

Four specialised GPT-4o-mini agents, one per tab of the Next.js UI:

| Tab | Agent | Job |
| --- | --- | --- |
| Dashboard | `DashboardAgent` | Health snapshot + 3 highlights |
| Transactions | `TransactionAgent` | Detect anomalies & mis-categorisations |
| Analytics | `AnalyticsAgent` | Trends + next-month forecast |
| Settings | `SettingsAgent` | Budget & savings recommendations |

All agents:

1. Pre-compute deterministic stats in Python (so the LLM never has to invent numbers).
2. Send those stats to GPT-4o-mini via the Emergent Universal LLM Key.
3. Return **guaranteed-valid JSON** via OpenAI Structured Outputs.

## Setup

```bash
cd /app/agents
python3 -m pip install -r requirements.txt
```

The agents read `EMERGENT_LLM_KEY` and `EMERGENT_BASE_URL` from `/app/.env`.

## Run the CLI demo

```bash
cd /app
python3 -m agents.demo --tab dashboard
python3 -m agents.demo --tab transactions
python3 -m agents.demo --tab analytics
python3 -m agents.demo --tab settings
python3 -m agents.demo --tab all         # runs every agent in sequence
```

Use `--file path/to/your.json` to test against your own transactions.

## Run the HTTP service

```bash
cd /app
uvicorn agents.server:app --host 0.0.0.0 --port 8001 --reload
```

Then from anywhere:

```bash
curl -X POST http://localhost:8001/agent/dashboard \
  -H "Content-Type: application/json" \
  -d @agents/sample.json      # or {"transactions":[...]}
```

## Frontend integration

Every tab in `/app/app/page.js` fires an effect on activation. To call these
agents from the browser, add a `useEffect` inside each tab section that POSTs
the current `transactions` array to `/agent/{tab}` and renders the result.

(Not wired up in this drop – the task was the agent code itself.)
