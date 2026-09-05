"""CLI demo - run any agent from the terminal.

Usage:
    python -m agents.demo --tab dashboard
    python -m agents.demo --tab transactions --file agents/sample.json
    python -m agents.demo --tab all      # run every agent in sequence
"""
from __future__ import annotations

import argparse
import json
import sys
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from agents.orchestrator import Orchestrator


def _c(text: str, code: str) -> str:
    return f"\033[{code}m{text}\033[0m"


def pretty(name: str, result: dict) -> None:
    print()
    print(_c(f"── {name.upper()} AGENT " + "─" * 40, "96"))
    print(json.dumps(result.get("result", result), indent=2, default=str))


def main() -> int:
    parser = argparse.ArgumentParser(description="Finance Tracker multi-agent demo")
    parser.add_argument("--tab", required=True, choices=["dashboard", "transactions", "analytics", "settings", "all"])
    parser.add_argument("--file", default=str(Path(__file__).with_name("sample.json")))
    args = parser.parse_args()

    with open(args.file) as fh:
        transactions = json.load(fh)

    orch = Orchestrator()
    tabs = orch.tabs if args.tab == "all" else [args.tab]

    for t in tabs:
        print(_c(f"\n⚡  Calling {t} agent (→ gpt-4o-mini)…", "93"))
        try:
            result = orch.run(t, transactions)
            pretty(t, result)
        except Exception as exc:  # noqa: BLE001
            print(_c(f"{t} agent failed: {exc}", "91"))
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
