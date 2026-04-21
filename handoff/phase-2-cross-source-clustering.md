# Phase 2 — Cross-source clustering

> **Read `docs/handoff/README.md` first.** This spec assumes you know the repo architecture, data shapes, and rules of engagement. It also assumes Phase 1 has shipped (or at least that you're not re-doing its work).

## Goal

The single most interesting thing this dashboard *could* show — and doesn't — is when a topic appears in multiple sources at once. "OpenAI GPT-5" hitting HN + r/openai + Wikipedia page-view spike + Google Trends "gpt 5" isn't noise, it's a real story. This phase surfaces those cross-source hits as a top-of-page tile.

Nothing else on the open web does this for free. This is the feature that turns web-pulse from "a ticker" into "an analysis tool."

## What "done" looks like

- A new orchestration pass (run inside `fetch-all.mjs`, after the six fetchers complete) that extracts entities/topics from all fetched items and finds clusters that cross source boundaries.
- A new tile at the top of the dashboard titled **"Cross-source hits"** showing the top ~10 clusters for today, each with:
  - The cluster name (the most representative title).
  - A row of source badges (`HN · Reddit · Wikipedia · Trends`) indicating which sources contributed.
  - Links to each contributing item.
- Writes its output into `data/latest.json` as a new top-level key `clusters: [...]` — **additive, never removes existing fields**.

## Architectural decision: where to cluster

**Cluster at fetch time, not at render time.** The browser should not recompute clusters — it's static and already paying the cost of 6× source loads. Doing it in `fetch-all.mjs` means the result is cached in `latest.json` and the browser reads it for free.

## Tasks

### Task 2.1 — Write the entity extractor

**New file:** `scripts/cluster.mjs`

Single export: `clusterItems(sources: Record<string, SourceData>): Cluster[]`

where:

```ts
type Cluster = {
  id: string;                    // short hash of the canonical name
  name: string;                  // most representative original title
  sources: string[];             // ["hackernews", "reddit", ...]  (unique, sorted)
  items: Array<{
    source: string;
    title: string;
    url: string | null;
    rank: number;
  }>;
  score: number;                 // composite score used for ordering
};
```

**Algorithm (start simple, evaluate before adding complexity):**

1. **Normalize every item title to tokens.**
   - Lowercase.
   - Strip punctuation.
   - Remove stopwords (use a hardcoded list of the top ~100 English stopwords — don't pull a dep for this).
   - Stem aggressively? No — too much recall, too many false clusters. Leave tokens raw.
   - Keep tokens of length ≥ 3 only.

2. **Pair-wise compare items across sources.**
   - For items A and B from different sources: compute Jaccard similarity of their token sets.
   - If `|A ∩ B| >= 2 AND Jaccard(A, B) >= 0.3`, they're a match.
   - Within a source, do not cluster — every source may already surface 3 variants of the same topic; that's fine.

3. **Build clusters via connected components.**
   - Union-find over all items; two items are in the same component if they match above.
   - A cluster is a connected component that spans ≥ 2 distinct sources.

4. **Pick cluster name:** the title of the item with the best rank across all items in the cluster, after a small tiebreaker toward shorter titles (to favor canonical entity names).

5. **Score:** `score = sum over items of (1 / rank) * sourceWeight(source)`. Default `sourceWeight` = 1 for all sources. Expose as a `const` at the top of `cluster.mjs` so it's tunable.

6. **Sort clusters desc by score, return top 25.**

### Task 2.2 — Integrate into the orchestrator

**File:** `scripts/fetch-all.mjs`

After the `byName` object is fully built, before writing `latest.json`:

```js
import { clusterItems } from "./cluster.mjs";

const clusters = clusterItems(byName);

const latest = {
  generated_at: new Date().toISOString(),
  sources: byName,
  clusters,
};
```

Wrap the cluster call in a try/catch — if clustering throws, log a warning and set `clusters: []` rather than killing the whole run. Data collection is sacred; analysis is best-effort.

### Task 2.3 — Render in the dashboard

**File:** `index.html`

Add a new tile renderer keyed `"clusters"`. Render it at the top of the grid (prepend to ORDER, but inside `load()` render it outside the normal loop so it can be full-width).

```html
<section class="tile tile-wide" id="clusters-tile">
  <header>
    <h2>Cross-source hits</h2>
    <span class="stamp">topics showing up in 2+ sources today</span>
  </header>
  <div class="body">
    <!-- each cluster -->
    <div class="cluster-row">
      <div class="rank">1</div>
      <div class="cluster-body">
        <div class="title">The cluster name</div>
        <div class="sub">
          <span class="badge-src hn"><a href="...">HN #3</a></span>
          <span class="badge-src reddit"><a href="...">Reddit #1</a></span>
          <span class="badge-src wiki"><a href="...">Wikipedia</a></span>
        </div>
      </div>
      <div class="metric">3×</div>
    </div>
  </div>
</section>
```

CSS: make `.tile-wide` span the full grid width with `grid-column: 1 / -1`. Max-height ~320px with vertical scroll for ≥10 clusters.

### Task 2.4 — Write tests

**New file:** `scripts/cluster.test.mjs`

Hand-crafted small fixtures (5–6 items across 3 sources) exercising:

- Two items in different sources with overlapping tokens → should cluster.
- Two items in the same source with overlapping tokens → should NOT cluster.
- Three items across three sources forming a chain → should all be in one cluster.
- An item with no matches → should not appear in output.
- Near-match below threshold → should not cluster.

Run them with `node --test scripts/cluster.test.mjs`. Add `"test": "node --test scripts/*.test.mjs"` to `package.json`.

### Task 2.5 — Eyeball on real data

Run `npm run fetch` locally with today's real data. Look at `data/latest.json`'s `clusters` array:

- Are the cluster names sensible? (If they're stopwordy like "the news today," your stopword list needs more.)
- Are there cluster-of-one results? (Shouldn't happen — filter requires ≥2 sources.)
- Are there obvious misses? (E.g. "AI" and "artificial intelligence" not matching — expected, out of scope for v1.)
- Note any findings in your handoff summary. Phase 2.1 (follow-up) could add synonym lists.

## Non-goals for this phase

- **No NLP dependencies.** No spaCy, no compromise.js, no @xenova/transformers. Pure JS, regex + sets.
- **No remote APIs for entity extraction.** No OpenAI/Claude calls. The clustering must run offline, in the same 2-second window as the data fetch.
- **No historical clustering yet.** Just today's items. Phase 4 may surface week-over-week cluster persistence.
- **Don't change per-source item shapes.** Cluster metadata lives in its own top-level key.

## Acceptance criteria

- [ ] `data/latest.json` has a `clusters` array.
- [ ] Clusters in the wild contain items from ≥2 sources each.
- [ ] Top-of-page "Cross-source hits" tile renders with at least a few plausible clusters on a real day.
- [ ] Zero clusters returned does not break the dashboard (graceful empty state).
- [ ] Clustering failure does not break the data fetch.
- [ ] Tests in `scripts/cluster.test.mjs` all pass.

## Gotchas

- The Wikipedia top list often contains things like "List of..." and "2026 in film" — these will cluster against unrelated items on common tokens like "2026". Add `/^\d{4}$/` filter to drop year tokens, and drop the "list of" prefix before tokenizing.
- Google Trends items sometimes only have 1–2 tokens total ("Knicks"). Don't lower the `|A ∩ B| >= 2` threshold to compensate — that will flood the cluster list with noise. It's OK for Trends items to go unclustered.
- Reddit item titles can be very long ("TIL that in 1958..."). Consider truncating to the first 12 tokens before comparing. The interesting tokens are near the front.

## How to hand off

Branch: `phase-2-clustering`. Include in your handoff summary 3–5 example clusters from today's run so Kenny can eyeball quality before merging.
