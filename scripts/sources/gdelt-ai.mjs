// GDELT — AI & tech news, filtered.
// DOC 2.0 API: https://api.gdeltproject.org/api/v2/doc/doc
//
// GDELT indexes worldwide online news every 15 min. We narrow it to AI/tech
// coverage (English) rather than general geopolitics. Free, no API key.
//
// Reliability note: GDELT aggressively rate-limits ("one request every 5s")
// and replies with a PLAIN-TEXT 429 body, not JSON. We retry with backoff and,
// if it never yields JSON, surface an error block the orchestrator can render.

import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// data/history/gdelt-ai/<YYYY-MM-DD>.json — daily snapshots the orchestrator
// writes after every successful run. Used as a stale fallback below.
const HISTORY_DIR = join(__dirname, "..", "..", "data", "history", "gdelt-ai");

const LABEL = "GDELT — AI & tech news";

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

// AI/tech focus. Kept reasonably short — GDELT rejects overly complex queries.
const QUERY =
  '("artificial intelligence" OR "machine learning" OR "generative AI" OR ' +
  'OpenAI OR Anthropic OR "large language model" OR "neural network" OR ' +
  'semiconductor) sourcelang:english';

const ENDPOINT = "https://api.gdeltproject.org/api/v2/doc/doc";
// GDELT's limiter is unforgiving: once you trip it, a short 5–6s pause is NOT
// enough — follow-up requests keep returning 429 for a longer penalty window.
// So we (a) try more times and (b) back off exponentially with jitter so the
// retries actually clear the window instead of compounding the throttle.
// Sources run in parallel via Promise.allSettled, so a slow GDELT recovery only
// extends total wall-clock — it never blocks the other 16 sources.
const MAX_ATTEMPTS = 5;
const BACKOFF_BASE_MS = 10000; // first backoff ~10s, then ~18s, ~28s, ~40s (+jitter)
const BACKOFF_GROWTH = 1.6;
const BACKOFF_MAX_MS = 45000;

function buildUrl() {
  const params = new URLSearchParams({
    query: QUERY,
    mode: "ArtList",
    format: "json",
    maxrecords: "40",
    sort: "DateDesc",
    timespan: "2d",
  });
  return `${ENDPOINT}?${params.toString()}`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// GDELT matches on article BODY, so a keyword query alone pulls in stock-tip
// SEO farms and off-topic pieces that merely mention "AI" once. We require the
// TITLE itself to carry an AI/tech signal, and drop obvious market-spam.
const TITLE_SIGNAL =
  /\b(a\.?i\.?|artificial intelligence|machine learning|\bml\b|llm|gpt|chatgpt|openai|anthropic|claude|gemini|deepseek|chatbot|neural|deep learning|generative|transformer|data ?centers?|semiconductor|\bchips?\b|\bgpu\b|nvidia|\bmodel\b|agentic|automation|robot|quantum)\b/i;
const SPAM_SIGNAL =
  /\b(stocks? to (watch|buy)|best .* stocks?|price target|buy or sell|stock forecast|should you (buy|sell)|dividend|earnings (call|preview)|things to know before)\b/i;

function isRelevant(title) {
  return TITLE_SIGNAL.test(title) && !SPAM_SIGNAL.test(title);
}

// Parse GDELT's seendate ("20260607T120000Z") into an ISO string.
function parseSeendate(s) {
  const m = String(s || "").match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, se] = m;
  return `${y}-${mo}-${d}T${h}:${mi}:${se}Z`;
}

// Backoff for the Nth failed attempt (1-based): exponential growth, capped,
// with ±25% jitter so repeated daily runs don't fall into the same cadence.
function backoffFor(attempt) {
  const base = Math.min(BACKOFF_BASE_MS * BACKOFF_GROWTH ** (attempt - 1), BACKOFF_MAX_MS);
  const jitter = base * (0.75 + Math.random() * 0.5);
  return Math.round(jitter);
}

