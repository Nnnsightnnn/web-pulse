# Phase 1 — Deltas, sparklines, retention

> **Read `docs/handoff/README.md` first.** This spec assumes you know the repo architecture, data shapes, and rules of engagement.

## Goal

Make the data we already keep earn its keep. Right now `data/history/` has 30 days of per-source snapshots and we only use them for Wikipedia sparklines. This phase surfaces that history across every tile.

## What "done" looks like

When a user loads the dashboard, they can tell at a glance:

1. **Which items are new today** vs. yesterday (NEW badge).
2. **Which items moved up or down** in rank vs. yesterday (↑3, ↓7, —).
3. **Which items have staying power** (4-day streak, 7-day streak, etc.).
4. **How each item trended over the last 7 days** (sparkline next to the title, not just for Wikipedia).

And on the page itself:

5. **A new "This week" view** toggle that switches the tiles between "today" and "top-of-week aggregated across 7 days."
6. **History retention extended from 30 → 180 days** (so future phases have enough data for trend analysis).

## Tasks

### Task 1.1 — Extend history retention to 180 days

**File:** `scripts/fetch-all.mjs` line 89 (the `pruneOldHistory(30)` call).

Change to `pruneOldHistory(180)`. That's it for this task. Don't change the function signature — future phases may go further.

**Gotcha:** the Mac's working copy already has a few days of 30-day-pruned history. After the next daily run, new snapshots will accumulate up to 180. Don't try to back-fill; you can't retroactively fetch snapshots from the past.

### Task 1.2 — Build a shared "load history" helper

**New file:** `scripts/history.mjs` (Node) — used if fetch-all ever needs it. But the primary consumer is the browser.

**New file (primary work):** an inline helper inside `index.html` that loads the last N days of snapshots for every source, keyed by a stable identity.

**Stable identity per source** — use this when keying items across days:

```js
function itemKey(source, item) {
  switch (source) {
    case "wikipedia":        return item.title;
    case "hackernews":       return `hn:${item.url || item.hn_url}`;
    case "reddit":           return `reddit:${item.url}`;
    case "github":           return item.title;              // "owner/repo"
    case "google-trends":    return item.title.toLowerCase();
    case "cloudflare-radar": return item.title;              // domain
    default:                 return item.title;
  }
}
```

**Output shape** the helper should return:

```js
// loadHistory(source, days) => { [itemKey]: [{ date, rank, metric }] }
// where `metric` is source-specific: views for wiki, score for hn/reddit, stars_today for github, geos.length for trends, undefined for radar.
```

Load sequentially from oldest to today so `series[i]` corresponds to `N-i` days ago.

### Task 1.3 — Compute badges

**New helper in `index.html`:**

```js
// Given today's items and loaded history for a source, annotate each item
// with: { delta: number|null, streak: number, isNew: boolean, series: number[]|null }
function annotate(source, todayItems, history) { ... }
```

- `delta`: today's rank minus yesterday's rank. `null` if item not present yesterday. Negative means moved up (better rank), positive means moved down.
- `isNew`: true if the item was not in any of the last 3 days of history.
- `streak`: count of consecutive days (including today) the item appears in that source's top 25.
- `series`: array of rank values for the last 7 days, oldest first, padded with `null` for gaps.

### Task 1.4 — Render badges + sparklines in every tile

**File:** `index.html`, the `renderers` object.

Add between `.rank` and `.title`:

- A delta pill: `<span class="delta up">↑3</span>` / `<span class="delta down">↓7</span>` / `<span class="delta flat">—</span>`. Hide if `delta` is `null`.
- A NEW badge: `<span class="badge new">NEW</span>` when `isNew`.
- A streak badge: `<span class="badge streak">🔥 4d</span>` when `streak >= 3`. (Use a text label "4d" — keep emoji minimal; Kenny's site is otherwise emoji-free.) Actually, skip the emoji: just `<span class="badge streak">streak 4d</span>`.
- A sparkline at the right of the title, matching the current Wikipedia treatment. Use the existing `sparkline()` function — but note the current one expects raising-is-good values (views). For rank, lower is better, so either flip the Y axis inside sparkline() or pass negated ranks. Pick one and document the choice in a comment.

Every source renderer should receive history and use it — not just Wikipedia. Refactor `renderers.wikipedia(data, history)` so all renderers take `(data, annotations)` uniformly, where `annotations` is the output of Task 1.3.

### Task 1.5 — Add CSS for badges

Add to the `<style>` block near the existing `.sub` / `.metric` rules:

```css
.delta { font-family: var(--mono); font-size: 11px; padding: 1px 5px; border-radius: 4px; margin-left: 6px; }
.delta.up   { color: var(--up); }
.delta.down { color: var(--down); }
.delta.flat { color: var(--dim); }
.badge { font-family: var(--mono); font-size: 10px; text-transform: uppercase; padding: 1px 5px; border-radius: 3px; margin-left: 6px; letter-spacing: 0.04em; }
.badge.new    { background: var(--accent); color: var(--bg); }
.badge.streak { background: var(--border); color: var(--muted); }
```

### Task 1.6 — "This week" view toggle

Add a button at the top of the page, next to the "updated X ago" metadata:

```html
<div class="view-toggle">
  <button data-view="today" class="active">Today</button>
  <button data-view="week">This week</button>
</div>
```

When "This week" is active, each tile's items come from a different aggregation:

- Load the last 7 days of history for each source.
- For each item (keyed by `itemKey()`), sum its appearances and compute avg rank.
- Sort by (appearances desc, avg rank asc). Take top 25.
- Render the same way, but the "metric" column shows `Xd` (days appeared in window) instead of views/score.

Store view state in URL hash (`#view=week`) so it survives reload.

### Task 1.7 — Polish & test

- Open the page in a fresh browser window; watch the network panel — should see `latest.json` + `history/<source>/*.json × 7` per source.
- If you enable `Disable cache` in devtools, subsequent reloads should still feel snappy (<1s). If not, cache `history/*` response objects in memory for the duration of the page.
- Toggle between Today and Week views; both should render without errors.
- With the scheduled task running overnight, sparklines should populate for every source after ~3 days.

## Non-goals for this phase

- Do not introduce a build step. Keep `index.html` as a single static file.
- Do not fetch new data. This phase is entirely about the data we already have.
- Do not change `data/latest.json`'s schema. Read-only consumption only.
- Do not touch `fetch-all.mjs` beyond Task 1.1.

## Acceptance criteria

- [ ] `scripts/fetch-all.mjs` prunes at 180 days.
- [ ] Every tile shows delta pills where history exists.
- [ ] Every tile shows sparklines where ≥2 days of history exists.
- [ ] NEW badges appear on items absent from the last 3 days.
- [ ] Streak badges appear on items with 3+ consecutive days.
- [ ] "This week" toggle produces a different-looking set of items than "Today".
- [ ] URL hash persists view selection across reloads.
- [ ] No console errors on load.
- [ ] Lighthouse performance score ≥ 90 on the rendered page.

## How to hand off

Branch: `phase-1-deltas`. Commit with a summary message like `Phase 1: deltas, sparklines, weekly view, 180d retention`. Tell Kenny in your final message what to eyeball before merging.
