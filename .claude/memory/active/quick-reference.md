# Quick Reference

Top 10 patterns for web-pulse. Check this FIRST before any task.

---

## Data Pipeline Patterns

### ADD-SOURCE
**Quick Check**: Does `scripts/sources/newsource.mjs` export `default async function` returning `{ source, label, fetched_at, items }`?
**Quick Fix**: (1) Create source module in `scripts/sources/`. (2) Import + add to `SOURCES` array in `fetch-all.mjs`. (3) Add renderer in `index.html` `renderers` object. (4) Add key to `ORDER` array in `index.html`.
**Common Mistake**: Forgetting to add the key to `ORDER` — the tile won't render even though data is fetched.
**See Also**: `README.md` "Adding a tile" section

### SOURCE-MODULE-CONTRACT
**Quick Check**: Does the return shape match `{ source: string, label: string, fetched_at: ISO string, items: Array<{rank, title, ...}> }`?
**Quick Fix**: Every item must have `rank` (1-based) and `title` at minimum. Use `snake_case` for all JSON keys.
**Common Mistake**: Using camelCase in JSON output (e.g., `fetchedAt` instead of `fetched_at`).

### DATA-SHAPE-IMMUTABLE
**Quick Check**: Adding fields to `latest.json` items? OK. Renaming or removing fields? NOT OK.
**Quick Fix**: Add new fields alongside existing ones. The dashboard and any consumers must not break.
**Common Mistake**: Renaming `stars_today` to `todayStars` or similar — breaks the live dashboard.

### HISTORY-MANAGEMENT
**Quick Check**: History at `data/history/<source>/YYYY-MM-DD.json`. Pruned to 30 days by `pruneOldHistory()` in `fetch-all.mjs`.
**Quick Fix**: Each history file has the same shape as `sources[<key>]` in `latest.json`. One file per source per day.
**Common Mistake**: Assuming history exists for all 30 days — sources can fail, and the project is new.

### CLOUDFLARE-OPTIONAL
**Quick Check**: `cloudflare-radar.mjs` reads `CF_RADAR_TOKEN` from `process.env` inside the function (not at module top). Returns `configured: false` if missing.
**Quick Fix**: This is the pattern for any future auth-gated source — graceful degradation, not failure.
**Common Mistake**: Reading env vars at module top level (before `env.mjs` has run).

---

## Development Patterns

### ENV-IMPORT-ORDER
**Quick Check**: Is `import "./env.mjs"` still the FIRST import in `fetch-all.mjs`?
**Quick Fix**: Never add imports above `env.mjs` in `fetch-all.mjs`.
**Common Mistake**: Adding a new utility import above `env.mjs`, causing source modules to read `process.env` before it's populated.

### FAULT-TOLERANCE
**Quick Check**: Is `Promise.allSettled` used in `fetch-all.mjs` (not `Promise.all`)?
**Quick Fix**: Failed sources get error payload: `{ source, fetched_at, error: message, items: [] }`. Never throw from the orchestrator's settled handler.
**Common Mistake**: Switching to `Promise.all`, which causes all sources to fail if one fails.

### NAMING-CONVENTIONS
**Quick Check**: kebab-case files (`google-trends.mjs`), camelCase JS (`fetchCountry`), UPPER_SNAKE_CASE constants (`SOURCES`, `TOP_URL`), snake_case JSON keys (`fetched_at`, `stars_today`).
**Common Mistake**: Using camelCase in JSON output or PascalCase for file names.

---

## Deployment Patterns

### DEPLOY-FLOW
**Quick Check**: Push to `main` triggers GitHub Actions deploy. Daily cron on MacBook runs fetch + commit + push.
**Quick Fix**: To deploy, just push to `main`. The fetch runs on Kenny's MacBook, NOT in GitHub Actions.
**Common Mistake**: Trying to configure CI/CD fetch — the fetch is a local scheduled task.

---

## UI/Frontend Patterns

### FRONTEND-RENDERER
**Quick Check**: Is there a matching renderer function in `index.html`'s `renderers` object for this source key?
**Quick Fix**: Renderer is a function `(data, history?) => htmlString`. Returns HTML string of `.item` divs. Must handle empty `items` and `error` payloads.
**Common Mistake**: Not escaping user-controlled strings with the `esc()` helper in `index.html`.

---

**Last Updated**: 2026-04-21
**Pattern Count**: 10
**Next Review**: 2026-04-28
