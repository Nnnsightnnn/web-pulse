// Editorial desk — LLM-written daily copy with graceful degradation.
//
// Order of attempts:
//   1. Anthropic Messages API, if ANTHROPIC_API_KEY is set in .env
//   2. Local `claude` CLI (Claude Code subscription auth) — no key needed
//   3. Return null; the dashboard falls back to seeded template copy.
//
// Output is a flat object of plain-text fields. The dashboard escapes
// everything before rendering, so no HTML is allowed to pass through here.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const API_MODEL = process.env.EDITORIAL_MODEL_API || "claude-sonnet-5";
const CLI_MODEL = process.env.EDITORIAL_MODEL_CLI || "sonnet";
const CLI_CANDIDATES = [
  process.env.CLAUDE_BIN,
  "/opt/homebrew/bin/claude",
  "/usr/local/bin/claude",
  "claude",
].filter(Boolean);

// ---------- digest: compress latest.json into a small prompt payload ----------

function top(latest, key, n = 5) {
  const s = latest.sources?.[key];
  return s && !s.error && s.items ? s.items.slice(0, n) : [];
}

export function buildDigest(latest) {
  const L = [];
  const wiki = top(latest, "wikipedia");
  if (wiki.length) {
    const ratio =
      wiki[1] && wiki[1].views ? (wiki[0].views / wiki[1].views).toFixed(1) : "n/a";
    L.push(
      "WIKIPEDIA top-read: " +
        wiki.map((w) => `${w.title} (${w.views} views)`).join("; ") +
        ` | lead-over-second ratio: ${ratio}x`
    );
  }
  if (latest.clusters?.length) {
    L.push(
      "CROSS-SOURCE CLUSTERS (topics on multiple feeds at once): " +
        latest.clusters
          .slice(0, 3)
          .map((c) => `${c.name} [${c.sources.join(", ")}]`)
          .join("; ")
    );
  } else {
    L.push("CROSS-SOURCE CLUSTERS: none — no topic spans multiple feeds today.");
  }
  const feeds = [
    ["hackernews", "HACKER NEWS", (i) => `${i.title} (${i.score} pts)`],
    ["lemmy", "LEMMY", (i) => `${i.title} (${i.score})`],
    ["bluesky", "BLUESKY", (i) => i.title],
    ["mastodon-trending", "MASTODON", (i) => i.title],
    ["gdelt-ai", "AI NEWS WIRE", (i) => i.title],
    ["google-trends", "GOOGLE TRENDS", (i) => `${i.title} (${(i.geos || []).join("/")})`],
  ];
  for (const [key, label, fmt] of feeds) {
    const items = top(latest, key);
    if (items.length) L.push(`${label}: ` + items.map(fmt).join("; "));
  }
  const poly = top(latest, "polymarket");
  if (poly.length) {
    L.push(
      "POLYMARKET (24h volume): " +
        poly
          .map((p) => `${p.title} — ${(p.yes_price * 100).toFixed(0)}% yes, $${Math.round((p.volume_24h || 0) / 1e6)}M`)
          .join("; ")
    );
  }
  const usgsAll = latest.sources?.["usgs"]?.items || [];
  if (usgsAll.length) {
    const q = [...usgsAll].sort((a, b) => b.magnitude - a.magnitude)[0];
    L.push(`USGS: ${usgsAll.length} quakes M2.5+ in 24h; largest M${q.magnitude.toFixed(1)} near ${q.place}`);
  }
  const gh = top(latest, "github");
  if (gh.length) L.push("GITHUB TRENDING: " + gh.map((g) => `${g.title}${g.language ? ` (${g.language})` : ""}`).join("; "));
  const hf = top(latest, "huggingface", 3);
  if (hf.length) L.push("HUGGING FACE: " + hf.map((m) => `${m.title} (${m.downloads} downloads)`).join("; "));
  const ph = top(latest, "product-hunt", 3);
  if (ph.length) L.push("PRODUCT HUNT: " + ph.map((p) => `${p.title} (${p.votes_count || 0} votes)`).join("; "));
  const steam = top(latest, "steam");
  if (steam.length) L.push("STEAM (24h peak players): " + steam.map((g) => `${g.title} (${g.peak_24h})`).join("; "));
  const twitch = top(latest, "twitch", 3);
  if (twitch.length) L.push("TWITCH (live now): " + twitch.map((s) => `${s.title} (${s.viewers} viewers)`).join("; "));
  const yt = top(latest, "youtube");
  if (yt.length) L.push("YOUTUBE TRENDING: " + yt.map((v) => `${v.title} (${v.views} views)`).join("; "));
  const med = top(latest, "mediastack");
  if (med.length) L.push("NEWS WIRES: " + med.map((m) => `[${m.country || "?"}] ${m.title}`).join("; "));
  const cf = top(latest, "cloudflare-radar");
  if (cf.length) L.push("CLOUDFLARE TOP DOMAINS: " + cf.map((d) => d.title).join(", "));
  return L.join("\n");
}

// ---------- prompt ----------

