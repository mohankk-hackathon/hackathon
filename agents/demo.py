"""CLI demo - run any agent from the terminal via the LangGraph app.

Usage:
    python -m agents.demo --tab dashboard
    python -m agents.demo --tab all
    python -m agents.demo --graph            # just print the graph diagram
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from agents.graph import run_tab, tabs, render_diagram


def _c(text: str, code: str) -> str:
    return f"\033[{code}m{text}\033[0m"


def pretty(name: str, result: dict) -> None:
    print()
    print(_c(f"── {name.upper()} AGENT " + "─" * 40, "96"))
    # If this was the supervisor path, show which sub-agents ran in parallel
    if result.get("agent") == "supervisor" and result.get("sub_results"):
        subs = [r["agent"] for r in result["sub_results"]]
        print(_c(f"   ⟳ parallel fan-out: {', '.join(subs)}", "90"))
    print(json.dumps(result.get("result", result), indent=2, default=str, ensure_ascii=False))


def main() -> int:
    parser = argparse.ArgumentParser(description="Finance Tracker LangGraph multi-agent demo")
    parser.add_argument("--tab", choices=[*tabs(), "all"], help="Which tab to invoke")
    parser.add_argument("--file", default=str(Path(__file__).with_name("sample.json")))
    parser.add_argument("--graph", action="store_true", help="Print the compiled graph")
    args = parser.parse_args()

    if args.graph or not args.tab:
        print(_c("\n🌐  LangGraph structure\n", "95"))
        print(render_diagram())
        if not args.tab:
            return 0

    with open(args.file) as fh:
        transactions = json.load(fh)

    active = tabs() if args.tab == "all" else [args.tab]

    for t in active:
        print(_c(f"\n⚡  invoking graph with tab='{t}'  → node routes to {t} agent", "93"))
        try:
            result = run_tab(t, transactions)
            pretty(t, result)
        except Exception as exc:  # noqa: BLE001
            print(_c(f"{t} agent failed: {exc}", "91"))
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
