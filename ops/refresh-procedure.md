---
name: web-pulse-refresh
description: Daily 1:15 AM ET: fetch fresh Web Pulse data, synthesize the Spreader briefing (spreader.json), rebuild slim + static dashboard, push to GitHub. Runs before the 2 AM launch-pad build so the Daily Spreader picks up today's briefing.
---

You are refreshing the Web Pulse dashboard. The project lives at `~/web-pulse` on Kenny's MacBook and deploys to GitHub Pages on every push to `main`.

## What this task does

1. Runs `npm run fetch` inside `~/web-pulse`, which pulls fresh data from six sources (Wikipedia, Hacker News, Reddit, GitHub Trending, Google Trends, Cloudflare Radar) and writes:
   - `data/latest.json` (dashboard reads this)
   - `data/history/<source>/YYYY-MM-DD.json` (daily snapshots, kept 30 days)
2. Commits and pushes the updated `data/` directory. GitHub Pages redeploys within ~2 minutes.

## Step 1: Confirm the repo exists

Use Desktop Commander (`mcp__Desktop_Commander__*`) to check that `~/web-pulse` exists and is a git repo:

```bash
test -d ~/web-pulse/.git && echo "OK" || echo "MISSING"
```

If it returns MISSING, STOP. Report that `~/web-pulse` hasn't been set up yet and remind Kenny to follow the setup steps in the README. Do not try to create the repo yourself.

## Step 2: Run the fetcher

```bash
cd ~/web-pulse && npm run fetch
```

Expect output like "✓ wikipedia (...ms, 25 items)" for each source. If a source fails, the orchestrator will still complete and write an error block for that source — the fetch as a whole only fails if Node itself crashes.

If the overall command exits non-zero, report the error and STOP. Do not commit partial data.

## Step 2b: Regenerate the dashboard slim

The Playmakers Dashboard tile reads a pre-slimmed copy of `latest.json` so it can fit in the artifact runtime's output cap. Regenerate it now:

```bash
cd ~/web-pulse && python3 scripts/dashboard-slim.py > data/latest-slim.json
```

This produces a ~6KB summary at `data/latest-slim.json` containing only the top 5 items per source, with title + key metric. The dashboard `cat`s this file directly because it can't invoke `python3` itself.

If the script fails (Python missing, malformed JSON in `latest.json`, etc.), note it in the report and continue — the dashboard will keep showing the previous slim.

## Step 2c: Rebuild the static Playmakers Dashboard

After the slim is regenerated, rebuild the static dashboard at `~/playmakers-dashboard.html`. The dashboard is a self-contained HTML page with all guidance-team + pulse + tracker data inlined; Kenny opens it directly in a browser.

```bash
python3 /Users/kenny/playmakers-data/.claude/guidance-team/build-dashboard.py
```

Output: `~/playmakers-dashboard.html` (~60KB). If the script fails, note it in the report and continue — the dashboard from yesterday will still be on disk.

## Step 2d: Synthesize the Spreader briefing (the AI pass)

`npm run fetch` already wrote `data/spreader.json` — the compact glance the Daily Spreader pulls at 2 AM (lede, up to three throughlines, a 0-100 pulse `strength`). That version is the deterministic floor. Your job now is to make it read like a real briefing: read `data/latest.json` (the full snapshot) and rewrite ONLY the prose fields in `data/spreader.json`.

Rewrite:
- `lede` — 2-4 sentences, the day on the web. Lead with the strongest cross-feed story or the single most striking number. Plain, calm, a good science-broadcaster's register, no hype.
- each throughline's `gist` — one sentence on what it is and why it matters.

Hard rules (this is what keeps it trustworthy):
- Do NOT change any `title`, `url`, or `sources` array. Those are the citations — every claim you write must be supported by the item it sits on. If you can't tie a sentence to a source item present in `latest.json`, don't write it.
- Keep it to at most three throughlines. Don't invent sources, numbers, or events. Numbers must match `latest.json` exactly.
- Set `"engine": "ai"`. Leave `strength`, `date`, `generated_at`, `live_sources`, `total_sources`, `dashboard_url` untouched.
- Sensitive stories (deaths, violence) stay factual and neutral, no editorializing.
- Never use em dashes (Kenny reads this on his launch pad). Use commas, colons, or periods instead.

Write the file back with Desktop Commander (valid JSON, same shape). If anything about this pass is unclear or the data looks malformed, skip it and leave the deterministic floor in place — a plain briefing that shipped beats a rich one that didn't. `data/spreader.json` is under `data/`, so Step 4 commits it automatically.

## Step 3: Check what changed

```bash
cd ~/web-pulse && git status --porcelain
```

You should see modifications under `data/`. If nothing changed (rare — usually means every source failed), skip the commit.

## Step 4: Commit and push

```bash
cd ~/web-pulse
git add data/
git commit -m "Daily refresh: $(date -u +%Y-%m-%d)"
git push origin main
```

Notes:
- Only stage `data/` — never stage `node_modules/`, `.env`, or source-code changes from this task.
- If `git push` fails (network, auth), note it in the output. The local commit is still fine; Kenny can push manually later.
- If there are git lock files (`index.lock`), try removing them first; if that fails, stop and report.

## Step 5: Report

Return a brief summary:
- How many sources succeeded / failed (from the fetch output)
- Any source-specific errors worth flagging (e.g. "Reddit returned 429 — may need OAuth soon")
- Commit SHA
- Whether the push succeeded
- Live site: https://nnnsightnnn.github.io/web-pulse/

Keep the report under 150 words. If all six sources worked and the push succeeded, a one-liner is enough.

## Guardrails

- Never modify files outside `~/web-pulse`.
- Never commit `.env` or secrets.
- Never run destructive git commands (`reset --hard`, `push --force`, `clean -fd`) — if something seems stuck, stop and report.
- If a source starts returning a new shape that breaks the parser, note it in the report but do not attempt to rewrite the source module yourself — that's a job for an interactive session.
