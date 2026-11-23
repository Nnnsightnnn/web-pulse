// explainer.mjs — the only door research prose comes through into the topic
// store. The web-pulse-refresh task researches each queued topic on the web,
// writes a draft JSON file, and hands it to this script, which refuses
// anything uncited, stale, or off the style rules before it touches the store.
//
//   node scripts/explainer.mjs todo                 research queue, as JSON
//   node scripts/explainer.mjs write <id> <draft>   validate and save a draft
//   node scripts/explainer.mjs skip <id> "<why>"    drop a topic from tonight's queue
//   node scripts/explainer.mjs check                validate every saved explainer
//
// Draft shape:
//   { "summary": "...", "why_now": "...", "background": ["..."],
//     "sources": [{ "url": "...", "title": "...", "fetched_at": "<ISO>" }] }

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTopics, writeIndex } from "./topics.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TOPICS_DIR = process.env.WEB_PULSE_TOPICS_DIR || join(ROOT, "data", "topics");
const FRESH_HOURS = 36; // a source must have been fetched this run, give or take
const HISTORY_KEEP = 3;

const DASH = /—|\s–\s/; // em dash, or an en dash used as a dash
const EMOJI = /\p{Extended_Pictographic}/u;

export function validateDraft(draft, now = new Date(), { checkFresh = true } = {}) {
  const errs = [];
  const str = (v) => typeof v === "string" && v.trim().length > 0;
  if (!draft || typeof draft !== "object") return ["draft is not an object"];
  if (!str(draft.summary)) errs.push("summary is required");
  else if (draft.summary.length < 40 || draft.summary.length > 320) errs.push("summary must be 40 to 320 characters");
  if (!str(draft.why_now)) errs.push("why_now is required");
  else if (draft.why_now.length > 400) errs.push("why_now must be at most 400 characters");
  const bg = draft.background ?? [];
  if (!Array.isArray(bg) || bg.length > 3 || bg.some((p) => !str(p) || p.length > 900))
    errs.push("background must be up to 3 non-empty paragraphs of at most 900 characters");
  const srcs = draft.sources;
  if (!Array.isArray(srcs) || srcs.length < 1 || srcs.length > 8) errs.push("sources must list 1 to 8 pages");
  else {
    srcs.forEach((s, i) => {
      if (!s || !/^https?:\/\//.test(s.url || "")) errs.push(`sources[${i}].url must be an http(s) URL`);
      if (!str(s?.title)) errs.push(`sources[${i}].title is required`);
      const t = Date.parse(s?.fetched_at || "");
      if (Number.isNaN(t)) errs.push(`sources[${i}].fetched_at must be an ISO time`);
      else if (checkFresh && (now - t > FRESH_HOURS * 36e5 || t - now > 36e5))
        errs.push(`sources[${i}].fetched_at is not from this run`);
    });
    if (new Set(srcs.map((s) => s?.url)).size !== srcs.length) errs.push("sources repeat a URL");
  }
  const prose = [draft.summary, draft.why_now, ...(Array.isArray(bg) ? bg : [])].filter(str).join("\n");
  if (DASH.test(prose)) errs.push("prose uses an em dash or a spaced en dash; use a comma, colon or period");
  if (EMOJI.test(prose)) errs.push("prose uses emoji");
  return errs;
}

function topicFile(id) {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`bad topic id: ${id}`);
  const f = join(TOPICS_DIR, `${id}.json`);
  if (!existsSync(f)) throw new Error(`no topic ${id} in ${TOPICS_DIR}`);
  return f;
}

function reindex() {
  const idx = JSON.parse(readFileSync(join(TOPICS_DIR, "index.json"), "utf8"));
  writeIndex(TOPICS_DIR, loadTopics(TOPICS_DIR), idx.date, idx.generated_at);
}

function todo() {
  const idx = JSON.parse(readFileSync(join(TOPICS_DIR, "index.json"), "utf8"));
  const out = idx.research_queue.map((id) => {
    const t = JSON.parse(readFileSync(topicFile(id), "utf8"));
    const last = t.timeline[t.timeline.length - 1];
    return {
      id,
      name: t.name,
      phase: t.phase,
      first_seen: t.first_seen,
      days_seen: t.days_seen,
      sources_today: last.sources,
      items_today: last.items,
      aliases: t.aliases,
      previous_summary: t.explainer?.summary || null,
    };
  });
  console.log(JSON.stringify(out, null, 2));
}

function write(id, draftPath) {
  const file = topicFile(id);
  const draft = JSON.parse(readFileSync(draftPath, "utf8"));
  const errs = validateDraft(draft);
  if (errs.length) {
    console.error(`REFUSED ${id}:\n  - ${errs.join("\n  - ")}`);
    process.exit(2);
  }
  const t = JSON.parse(readFileSync(file, "utf8"));
  if (t.explainer) t.explainer_history = [t.explainer, ...(t.explainer_history || [])].slice(0, HISTORY_KEEP);
  t.explainer = {
    summary: draft.summary.trim(),
    why_now: draft.why_now.trim(),
    background: (draft.background || []).map((p) => p.trim()),
    sources: draft.sources.map(({ url, title, fetched_at }) => ({ url, title: title.trim(), fetched_at })),
    researched_at: new Date().toISOString(),
    phase_at_research: t.phase,
    engine: "ai",
  };
  t.needs_research = false;
  delete t.research_skipped;
  writeFileSync(file, JSON.stringify(t, null, 2) + "\n");
  reindex();
  console.log(`OK ${id}: explainer saved (${t.explainer.sources.length} sources)`);
}

function skip(id, reason) {
  const file = topicFile(id);
  const t = JSON.parse(readFileSync(file, "utf8"));
  t.needs_research = false;
  t.research_skipped = { at: new Date().toISOString(), reason: String(reason || "no reason given").slice(0, 200) };
  writeFileSync(file, JSON.stringify(t, null, 2) + "\n");
  reindex();
  console.log(`OK ${id}: skipped`);
}

function check() {
  let bad = 0;
  for (const t of loadTopics(TOPICS_DIR)) {
    if (!t.explainer) continue;
    const errs = validateDraft(t.explainer, new Date(), { checkFresh: false });
    if (errs.length) {
      bad++;
      console.error(`${t.id}: ${errs.join("; ")}`);
    }
  }
  console.log(bad ? `FAIL ${bad} explainer(s)` : "OK all explainers valid");
  process.exit(bad ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, a, b] = process.argv.slice(2);
  try {
    if (cmd === "todo") todo();
    else if (cmd === "write" && a && b) write(a, b);
    else if (cmd === "skip" && a) skip(a, b);
    else if (cmd === "check") check();
    else {
      console.error("usage: explainer.mjs todo | write <id> <draft.json> | skip <id> <reason> | check");
      process.exit(64);
    }
  } catch (err) {
    console.error(`ERROR ${err.message}`);
    process.exit(1);
  }
}