function buildPrompt(latest) {
  const gen = new Date(latest.generated_at || Date.now());
  const weekday = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][gen.getUTCDay()];
  const dateStr = gen.toISOString().slice(0, 10);
  const digest = buildDigest(latest);

  return `You are the copy desk of Web Pulse, a one-page daily "print magazine" assembled
from a same-minute snapshot of ${Object.keys(latest.sources || {}).length} public web feeds. Today is ${weekday}, ${dateStr} (UTC).

House voice: dry, observational, a little wry; a broadsheet editor who finds the
internet's ordinary days quietly funny. Short declarative sentences. Concrete
nouns and real numbers over adjectives. British-broadsheet restraint, not
American-blog enthusiasm.

Hard rules:
- Write ONLY from the data below. Never invent events, causes, or numbers.
- If the data suggests WHY something is popular (a cluster, a matching news
  item), say so plainly. If it doesn't, admit ignorance in a fresh way — but
  only claim mystery when the data actually offers no explanation.
- If a topic appears in multiple feeds, that is the story of the day. Lead with it.
- Never use: "delve", "landscape", "tapestry", "testament", "vibrant",
  "resonate", "elevate", "in today's digital age", "it's worth noting",
  "isn't just X — it's Y", "charmingly", "we think".
- No exclamation marks. No rhetorical questions in body copy. At most one em
  dash per field.
- Do not reuse the same sentence skeleton across fields. Each field should
  read like it was written by a person who already wrote the others.
- Plain text only. No markdown, no HTML, no quotation marks around titles.

DATA
${digest}

Return STRICT JSON, no code fences, exactly these keys:
{
  "brief": "2-3 sentences, the day in brief, leads with the strongest cross-feed story or the single most striking number",
  "cover_sub": "one sentence, max 40 words, under the cover headline about the top Wikipedia article — situate it in today's snapshot",
  "wiki_epithet": "2-5 word epithet for the top Wikipedia subject, lowercase except proper nouns, e.g. 'the accidental protagonist' — but fitted to what the subject actually is",
  "wiki_deck": "one or two sentences, max 35 words, standfirst for the cover story about the top article",
  "wiki_paras": ["3 paragraphs, 40-60 words each, the cover story: what topped Wikipedia, how wide the margin was, what if anything explains it, what it says about the day"],
  "letter_headline": "editor's letter headline, max 9 words, no terminal period",
  "letter_paras": ["3 paragraphs, 45-65 words each: (1) what the snapshot found, with the day's actual character — quiet, loud, single-story, scattered; (2) one or two small details from unglamorous corners of the data; (3) why a same-hour daily snapshot is worth taking, freshly argued, not a slogan"],
  "discourse_deck": "one or two sentences, max 38 words, on what the four social feeds (HN, Lemmy, Bluesky, Mastodon) are each preoccupied with today — name the actual moods",
  "foreign_deck": "one sentence, max 30 words, on today's wire stories and what the world searched",
  "markets_deck": "one or two sentences, max 30 words, on the actual mix of today's top prediction markets",
  "watch_deck": "one or two sentences, max 35 words, on tonight's games and streams, using the real titles and numbers",
  "yt_headline": "3-7 words, what today's top YouTube video actually is — a trailer, a match, a song — no terminal period",
  "yt_note": "one or two sentences, max 35 words, on the trending list",
  "closing_note": "max 55 words, the back-page sign-off: what of today will be gone by tomorrow's edition, using today's actual subjects"
}`;
}

// ---------- transports ----------

async function viaApi(prompt) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: API_MODEL,
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = await res.json();
  return { text: body.content?.[0]?.text || "", model: API_MODEL };
}

async function viaCli(prompt) {
  const bin = CLI_CANDIDATES.find((b) => b === "claude" || existsSync(b));
  if (!bin) return null;
  // Prompt goes over stdin (closed immediately) — passing it as an argv while
  // stdin stays an open pipe makes the CLI wait on stdin and stall.
  const stdout = await new Promise((resolve, reject) => {
    const child = spawn(bin, ["-p", "--model", CLI_MODEL], {
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "", err = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("claude CLI timed out after 240s"));
    }, 240_000);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => { clearTimeout(timer); reject(e); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(`claude CLI exit ${code}: ${err.slice(0, 200)}`));
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });
  return { text: stdout, model: `claude-cli/${CLI_MODEL}` };
}

// ---------- validation ----------

const STRING_FIELDS = [
  "brief", "cover_sub", "wiki_epithet", "wiki_deck", "letter_headline",
  "discourse_deck", "foreign_deck", "markets_deck", "watch_deck",
  "yt_headline", "yt_note", "closing_note",
];
const ARRAY_FIELDS = ["wiki_paras", "letter_paras"];
const MAX_CHARS = { wiki_epithet: 60, yt_headline: 70, letter_headline: 90 };
const BANNED = /\b(delve|tapestry|testament to|in today's digital age|it's worth noting|charmingly)\b/i;

function clean(s) {
  return String(s).replace(/\s+/g, " ").trim();
}

function parseAndValidate(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no JSON object in response");
  const obj = JSON.parse(text.slice(start, end + 1));

  const out = {};
  for (const f of STRING_FIELDS) {
    const v = clean(obj[f] ?? "");
    if (!v) throw new Error(`missing field: ${f}`);
    if (BANNED.test(v)) throw new Error(`banned phrase in ${f}`);
    out[f] = MAX_CHARS[f] ? v.slice(0, MAX_CHARS[f]) : v;
  }
  for (const f of ARRAY_FIELDS) {
    const arr = obj[f];
    if (!Array.isArray(arr) || arr.length < 2) throw new Error(`bad array: ${f}`);
    out[f] = arr.slice(0, 4).map(clean).filter(Boolean);
    if (out[f].some((p) => BANNED.test(p))) throw new Error(`banned phrase in ${f}`);
  }
  return out;
}

// ---------- entry point ----------

export async function generateEditorial(latest) {
  const prompt = buildPrompt(latest);
  const transports = [
    ["api", viaApi],
    ["cli", viaCli],
  ];
  for (const [name, fn] of transports) {
    try {
      const res = await fn(prompt);
      if (!res) continue; // transport unavailable, try next
      const fields = parseAndValidate(res.text);
      return {
        ...fields,
        model: res.model,
        written_at: new Date().toISOString(),
      };
    } catch (err) {
      console.warn(`  ⊘ editorial via ${name} failed: ${err.message}`);
    }
  }
  return null;
}