async function fetchArticles() {
  const url = buildUrl();
  let lastErr = "";

  // Small random pre-flight delay (0–3s) desyncs us from any other GDELT
  // traffic and from the previous run's timing, lowering the odds the very
  // first request lands inside an existing penalty window.
  await sleep(Math.round(Math.random() * 3000));

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "web-pulse/0.1 (+github.com/Nnnsightnnn/web-pulse)" },
        signal: AbortSignal.timeout(20000),
      });
      const text = await res.text();
      // GDELT returns 200 with JSON on success; 429 + plaintext when throttled.
      if (res.ok) {
        try {
          const json = JSON.parse(text);
          return json.articles || [];
        } catch {
          lastErr = `unexpected non-JSON body: ${text.slice(0, 120)}`;
        }
      } else {
        lastErr = `HTTP ${res.status}: ${text.slice(0, 120).trim()}`;
        // Honor an explicit Retry-After (seconds) if GDELT sends one; otherwise
        // fall through to our exponential schedule. 429 in particular needs a
        // longer cooldown than a generic error.
        if (res.status === 429 && attempt < MAX_ATTEMPTS) {
          const ra = Number(res.headers.get("retry-after"));
          if (Number.isFinite(ra) && ra > 0) {
            await sleep(Math.min(ra * 1000, BACKOFF_MAX_MS) + backoffFor(attempt) * 0.25);
            continue;
          }
        }
      }
    } catch (err) {
      // Network-level failure (DNS, reset, timeout) — fetch() itself rejected.
      lastErr = `network: ${err.message}`;
    }
    if (attempt < MAX_ATTEMPTS) await sleep(backoffFor(attempt));
  }
  throw new Error(`GDELT failed after ${MAX_ATTEMPTS} attempts — ${lastErr}`);
}

// Build the cleaned, deduped item list from GDELT's raw article array.
function buildItems(articles) {
  // Dedupe by normalized title, keeping the first (most recent) occurrence.
  const seen = new Set();
  const items = [];
  for (const a of articles) {
    const title = (a.title || "").trim();
    if (!title) continue;
    if (!isRelevant(title)) continue;
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      rank: items.length + 1,
      title,
      url: a.url,
      domain: a.domain || "",
      source_country: a.sourcecountry || "",
      seen_at: parseSeendate(a.seendate),
      image: a.socialimage || "",
    });
    if (items.length >= 25) break;
  }
  return items;
}

// Most recent good daily snapshot, used when the live fetch is throttled out.
// Returns { date, items } or null if no usable snapshot exists. We only ever
// snapshot real (non-stale) runs, so a snapshot's filename date is the true age
// of its data — it never silently chains stale-from-stale.
async function loadLatestSnapshot() {
  const files = (await readdir(HISTORY_DIR).catch(() => []))
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort(); // ascending → last entry is newest
  for (let i = files.length - 1; i >= 0; i--) {
    try {
      const snap = JSON.parse(await readFile(join(HISTORY_DIR, files[i]), "utf8"));
      if (Array.isArray(snap.items) && snap.items.length) {
        return { date: files[i].replace(/\.json$/, ""), items: snap.items };
      }
    } catch {
      // Corrupt/unreadable snapshot — fall through to an older one.
    }
  }
  return null;
}

export default async function fetchGdeltAI() {
  let articles;
  try {
    articles = await fetchArticles();
  } catch (err) {
    // Live fetch failed — almost always GDELT throttling. Rather than render an
    // empty AI-news tile, serve the most recent good snapshot, clearly marked
    // stale (the `(stale: <date>)` label suffix surfaces on every consumer that
    // shows a source's label). The orchestrator skips re-snapshotting `stale`
    // payloads, so we never falsely refresh the data's age.
    const fb = await loadLatestSnapshot();
    if (fb) {
      console.warn(
        `[gdelt-ai] LIVE FETCH FAILED — serving stale snapshot from ${fb.date} ` +
        `(${fb.items.length} items). Reason: ${err.message}`
      );
      return {
        source: "gdelt-ai",
        label: `${LABEL} (stale: ${fb.date})`,
        fetched_at: new Date().toISOString(),
        data_date: fb.date,
        stale: true,
        stale_reason: err.message,
        query: QUERY,
        items: fb.items,
      };
    }
    // No usable snapshot — preserve original behavior (orchestrator error block).
    throw err;
  }

  return {
    source: "gdelt-ai",
    label: LABEL,
    fetched_at: new Date().toISOString(),
    data_date: todayStamp(),
    query: QUERY,
    items: buildItems(articles),
  };
}
