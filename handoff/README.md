# Web Pulse — Agent Handoff

This is the master handoff document for agents extending `web-pulse`. If you're an agent, **read this file first**, then the phase-specific spec you've been assigned.

## What web-pulse is

A zero-build, static dashboard at https://nnnsightnnn.github.io/web-pulse/ that renders a daily snapshot of what's trending across six public sources. Data is refreshed every morning by a scheduled task on Kenny's MacBook (`web-pulse-refresh`, runs `npm run fetch && git commit && git push`). GitHub Pages redeploys the static site within ~2 minutes of each push.

The site is read-only from the browser's perspective — it just fetches `data/latest.json` and renders it.

**Live site:** https://nnnsightnnn.github.io/web-pulse/
**Repo:** https://github.com/Nnnsightnnn/web-pulse
**Working copy in this sandbox:** `/sessions/cool-optimistic-euler/web-pulse/` (a fresh git clone of the repo; use this as your working directory)

## Architecture at a glance

```
┌─────────────────────────────────────────────────────────────────────┐
│ MacBook scheduled task (7am daily):                                  │
│   cd ~/web-pulse && npm run fetch && git commit data/ && git push   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ scripts/fetch-all.mjs                                                │
│   Runs 6 source fetchers in parallel (Promise.allSettled)           │
│   Writes:                                                            │
│     data/latest.json                                                 │
│     data/history/<source>/YYYY-MM-DD.json                            │
│   Prunes history > 30 days                                           │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ GitHub Actions: .github/workflows/pages.yml                          │
│   On push to main → deploys root of repo to GitHub Pages             │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ index.html (single-file static dashboard)                            │
│   Fetches data/latest.json                                           │
│   Renders a grid of tiles, one per source                            │
│   Also fetches data/history/wikipedia/*.json for sparklines          │
└─────────────────────────────────────────────────────────────────────┘
```

## Data shapes (these are your API — don't break them)

### `data/latest.json`

```json
{
  "generated_at": "2026-04-21T07:00:12.345Z",
  "sources": {
    "wikipedia":        { "source": "wikipedia", "label": "...", "fetched_at": "...", "data_date": "2026-04-20", "items": [...] },
    "hackernews":       { "source": "hackernews", "label": "...", "fetched_at": "...", "items": [...] },
    "reddit":           { "source": "reddit", "label": "...", "fetched_at": "...", "items": [...] },
    "github":           { "source": "github", "label": "...", "fetched_at": "...", "items": [...] },
    "google-trends":    { "source": "google-trends", "label": "...", "fetched_at": "...", "items": [...] },
    "cloudflare-radar": { "source": "cloudflare-radar", "label": "...", "fetched_at": "...", "configured": true, "items": [...] }
  }
}
```

If a source throws during fetch, its entry becomes `{ source, fetched_at, error: "message", items: [] }`.

### Per-source item shapes

Every item has `rank` (1-based) and `title`. The rest varies:

| Source             | Fields beyond `rank`, `title`                                             |
|--------------------|----------------------------------------------------------------------------|
| `wikipedia`        | `url`, `views`                                                             |
| `hackernews`       | `url`, `hn_url`, `score`, `comments`, `author`                              |
| `reddit`           | `url`, `subreddit`, `score`, `comments`                                     |
| `github`           | `url`, `language`, `description`, `stars`, `stars_today`                    |
| `google-trends`    | `news_url?`, `news_source?`, `geos: [countryCode]` (e.g. `["US","GB"]`)    |
| `cloudflare-radar` | `url`, `category?`                                                          |

### `data/history/<source>/YYYY-MM-DD.json`

Identical shape to one entry under `sources[<source>]` in `latest.json`. One file written per source per day. Pruned after 30 days by `fetch-all.mjs` (Phase 1 will extend this).

## File layout

```
web-pulse/
├── index.html                      # Single-file dashboard (HTML + CSS + JS)
├── package.json                    # Only dep: node-html-parser
├── package-lock.json
├── .github/workflows/pages.yml     # Auto-deploy on push to main
├── scripts/
│   ├── env.mjs                     # Zero-dep .env loader — imported FIRST in fetch-all
│   ├── fetch-all.mjs               # Orchestrator
│   └── sources/
│       ├── wikipedia.mjs
│       ├── hackernews.mjs
│       ├── reddit.mjs
│       ├── github-trending.mjs
│       ├── google-trends.mjs
│       └── cloudflare-radar.mjs
├── data/
│   ├── latest.json                 # Committed to main on every daily refresh
│   └── history/<source>/YYYY-MM-DD.json
└── docs/handoff/                   # <- you are here
    ├── README.md                   # This file
    ├── phase-1-deltas-and-sparklines.md
    ├── phase-2-cross-source-clustering.md
    ├── phase-3-new-sources.md
    └── phase-4-analysis-surface.md
```

