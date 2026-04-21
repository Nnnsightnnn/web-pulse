# Web Pulse — Claude Context

Essential project context. Full details in `.claude/architecture/layer-stack.md`.

## Tech Stack

Node.js 18+ (ESM, `.mjs`) · Vanilla JS/CSS (no framework, no build step) · GitHub Pages · Daily MacBook cron · Single dep: `node-html-parser`

## Project Structure

```
index.html                          # Single-file dashboard (HTML + CSS + vanilla JS)
scripts/
  env.mjs                           # Zero-dep .env loader (MUST import first)
  fetch-all.mjs                     # Orchestrator: parallel fetch, write data, prune history
  sources/
    wikipedia.mjs                   # Wikimedia pageviews API (3-date retry)
    hackernews.mjs                  # Firebase API (top 25)
    reddit.mjs                      # Public JSON (r/all top/hour)
    github-trending.mjs             # HTML scrape via node-html-parser
    google-trends.mjs               # RSS × 6 countries, regex XML parse
    cloudflare-radar.mjs            # Radar API (optional, token-gated)
data/
  latest.json                       # Current snapshot (dashboard reads this)
  history/<source>/YYYY-MM-DD.json  # Daily snapshots (30-day retention)
.github/workflows/pages.yml         # Auto-deploy on push to main
```

---

## Critical Guard Rails

### Memory Check (REQUIRED)
**ALWAYS check first:** `.claude/memory/active/quick-reference.md`
> TRIGGER: Before starting any task

### Verification [VERIFY]
**[VERIFY-001]** Read code before recommending changes
> TRIGGER: Before proposing ANY changes

### Execution [EXEC]
**[EXEC-001]** Parallelize independent operations
> TRIGGER: Before making tool calls

---

### Data Integrity [DATA]
**[DATA-001]** Data shape is immutable — do NOT rename or remove fields in `latest.json`. Adding new fields is OK.
> TRIGGER: When modifying any source module return value or fetch-all output

**[DATA-002]** `env.mjs` must be the FIRST import in `fetch-all.mjs` — source modules read `process.env` at parse time.
> TRIGGER: When editing imports in fetch-all.mjs

### Security [SEC]
**[SEC-001]** No secrets in commits — `.env` is gitignored. `CF_RADAR_TOKEN` lives only on MacBook.
> TRIGGER: When creating or editing any committed file

### Dependencies [DEP]
**[DEP-001]** Minimal dependencies — justify any new npm package. Current count: 1 (`node-html-parser`). Prefer Node stdlib.
> TRIGGER: When considering npm install

### Infrastructure [INFRA]
**[INFRA-001]** Do not touch the MacBook scheduler — work only inside the repo.
> TRIGGER: When modifying deployment or scheduling

### Development [DEV]
**[DEV-001]** Retry patterns are load-bearing — Wikipedia 3-date fallback, Reddit User-Agent, Google Trends multi-country aggregation are deliberate resilience, not bugs.
> TRIGGER: When simplifying or refactoring source modules

**[DEV-002]** `Promise.allSettled` for fault tolerance — a single flaky source must never crash the whole fetch. Error payloads `{ error, items: [] }` are part of the contract.
> TRIGGER: When modifying fetch-all.mjs

**[DEV-003]** Naming: kebab-case files, camelCase JS functions, UPPER_SNAKE_CASE constants, snake_case JSON keys.
> TRIGGER: When creating new files or adding JSON fields

**[DEV-004]** No TypeScript, no linting, no tests, no build step — this is intentional simplicity. Do not add tooling without explicit approval.
> TRIGGER: When proposing project structure changes

---

## Task Management [TASK]
**[TASK-001]** Use task tracking for multi-step work
**[TASK-002]** Commit format: `"Fix: [Description] (Task: <id>)"`
> TRIGGER: When starting complex tasks

---

## Quick Reference

**Memory**: `.claude/memory/active/quick-reference.md`
**Architecture**: `.claude/architecture/layer-stack.md`
**Pain Points**: `.claude/pain-points/active-pain-points.md`
**Commands**: `/focus`, `/investigate`, `/brainstorm-design`, `/plan-as-group`

---

## Important Reminders

Do what is asked; nothing more, nothing less.
Verify assumptions before acting.
Parallelize independent work.
