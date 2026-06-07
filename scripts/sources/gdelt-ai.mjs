// GDELT — AI & tech news, filtered.
// DOC 2.0 API: https://api.gdeltproject.org/api/v2/doc/doc
//
// GDELT indexes worldwide online news every 15 min. We narrow it to AI/tech
// coverage (English) rather than general geopolitics. Free, no API key.
//
// Reliability note: GDELT aggressively rate-limits ("one request every 5s")
// and replies with a PLAIN-TEXT 429 body, not JSON. We retry with backoff and,
// if it never yields JSON, surface an error block the orchestrator can render.

// AI/tech focus. Kept reasonably short — GDELT rejects overly complex queries.
const QUERY =
  '("artificial intelligence" OR "machine learning" OR "generative AI" OR ' +
  'OpenAI OR Anthropic OR "large language model" OR "neural network" OR ' +
  'semiconductor) sourcelang:english';

const ENDPOINT = "https://api.gdeltproject.org/api/v2/doc/doc";
const MAX_ATTEMPTS = 3;
const BACKOFF_MS = 6000;

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

async function fetchArticles() {
  const url = buildUrl();
  let lastErr = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "web-pulse/0.1 (+github.com/Nnnsightnnn/web-pulse)" },
        signal: AbortSignal.timeout(15000),
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
      }
    } catch (err) {
      // Network-level failure (DNS, reset, timeout) — fetch() itself rejected.
      lastErr = `network: ${err.message}`;
    }
    if (attempt < MAX_ATTEMPTS) await sleep(BACKOFF_MS);
  }
  throw new Error(`GDELT failed after ${MAX_ATTEMPTS} attempts — ${lastErr}`);
}

export default async function fetchGdeltAI() {
  const articles = await fetchArticles();

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

  return {
    source: "gdelt-ai",
    label: "GDELT — AI & tech news",
    fetched_at: new Date().toISOString(),
    query: QUERY,
    items,
  };
}