## Rules of engagement

1. **Branch per phase.** Name it `phase-<N>-<slug>` (e.g. `phase-1-deltas`). Do not commit to `main`.
2. **Don't break latest.json's existing shape.** Fields can be added; fields can't be renamed or removed. The live dashboard reads it.
3. **Don't break the dashboard while building a feature.** The daily scheduled task keeps running. If you add a new field the renderer doesn't know about, the dashboard must still render.
4. **Test locally before committing.**
   - `npm install` (first time only; `node_modules` is gitignored).
   - `npm run fetch` — should complete in a few seconds, write `data/latest.json` and snapshots.
   - `npm run serve` — serves on http://localhost:8080. Open in a browser, hit every tile, check the console.
5. **Don't commit secrets.** `.env` is gitignored. If you need `CF_RADAR_TOKEN`, Kenny's Mac has it — don't copy its value into any file you commit.
6. **Don't touch the scheduled task or Kenny's Mac.** Work only inside `web-pulse/`. The orchestration layer is already wired.
7. **Keep deps minimal.** Current dep count: 1 (`node-html-parser`). If you need a new dep, justify it in your PR description. Prefer stdlib.
8. **Style.** ES modules (`.mjs`), 2-space indent, double quotes, no semicolons in new code unless the file you're editing uses them. Match the style of the file you're in.
9. **Gotchas to know:**
   - Wikipedia pageviews API lags 1–2 days. `wikipedia.mjs` retries 3 consecutive dates. Don't remove the retry.
   - GitHub trending page only surfaces ~8 repos/day. Don't "fix" this with pagination — there isn't any.
   - Reddit public JSON rate-limits aggressively without a custom User-Agent. Keep the one in `reddit.mjs`.
   - Google Trends has no stable JSON API; RSS per country is what works today. If an `/api/...` URL shows up in search results, it's probably retired.
   - `scripts/env.mjs` MUST be the first import in `fetch-all.mjs`. ES module imports run top-down, and source modules may read `process.env` at parse time (though we now do it inside functions — keep it that way).

## Phase overview

| Phase | Spec                                                              | Goal                                                                                                 | Estimated effort |
|-------|-------------------------------------------------------------------|------------------------------------------------------------------------------------------------------|------------------|
| 1     | [phase-1-deltas-and-sparklines.md](phase-1-deltas-and-sparklines.md) | Use the history we already keep: rank deltas, new/returning badges, sparklines on every tile, weekly top-20 view, 180-day retention | ~4 hours         |
| 2     | [phase-2-cross-source-clustering.md](phase-2-cross-source-clustering.md) | Detect topics that appear in 2+ sources on the same day; surface as a "Cross-source hits" tile        | ~1 day           |
| 3     | [phase-3-new-sources.md](phase-3-new-sources.md)                    | Add 4–6 new sources (News, YouTube, Spotify, Steam, Twitch, Bluesky) to broaden cultural coverage    | ~1 day           |
| 4     | [phase-4-analysis-surface.md](phase-4-analysis-surface.md)          | Category filters, history search, auto-generated narrative brief at top of page                       | ~1 day           |

**Recommended order:** 1 → 2 → 3 → 4. Phase 2 is the highest-leverage feature; Phase 1 builds the foundation it needs. Phase 3 is valuable but meaningless without 1 & 2. Phase 4 is polish on top of all of it.

## How to get your work back to the live site

The sandbox clone cannot push directly to GitHub (no credentials). When your phase is ready:

1. Make sure your branch is committed locally in the sandbox.
2. Leave a note for Kenny in your final message: branch name, summary of what changed, how to verify.
3. Kenny will pull the branch onto his Mac (`git fetch && git checkout <branch>`), eyeball it, merge to `main`, push.
4. GitHub Pages deploys within ~2 minutes.

**Do not attempt to push from the sandbox.** It will fail, and the error isn't helpful.

## Getting help

If you're stuck on something that isn't covered in your phase spec, prefer to ask Kenny directly in your response rather than guess. The cost of a bad assumption compounds.
