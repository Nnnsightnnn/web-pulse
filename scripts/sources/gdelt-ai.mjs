// GDELT — AI & tech news, filtered.
// DOC 2.0 API: https://api.gdeltproject.org/api/v2/doc/doc
//
// GDELT indexes worldwide online news every 15 min. We narrow it to AI/tech
// coverage (English) rather than general geopolitics. Free, no API key.
//
// Reliability note: GDELT aggressively rate-limits ("one request every 5s")
// and replies with a PLAIN-TEXT 429 body, not JSON. We retry with backoff and,
// if it never yields JSON, surface an error block the orchestrator can render.

import { readdir, readFile, writeFile } from "node:fs/promises";
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
// GDELT's limiter is unforgiving and, critically, SELF-COMPOUNDING: once you
// trip it, every further request while throttled appears to RESET/extend the
// penalty window. Empirically the window outlasts a 30s wait, and a throttled
// IP gets a deliberate ~10s-delayed 429 on each hit. So pounding it with fast
// retries is counterproductive — it keeps the lockout alive.
//
// The strategy here is therefore "fewer, far-apart, patient" rather than "more,
// closer": a couple of attempts spaced long enough to let the penalty actually
// expire between tries. Sources run in parallel via Promise.allSettled, so a
// slow GDELT recovery only extends total wall-clock — it never blocks the
// other 16 sources.
//
// Wall-clock cap: this IP is chronically throttled, so a throttled run almost
// always ends up serving the stale snapshot regardless of how long we wait.
// The old 4-attempt / 45–101s schedule cost ~4.4 min of wall-clock per run for
// no practical gain. We now cap at 2 attempts with a single ~20s spacer, which
// still honors GDELT's "one request / 5s" ask while bounding worst-case to
// ~60s. The 30-min circuit-breaker cooldown below still short-circuits repeated
// runs entirely.
const MAX_ATTEMPTS = 2;
const BACKOFF_BASE_MS = 20000; // single spacer ~20s (+jitter) between the 2 tries
const BACKOFF_GROWTH = 1.5;
const BACKOFF_MAX_MS = 30000;

// Circuit-breaker: when a run is throttled out completely, we record a cooldown
// timestamp. Subsequent runs (manual re-runs, retries) within this window skip
// the live fetch entirely and serve the stale snapshot WITHOUT poking GDELT —
// which is what was keeping the penalty alive. A once-daily scheduled run is
// always well past this window, so it still attempts a fresh live fetch.
const COOLDOWN_MS = 30 * 60 * 1000; // 30 min
const COOLDOWN_FILE = join(HISTORY_DIR, ".cooldown.json");

function buildUrl() {
  const params = new URLSearchParams({
    query: QUERY,
    mode: "ArtList",
    format: "json",
    maxrecords: "25", // lighter "query weight" — GDELT throttles larger pulls harder
    sort: "DateDesc",
    timespan: "1d",
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

// Circuit-breaker persistence. Returns the epoch-ms timestamp until which we
// should NOT poke GDELT, or 0 if clear / unreadable.
async function cooldownUntil() {
  try {
    const { until } = JSON.parse(await readFile(COOLDOWN_FILE, "utf8"));
    return Number(until) || 0;
  } catch {
    return 0;
  }
}

async function setCooldown(untilMs) {
  try {
    await writeFile(
      COOLDOWN_FILE,
      JSON.stringify({ until: untilMs, set_at: new Date().toISOString() }, null, 2)
    );
  } catch {
    // Best-effort only — a missing cooldown file just means the next run retries.
  }
}

async function clearCooldown() {
  await writeFile(COOLDOWN_FILE, JSON.stringify({ until: 0 }, null, 2)).catch(() => {});
}

export default async function fetchGdeltAI() {
  let articles;

  // If a recent run was throttled out, don't poke GDELT again — that only keeps
  // its penalty window alive. Serve stale immediately instead.
  const cdUntil = await cooldownUntil();
  if (Date.now() < cdUntil) {
    const mins = Math.ceil((cdUntil - Date.now()) / 60000);
    const fb = await loadLatestSnapshot();
    if (fb) {
      console.warn(
        `[gdelt-ai] IN COOLDOWN (~${mins}m left) — skipping live fetch, ` +
        `serving stale snapshot from ${fb.date} (${fb.items.length} items).`
      );
      return {
        source: "gdelt-ai",
        label: `${LABEL} (stale: ${fb.date})`,
        fetched_at: new Date().toISOString(),
        data_date: fb.date,
        stale: true,
        stale_reason: `in cooldown (~${mins}m left after a recent throttle)`,
        query: QUERY,
        items: fb.items,
      };
    }
    // No snapshot to serve — fall through and try anyway.
  }

  try {
    articles = await fetchArticles();
    await clearCooldown(); // live fetch worked — reset any prior throttle state
  } catch (err) {
    // On a throttle, open the circuit so repeated runs stop hammering GDELT.
    if (/HTTP 429/.test(err.message)) {
      await setCooldown(Date.now() + COOLDOWN_MS);
    }
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
