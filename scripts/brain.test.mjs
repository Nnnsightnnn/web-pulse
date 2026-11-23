// Tests for the brain: memory (movement), the topic store, the explainer
// validator and the spreader's fresh-first ranking. Run with `npm test`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { classify, annotateMovement } from "./memory.mjs";
import { tokenize, numeralsConflict, clusterItems } from "./cluster.mjs";
import { updateTopics, sameStory, slugify } from "./topics.mjs";
import { validateDraft } from "./explainer.mjs";
import { generateSpreader } from "./spreader.mjs";

const day = (d, ranks) => ({ date: d, ranks: new Map(Object.entries(ranks)) });

test("movement: new, climbing, holding, falling, returning and days_on", () => {
  const prior = [day("2026-11-21", { "gta vi": 3, riemann: 1 }), day("2026-11-20", { "gta vi": 4 })];
  assert.deepEqual(classify({ title: "GTA VI", rank: 1 }, prior, "2026-11-22"), { days_on: 3, prior_rank: 3, movement: "climbing" });
  assert.equal(classify({ title: "Riemann", rank: 2 }, prior, "2026-11-22").movement, "holding");
  assert.equal(classify({ title: "Riemann", rank: 9 }, prior, "2026-11-22").movement, "falling");
  assert.equal(classify({ title: "Brand new", rank: 1 }, prior, "2026-11-22").movement, "new");
  const gap = [day("2026-11-19", { comet: 2 })];
  assert.equal(classify({ title: "Comet", rank: 2 }, gap, "2026-11-22").movement, "returning");
  assert.equal(classify({ title: "Comet", rank: 2 }, gap, "2026-11-22").days_on, 1);
});

test("movement: a same-day re-run never compares against itself", () => {
  const dir = mkdtempSync(join(tmpdir(), "wp-mem-"));
  mkdirSync(join(dir, "wikipedia"));
  writeFileSync(join(dir, "wikipedia", "2026-11-22.json"), JSON.stringify({ items: [{ rank: 1, title: "X" }] }));
  const sources = { wikipedia: { items: [{ rank: 1, title: "X" }] } };
  annotateMovement(sources, dir, "2026-11-22");
  assert.equal(sources.wikipedia.items[0].movement, "new");
  rmSync(dir, { recursive: true, force: true });
});

test("numerals: GTA V and GTA VI are different, GTA 6 and GTA VI the same", () => {
  assert.ok(numeralsConflict(tokenize("Grand Theft Auto V Enhanced"), tokenize("Grand Theft Auto VI")));
  assert.ok(!numeralsConflict(tokenize("GTA 6 stream"), tokenize("GTA VI trailer")));
  assert.ok(!numeralsConflict(tokenize("49ers x vikings"), tokenize("49ers vs vikings")));
  const clusters = clusterItems({
    steam: { items: [{ rank: 1, title: "Grand Theft Auto V Enhanced" }] },
    wikipedia: { items: [{ rank: 1, title: "Grand Theft Auto VI" }] },
  });
  assert.equal(clusters.length, 0);
});

test("clusters are not named after a Polymarket question", () => {
  const clusters = clusterItems({
    polymarket: { items: [{ rank: 1, title: "Will Jensen Huang rejoin NVIDIA by November 30?" }] },
    hackernews: { items: [{ rank: 5, title: "Jensen Huang rejoin talks at NVIDIA" }] },
  });
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].name, "Jensen Huang rejoin talks at NVIDIA");
});

function snapshot(date, { clusters = [], wiki = [] } = {}) {
  return {
    generated_at: `${date}T06:15:00.000Z`,
    clusters,
    sources: { wikipedia: { items: wiki.map((title, i) => ({ rank: i + 1, title, url: `https://en.wikipedia.org/wiki/${i}` })) } },
  };
}

test("topics: a story persists across days, phases move, queue is capped and skips matchups", () => {
  const dir = mkdtempSync(join(tmpdir(), "wp-topics-"));
  const wiki = ["Riemann hypothesis", "Alpha", "Bravo", "Charlie", "Delta", "Echo", "warriors vs celtics"];
  let idx = updateTopics(snapshot("2026-11-20", { wiki }), dir, "2026-11-20");
  let r = idx.topics.find((t) => t.id === "riemann-hypothesis");
  assert.equal(r.phase, "new");
  assert.ok(idx.research_queue.length <= 4);

  idx = updateTopics(snapshot("2026-11-21", { wiki }), dir, "2026-11-21");
  r = idx.topics.find((t) => t.id === "riemann-hypothesis");
  assert.equal(r.phase, "holding");
  assert.equal(r.days_seen, 2);

  // A second feed picks it up: climbing.
  const cluster = { name: "Riemann hypothesis", sources: ["hackernews", "wikipedia"], score: 2,
    items: [{ source: "wikipedia", title: "Riemann hypothesis", url: "u", rank: 1 }, { source: "hackernews", title: "Riemann hypothesis proof", url: "h", rank: 1 }] };
  idx = updateTopics(snapshot("2026-11-22", { wiki, clusters: [cluster] }), dir, "2026-11-22");
  r = idx.topics.find((t) => t.id === "riemann-hypothesis");
  assert.equal(r.phase, "climbing");
  assert.deepEqual(r.sources_seen, ["hackernews", "wikipedia"]);

  // Same-day re-run replaces today's entry instead of stacking.
  idx = updateTopics(snapshot("2026-11-22", { wiki, clusters: [cluster] }), dir, "2026-11-22");
  const file = JSON.parse(readFileSync(join(dir, "riemann-hypothesis.json"), "utf8"));
  assert.equal(file.timeline.length, 3);
  const seen = file.timeline[2].items.map((i) => `${i.source}|${i.title}`);
  assert.equal(new Set(seen).size, seen.length, "no duplicate items in a day");

  // Unseen for two days: fading.
  idx = updateTopics(snapshot("2026-11-24", { wiki: ["Foxtrot"] }), dir, "2026-11-24");
  assert.equal(idx.topics.find((t) => t.id === "riemann-hypothesis").phase, "fading");
  rmSync(dir, { recursive: true, force: true });
});

