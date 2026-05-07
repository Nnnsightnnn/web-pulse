#!/usr/bin/env python3
"""Slim web-pulse latest.json down to ~4KB for the Playmakers Dashboard tile.

Output: JSON with only what the dashboard renders — generated_at, plus
per-source { label, data_date, fetched_at, items: [{t, m}] }, top 5 items.
Strips URLs and other large fields to fit in start_process initial output.
"""
import json
import sys
from pathlib import Path

PULSE = Path("/Users/kenny/web-pulse/data/latest.json")


def slim_item(it: dict) -> dict:
    title = (it.get("title") or it.get("name") or "")[:140]
    metric = (
        it.get("views")
        or it.get("score")
        or it.get("engagement")
        or it.get("upvotes")
        or it.get("comments")
        or it.get("players")
        or it.get("peak_24h")
        or it.get("downloads")     # huggingface
        or it.get("volume_24h")    # polymarket
        or it.get("viewers")       # twitch
        or it.get("sig")           # usgs significance
        or 0
    )
    return {"t": title, "m": metric}


def main() -> int:
    try:
        d = json.loads(PULSE.read_text())
    except FileNotFoundError:
        print(json.dumps({"error": f"missing: {PULSE}"}))
        return 1
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"invalid JSON: {e}"}))
        return 1

    sources = d.get("sources") or {}
    out = {
        "generated_at": d.get("generated_at"),
        "sources": {
            k: {
                "label": v.get("label"),
                "data_date": v.get("data_date"),
                "fetched_at": v.get("fetched_at"),
                "items": [slim_item(it) for it in (v.get("items") or [])[:5]],
            }
            for k, v in sources.items()
        },
    }
    print(json.dumps(out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
