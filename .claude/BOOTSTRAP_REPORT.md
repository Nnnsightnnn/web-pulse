# Bootstrap Report — web-pulse

**Date**: 2026-04-21
**Commit**: `7926c8d` (First Cloudflare Radar snapshot)

---

## Tech Stack Discovery

| Category | Details |
|----------|---------|
| Runtime | Node.js 18+ (ESM modules, `.mjs` extension) |
| Frontend | Vanilla JS/CSS in single `index.html` (402 lines, no build step) |
| Dependencies | 1 — `node-html-parser` ^6.1.13 (GitHub trending scraping) |
| Data format | JSON files committed to git |
| Deployment | GitHub Pages via Actions (`.github/workflows/pages.yml`) |
| Scheduling | External MacBook cron (`web-pulse-refresh`) |
| Package manager | npm |

## File Inventory

| Category | Files | Lines |
|----------|-------|-------|
| Configuration | 3 | ~50 |
| Backend (Scripts) | 8 | ~485 |
| Frontend (HTML) | 1 | ~402 |
| Workflow (CI/CD) | 1 | ~39 |
| **Total source** | **13** | **~976** |

---

## Patterns Discovered

1. **Source module contract**: Every source exports `default async function` returning `{ source, label, fetched_at, items }`. Consistent schema across all 6 sources.

2. **Fault tolerance via Promise.allSettled**: `fetch-all.mjs` never fails if a single source fails. Failed sources get error payloads with `items: []`.

3. **Import order dependency**: `env.mjs` must be first import in `fetch-all.mjs`. Side-effect import that populates `process.env` before source modules run.

4. **Console logging convention**: Success: `  ✓ source (Nms, N items)`. Failure: `  ✗ source (Nms): error`. Bookend: `[web-pulse] fetching N sources...` / `[web-pulse] done in Nms`.

5. **Naming conventions**: kebab-case files, camelCase functions, UPPER_SNAKE_CASE constants, snake_case JSON keys.

6. **Graceful degradation**: Cloudflare Radar returns `{ configured: false, message }` when no token — pattern for future auth-gated sources.

7. **History management**: Daily snapshots in `data/history/<source>/YYYY-MM-DD.json`. Auto-pruned to 30 days.

8. **Frontend renderer pattern**: `renderers` object in `index.html` keyed by source name. `ORDER` array controls tile display. Each renderer returns HTML string.

9. **Adding a new source**: 4-step process — (1) create source module, (2) register in SOURCES array, (3) add renderer, (4) add to ORDER.

---

## Guard Rails Identified

| ID | Rule | Trigger |
|----|------|---------|
| DATA-001 | Data shape immutable — don't rename/remove `latest.json` fields | Modifying source return values |
| DATA-002 | `env.mjs` must be first import in `fetch-all.mjs` | Editing imports |
| SEC-001 | No secrets in commits — `.env` gitignored | Creating/editing committed files |
| DEP-001 | Minimal deps — justify new packages (current: 1) | Considering npm install |
| INFRA-001 | Don't touch MacBook scheduler | Modifying deployment/scheduling |
| DEV-001 | Retry patterns are load-bearing | Simplifying source modules |
| DEV-002 | Promise.allSettled for fault tolerance | Modifying fetch-all.mjs |
| DEV-003 | Naming conventions (kebab/camel/UPPER/snake) | Creating files or JSON fields |
| DEV-004 | No TS, no linting, no tests, no build — intentional | Proposing structure changes |

---

## Risk Areas

1. **GitHub trending scrape fragility**: CSS selectors (`article.Box-row`, `h2.h3`, `span.d-inline-block.float-sm-right`) will break when GitHub changes markup. File comments acknowledge this.

2. **Reddit 429 risk**: Unauthenticated access to `reddit.com/r/all/top.json`. File comments note fix (OAuth via script-type app) but it is not implemented.

3. **Google Trends RSS instability**: No stable JSON API. Regex-based XML parsing. Feed URL could change.

4. **Single-file frontend at scale**: At 402 lines, `index.html` is manageable now but Phase 1-4 features will push it past maintainability. May need to split CSS/JS.

5. **No automated tests**: Zero test coverage. Source modules can only be tested by running against live APIs.

---

## What Was Created

- [x] `CLAUDE.md` — Rewritten with real tech stack, structure, and 9 guard rails
- [x] `.claude/architecture/layer-stack.md` — Layer matrix, mermaid diagram, source details, data flow
- [x] `.claude/BOOTSTRAP_REPORT.md` — This file
- [x] `.claude/memory/active/quick-reference.md` — 10 real patterns from codebase analysis

---

## Recommendations

- **Short-term**: Start tracking pain points as sources break (Reddit 429, GitHub selector changes)
- **Medium-term**: Add a JSON schema validator smoke test for `latest.json` post-fetch
- **Long-term**: Plan `index.html` decomposition before Phase 2 clustering feature