test("topics: search-only game matchups are remembered but never queued", () => {
  const dir = mkdtempSync(join(tmpdir(), "wp-topics-"));
  const latest = { generated_at: "2026-11-22T06:00:00Z", clusters: [], sources: { "google-trends": { items: [{ rank: 1, title: "warriors vs celtics" }] } } };
  const idx = updateTopics(latest, dir, "2026-11-22");
  assert.ok(idx.topics.some((t) => t.id === "warriors-vs-celtics"));
  assert.ok(!idx.research_queue.includes("warriors-vs-celtics"));
  rmSync(dir, { recursive: true, force: true });
});

test("sameStory and slugify", () => {
  assert.ok(sameStory(tokenize("Riemann hypothesis"), { name: "Riemann hypothesis", aliases: ["Riemann hypothesis"] }));
  assert.ok(!sameStory(tokenize("Grand Theft Auto V"), { aliases: ["Grand Theft Auto VI"] }));
  // A bare alias with no numeral must not let a different sequel in.
  assert.ok(!sameStory(tokenize("Grand Theft Auto V Enhanced"), { name: "Grand Theft Auto VI", aliases: ["Grand Theft Auto VI", "Grand Theft Auto"] }));
  assert.equal(slugify("The Hunger Games: Sunrise on the Reaping"), "the-hunger-games-sunrise-on-the-reaping");
});

const good = {
  summary: "A proof of the Riemann hypothesis was posted and checked in Lean, and mathematicians are now reviewing it.",
  why_now: "The Lean verification went public on Friday and drew 938 points on Hacker News.",
  background: ["The hypothesis concerns where the zeros of the zeta function lie."],
  sources: [{ url: "https://example.com/a", title: "Proof posted", fetched_at: new Date().toISOString() }],
};

test("explainer: a clean draft passes", () => {
  assert.deepEqual(validateDraft(good), []);
});

test("explainer: refuses uncited, stale, dashed or emoji drafts", () => {
  assert.ok(validateDraft({ ...good, sources: [] }).some((e) => e.includes("sources")));
  const old = new Date(Date.now() - 3 * 864e5).toISOString();
  assert.ok(validateDraft({ ...good, sources: [{ ...good.sources[0], fetched_at: old }] }).some((e) => e.includes("not from this run")));
  assert.ok(validateDraft({ ...good, why_now: "It spread fast — everywhere." }).some((e) => e.includes("dash")));
  assert.ok(validateDraft({ ...good, why_now: "It spread fast \u{1F525}" }).some((e) => e.includes("emoji")));
  assert.ok(validateDraft({ ...good, summary: "short" }).some((e) => e.includes("summary")));
  // Ranges with an unspaced en dash are fine.
  assert.deepEqual(validateDraft({ ...good, why_now: "Searches rose 10–14 times overnight." }), []);
});

test("spreader: fresh stories lead, thin Polymarket pairs drop, strength is not pegged", () => {
  const latest = {
    generated_at: "2026-11-22T06:15:00Z",
    sources: { wikipedia: { items: [{ rank: 1, title: "GTA VI", views: 1 }] } },
    clusters: [
      { name: "GTA VI", sources: ["steam", "wikipedia"], score: 2, items: [{ source: "wikipedia", url: "w" }] },
      { name: "warriors vs celtics", sources: ["google-trends", "polymarket"], score: 1.4, items: [{ source: "google-trends", url: "g" }] },
      { name: "Riemann hypothesis", sources: ["hackernews", "wikipedia"], score: 1.1, items: [{ source: "hackernews", url: "h" }] },
    ],
  };
  const topics = { topics: [
    { id: "gta-vi", name: "GTA VI", aliases: ["GTA VI"], phase: "holding", days_seen: 6, summary: null },
    { id: "warriors-vs-celtics", name: "warriors vs celtics", aliases: ["warriors vs celtics"], phase: "new", days_seen: 1 },
    { id: "riemann-hypothesis", name: "Riemann hypothesis", aliases: ["Riemann hypothesis"], phase: "climbing", days_seen: 2, summary: "A proof was posted and is being checked." },
  ] };
  const out = generateSpreader(latest, topics);
  assert.deepEqual(out.throughlines.map((t) => t.title), ["Riemann hypothesis", "GTA VI", "warriors vs celtics"]);
  assert.equal(out.throughlines[0].gist, "A proof was posted and is being checked.");
  assert.equal(out.throughlines[0].explainer_url, "https://nnnsightnnn.github.io/web-pulse/topics.html#riemann-hypothesis");
  assert.match(out.throughlines[1].gist, /Day 6 on the feeds/);
  assert.ok(out.strength < 100 && out.strength >= 20);
  for (const t of out.throughlines) assert.ok(!t.gist.includes("—"));
});
