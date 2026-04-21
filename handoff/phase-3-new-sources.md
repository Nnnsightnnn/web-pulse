# Phase 3 — New sources

> **Read `docs/handoff/README.md` first.**

## Goal

The current six sources skew heavily tech (HN, GitHub, Reddit r/all, Trends). Add 4–6 new sources that broaden cultural coverage: news, video, music, gaming, social, commerce. This turns "pulse of tech Twitter" into "pulse of the internet."

## What "done" looks like

Six new source modules, each following the existing `scripts/sources/*.mjs` pattern, registered in `fetch-all.mjs`, rendered in `index.html`, and surviving overnight scheduled runs without errors.

## The shortlist (pick 4–6, in priority order)

| # | Source        | Why                                                    | Access method                                    | Gotchas                                           |
|---|---------------|--------------------------------------------------------|--------------------------------------------------|---------------------------------------------------|
| 1 | **GDELT news** | Massive open news-event DB, global coverage          | `https://api.gdeltproject.org/api/v2/doc/doc?query=...&mode=TimelineSourceCountry&format=json` | Learning curve is real; start with `DocTone` mode |
| 2 | **YouTube trending** | Universal signal, not tech-skewed              | YouTube Data API v3 `videos.list?chart=mostPopular` (free quota, needs `YT_API_KEY`) | 10k units/day quota; 1 unit per call is fine     |
| 3 | **Spotify global top 50** | Music pulse                                  | Public chart RSS or Spotify Charts CSV (no auth) — prefer CSV if it's still there | Spotify has deprecated public charts before; verify the URL is live in your browser first |
| 4 | **Steam** | Gaming signal, huge audience                          | `https://steamspy.com/api.php?request=top100in2weeks` (free, no key) | SteamSpy is unofficial; has occasional downtime   |
| 5 | **Bluesky**   | Social pulse without Twitter's paywall               | AT Protocol `app.bsky.feed.getSuggestedFeeds` + `getFeed` (no auth for public feeds) | Use the official `@atproto/api` or raw fetch; raw is probably simpler |
| 6 | **Twitch**    | Live culture, games + IRL                             | Helix API `/helix/streams?first=25` (free API key) | Requires OAuth client credentials flow; non-trivial setup |
| 7 | **Product Hunt** | Maker/startup pulse                                 | `https://api.producthunt.com/v2/api/graphql` (free key) | GraphQL; build the query narrowly               |
| 8 | **Stack Overflow** | Dev problem-space signal                          | `https://api.stackexchange.com/2.3/questions?order=desc&sort=hot` (no key for low volume) | Rate limits are tight without a key              |

**Recommended picks:** GDELT, YouTube, Spotify, Steam, Bluesky, Stack Overflow. (Twitch is higher-friction due to OAuth; skip unless Kenny asks.)

Before committing to one, verify the endpoint returns real data today via `curl`. The web moves fast — what worked a year ago may be a 404 now.

## The pattern to follow

Every source module exports a default async function returning a payload shaped like this:

```js
// scripts/sources/<your-source>.mjs
export default async function fetch<Your>() {
  // optional: read API keys from process.env inside the function (env loader runs first)
  // const KEY = process.env.FOO_API_KEY;
  // if (!KEY) return { ...not-configured payload... };

  const res = await fetch("https://...");
  if (!res.ok) throw new Error(`<Your>: HTTP ${res.status}`);
  const data = await res.json();

  return {
    source: "<your-source>",           // unique slug, also used as key in sources object & history dir
    label: "<Your Source> — top 25",   // human-readable tile label
    fetched_at: new Date().toISOString(),
    items: (data.items || []).slice(0, 25).map((d, i) => ({
      rank: i + 1,
      title: d.something,
      url: d.url,
      // source-specific fields...
    })),
  };
}
```

## Tasks

### Task 3.1 — For each source you're adding

1. Write `scripts/sources/<name>.mjs` following the pattern.
2. Register it in `scripts/fetch-all.mjs`'s `SOURCES` array.
3. Add a renderer in `index.html`'s `renderers` object.
4. Add the key to `ORDER` in `index.html` (in a sensible position; probably group similar sources together: tech tiles first, then news, then culture).
5. Test locally: `npm run fetch` runs without an error from your source.
6. Eyeball the rendered tile.

### Task 3.2 — Handle API keys

For any source that requires an API key:

1. Add the env var name to the README's "First-time setup" table next to the relevant tile.
2. Gracefully degrade: if the key is missing, return a "not configured" payload like `cloudflare-radar.mjs` does (`configured: false`, helpful message). Do NOT throw.
3. Add the new var to `.env.example` (create it if it doesn't exist). Example content:
   ```
   # Optional. Get a free key at <url>. Leave blank to disable the <X> tile.
   YT_API_KEY=
   ```
4. Do NOT put your actual key in any committed file. `.env` stays gitignored.

### Task 3.3 — Update the README

Add new rows to the sources table, including notes about any API keys and their free-tier limits.

### Task 3.4 — Run fetch end-to-end

After all new sources are wired in:

```
npm install
npm run fetch
```

Expected: all old sources still work, new sources show their items in `data/latest.json`, tiles render.

## Specific implementation notes per recommended source

### GDELT
- Endpoint: `https://api.gdeltproject.org/api/v2/doc/doc?query=&mode=ArtList&format=json&timespan=24H&maxrecords=25`
- `query=` left blank fetches all articles; you'll want to narrow. Try `query=sourcelang:eng&sort=tonal&maxrecords=25`.
- Items have `title`, `url`, `domain`, `sourcecountry`, `seendate`.
- GDELT returns a LOT. Dedupe by `url` host before taking top 25 — otherwise you get 10 AP re-prints of the same story.

### YouTube
- Endpoint: `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=US&maxResults=25&key=<key>`
- Per-item: `title = items[i].snippet.title`, `url = https://www.youtube.com/watch?v=${items[i].id}`, `channel = items[i].snippet.channelTitle`, `views = items[i].statistics.viewCount`.
- Kenny needs to create the key at https://console.cloud.google.com/apis/credentials (YouTube Data API v3 enabled).

### Spotify
- Try `https://charts-static.spotify.com/charts/overview/global` — this may be gated. If gated, fall back to scraping `https://charts.spotify.com/charts/view/regional-global-daily/latest` which returns HTML; extract with `node-html-parser`.
- If neither works, drop Spotify and pick Stack Overflow instead.

### Steam (via SteamSpy)
- Endpoint: `https://steamspy.com/api.php?request=top100in2weeks`
- Returns a JSON object keyed by app ID. Iterate, sort by `players_2weeks` desc, take top 25.
- Per item: `title = v.name`, `url = https://store.steampowered.com/app/${k}`, `players = v.players_2weeks`.

### Bluesky
- Use `https://api.bsky.app/xrpc/app.bsky.feed.getFeed?feed=at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot&limit=25` (the "What's Hot" public feed).
- No auth required for public feeds.
- Per item: `title = firstLineOf(post.record.text)`, `url = https://bsky.app/profile/${post.author.handle}/post/${post.uri.split('/').pop()}`, `author = post.author.handle`, `likes = post.likeCount`.

### Stack Overflow
- Endpoint: `https://api.stackexchange.com/2.3/questions?order=desc&sort=hot&site=stackoverflow&pagesize=25`
- Returns gzipped JSON by default — `fetch()` handles this transparently.
- Per item: `title = item.title`, `url = item.link`, `score = item.score`, `answers = item.answer_count`, `tags = item.tags`.
- No key needed for ~300 req/day unauth; beyond that register an app and use a key.

## Non-goals

- Don't redesign the tile grid. New tiles just slot into the existing `auto-fill, minmax(360px, 1fr)` layout.
- Don't add a backend. Every source must be fetchable via simple HTTPS from a Node script.
- Don't scrape aggressively. If a source blocks us, drop it and move on rather than adding stealth.

## Acceptance criteria

- [ ] At least 4 new source modules committed under `scripts/sources/`.
- [ ] Each is registered in `fetch-all.mjs` and renders in `index.html`.
- [ ] `npm run fetch` completes cleanly for all sources (or gracefully degrades for unconfigured ones).
- [ ] README's sources table is updated.
- [ ] `.env.example` includes any new env vars.
- [ ] No secrets committed.
- [ ] Dashboard renders all old + new tiles without layout breakage.

## Gotchas

- Overnight rate limits. A scheduled task that runs at a fixed time can trip 24h rate limits — if your source has one (e.g. YouTube's 10k units/day), 1 call/day is safe.
- Timezone. The scheduled task runs at 7am local (Kenny is in the US). Some trending charts (e.g. Spotify) update once daily in UTC — so at 7am local you might get yesterday's chart. That's usually fine; note it in the tile label ("yesterday's top 50").
- Non-English content. Bluesky, YouTube, and GDELT return non-English items. Don't try to filter — surface them as-is. Variety is the point.
- Encoding. Some APIs return titles with HTML entities (`&amp;`, `&#39;`). Decode them in your source module, not in the renderer.

## How to hand off

Branch: `phase-3-sources`. Commit each new source in its own commit so it's easy to review or roll back individually. Include in your handoff summary: which sources you added, which you chose not to and why, and sample output for each.
