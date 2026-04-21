# Phase 4 — Analysis surface

> **Read `docs/handoff/README.md` first.** This phase assumes Phases 1, 2, and 3 have shipped (or at least that their data structures are in place).

## Goal

Polish the dashboard into an actual analysis tool. At this point we have:

- Multi-source daily snapshots (Phase 3 → ~10 sources).
- 180 days of history per source (Phase 1).
- Cross-source clusters (Phase 2).
- Deltas, streaks, sparklines (Phase 1).

What's missing is the ability to *interrogate* all of that. Filters. Search. A narrative summary. That's this phase.

## What "done" looks like

1. A filter bar at the top of the page with category chips (All / Tech / News / Entertainment / Gaming / Music / Global).
2. A search input that filters items across *every* tile in real time.
3. A "Today's brief" block at the very top of the page: 3–5 sentences of auto-generated narrative pulling from the top cross-source clusters.
4. A `/history` view: a simple time-series visualization for a single keyword or cluster over the last N days.

## Tasks

### Task 4.1 — Tile category tags

**File:** `index.html`, alongside the `ORDER` constant.

Define a tag map:

```js
const TILE_CATEGORIES = {
  wikipedia:        ["news", "culture"],
  hackernews:       ["tech"],
  reddit:           ["news", "culture"],
  github:           ["tech"],
  "google-trends":  ["news", "global"],
  "cloudflare-radar": ["tech", "global"],
  // Phase 3:
  gdelt:            ["news", "global"],
  youtube:          ["entertainment"],
  spotify:          ["music"],
  steam:            ["gaming"],
  bluesky:          ["social"],
  stackoverflow:    ["tech"],
};
```

Each tile gets `data-categories="tech news"` rendered as an HTML attribute.

### Task 4.2 — Category filter bar

Render a row of chips under the header:

```html
<nav class="filter-bar">
  <button data-filter="all" class="active">All</button>
  <button data-filter="tech">Tech</button>
  <button data-filter="news">News</button>
  <button data-filter="entertainment">Entertainment</button>
  <button data-filter="gaming">Gaming</button>
  <button data-filter="music">Music</button>
  <button data-filter="social">Social</button>
  <button data-filter="global">Global</button>
</nav>
```

Clicking a chip hides tiles whose `data-categories` doesn't include that filter. "All" shows everything. Store selection in URL hash: `#filter=tech`.

CSS: chips should feel light. Use the existing `.delta` styling as a reference for the aesthetic.

### Task 4.3 — Live search

Add a search input to the header:

```html
<input type="search" id="search" placeholder="Search everything…" />
```

On input (debounced 100ms), traverse every `.item` in every tile. Hide items whose `title + sub` text does not contain the query (case-insensitive). Tiles with zero visible items become `.tile.filtered-empty` with a "No matches" body.

This is a visual-only filter — the data stays loaded. The search input is not wired to history (yet); that's Task 4.5.

### Task 4.4 — "Today's brief" narrative

A block at the top of the page summarizing the day in 3–5 sentences. Deterministic templating for v1; LLM upgrades are a follow-up.

**Source of content:** the `clusters` array from Phase 2 + the top-ranked item from 3 diverse sources.

**Template:**

```
Across {N} sources on {date}, the story of the day was {cluster[0].name},
appearing in {cluster[0].sources.join(", ")} {cluster[0].items.length} times.
{cluster[1] ? `Also trending: ${cluster[1].name} (${cluster[1].sources.join(", ")}).` : ""}
In tech, {github.items[0].title} is climbing GitHub.
In news, {gdelt.items[0].title}.
On Reddit, {reddit.items[0].title}.
```

Implementation:

**New file:** `scripts/brief.mjs`

```js
export function generateBrief(latest) {
  // returns a string
}
```

Called from `fetch-all.mjs` after clustering:

```js
import { generateBrief } from "./brief.mjs";
latest.brief = generateBrief(latest);
```

Store in `latest.brief`. Render at top of page:

```html
<section class="brief"><p>Today's brief</p><p class="brief-text">...</p></section>
```

### Task 4.5 — History view (`#history=...`)

When URL hash contains `history=<keyword>`, render a dedicated view instead of the tile grid:

1. Fetch `data/history/<source>/<date>.json` for each source, for the last 30 days.
2. For each day, count items whose title contains `<keyword>` (case-insensitive).
3. Render as a simple inline-SVG bar chart: one bar per day, height proportional to count.
4. Under the chart, list the top 20 matching items across the window with their date + source.
5. Provide a "← Back" link to the main grid.

This view shares the page with the grid — switching via hash change. `window.addEventListener("hashchange", route)`.

### Task 4.6 — Wire search to history

In Task 4.3, when the search input has a value and the user presses Enter, navigate to `#history=<the query>`. This turns the live filter into a persistent analysis query.

### Task 4.7 — Polish & test

- Filters + search combine correctly (search within a filtered category).
- URL hash survives reload.
- Hash-driven nav works on back/forward.
- No console errors.
- Mobile layout survives — filter bar should wrap rather than scroll horizontally.

## Non-goals for this phase

- **No LLM-generated brief yet.** The template above is enough for v1. An LLM pass is a Phase 4.1 follow-up once a user decides whether the static version is useful.
- **No authentication, no per-user state.** Everything is in the URL hash.
- **No write actions.** The site is read-only.
- **No sparkline chart library.** Keep using inline SVG; the complexity is tiny.

## Acceptance criteria

- [ ] Category chips filter tiles in real time.
- [ ] Search input filters items across all visible tiles.
- [ ] Today's brief renders above the grid, generated from `latest.brief`.
- [ ] `#history=<term>` navigates to a distinct view with a chart + item list.
- [ ] All state persists across reload via URL hash.
- [ ] No console errors; Lighthouse performance ≥ 85.
- [ ] Mobile viewport renders without horizontal scroll.

## Gotchas

- The "No matches" state should be obvious enough that users don't think the page broke. Use the existing `.tile.error` styling as a reference.
- Browsers can treat `#` as a scroll anchor. Use `pushState(null, '', '#foo')` + a `hashchange` listener rather than `location.hash =` to avoid jump-to-top.
- If Phase 3 isn't fully shipped, some tiles in `TILE_CATEGORIES` won't exist yet. The category filter should silently ignore unknown tiles.
- The `brief.mjs` function MUST handle missing sources gracefully — cluster may be empty, some sources may error. Return "No standout stories today — check back in a few hours." rather than throwing.

## How to hand off

Branch: `phase-4-analysis`. Include screenshots (or at minimum, rendered-page descriptions) of: main grid with a filter applied, history view for a sample keyword, and the brief block.
