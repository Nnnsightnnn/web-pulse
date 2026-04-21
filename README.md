# Web Pulse

A live dashboard of what the world is doing on the web, built from six public sources. Data is refreshed daily by a scheduled task running on Kenny's MacBook, which commits the updated `data/` directory back to this repo. GitHub Pages redeploys the static site automatically.

**Live site:** `https://nnnsightnnn.github.io/web-pulse/` (after GitHub Pages is enabled — see setup below).

## Sources

| Tile              | Source                                     | Notes                                                   |
|-------------------|--------------------------------------------|---------------------------------------------------------|
| Wikipedia         | `wikimedia.org` pageviews API              | Top-read English Wikipedia articles, ~1-day lag         |
| Hacker News       | `hacker-news.firebaseio.com` v0 API        | Top stories + scores + comment counts                   |
| Reddit            | `reddit.com/r/all/top.json?t=hour`         | Real-time cultural pulse                                |
| GitHub            | `github.com/trending` HTML scrape          | No official API; parses with `node-html-parser`         |
| Google Trends     | `trends.google.com/trending/rss` (×6 countries) | Aggregated across US/GB/IN/JP/BR/DE, multi-country terms rank higher |
| Cloudflare Radar  | `api.cloudflare.com/radar` (requires token) | Trending global domains — optional, add `CF_RADAR_TOKEN` to `.env` |

## Repo layout

```
web-pulse/
├── index.html              # Dashboard (static, no build step)
├── package.json            # node-html-parser only
├── scripts/
│   ├── fetch-all.mjs       # Orchestrator — runs all sources in parallel
│   └── sources/
│       ├── wikipedia.mjs
│       ├── hackernews.mjs
│       ├── reddit.mjs
│       ├── github-trending.mjs
│       ├── google-trends.mjs
│       └── cloudflare-radar.mjs
├── data/
│   ├── latest.json         # Current snapshot (dashboard reads this)
│   └── history/<source>/YYYY-MM-DD.json   # Daily snapshots (kept 30 days, used for sparklines)
└── .github/workflows/pages.yml   # Auto-deploys on every push to main
```

## First-time setup

```bash
# 1. Move the scaffolded project into your home directory.
mv /path/to/downloaded/web-pulse ~/web-pulse
cd ~/web-pulse

# 2. Install the single dependency.
npm install

# 3. Run the fetcher once, locally, to confirm everything works.
npm run fetch
# You should see: data/latest.json written + six history snapshots under data/history/.

# 4. Open the dashboard locally to eyeball it.
npm run serve
# Visit http://localhost:8080 — all tiles should render with real data.

# 5. Initialize the git repo and push to GitHub.
git init
git add .
git commit -m "Initial scaffold of web-pulse dashboard"
gh repo create web-pulse --public --source=. --push
# Or, if you prefer manual: create the repo on github.com, add remote, push.

# 6. Enable GitHub Pages.
# Go to the repo's Settings → Pages → "Build and deployment" → Source: GitHub Actions.
# The pages.yml workflow will deploy on the next push.

# 7. (Optional) Cloudflare Radar.
# Create a free read-only API token at
#   https://dash.cloudflare.com/profile/api-tokens   (template: "Radar - Read")
# Then:
echo "CF_RADAR_TOKEN=your_token_here" > .env
# The fetcher reads .env automatically on next run.
```

## How the daily refresh works

A scheduled task (`web-pulse-refresh`, registered via Claude's scheduled-tasks MCP) runs every morning and performs these steps on the MacBook:

1. `cd ~/web-pulse`
2. `npm run fetch` — hits all six APIs, writes `data/latest.json` and a new snapshot in `data/history/<source>/YYYY-MM-DD.json`
3. `git add data/ && git commit -m "Daily refresh: <date>"` (only if there are changes)
4. `git push origin main`
5. GitHub Pages redeploys within ~2 minutes

If the task fails (network blip, Reddit rate-limit, GitHub markup changed), the previous `latest.json` stays live — the dashboard never goes blank.

## Running ad-hoc

```bash
cd ~/web-pulse
npm run fetch   # refresh data/latest.json immediately
git add data/ && git commit -m "Manual refresh" && git push
```

## Troubleshooting

- **GitHub trending returns <10 items.** Expected. GitHub's trending page only surfaces ~8-10 daily repos.
- **Reddit returns HTTP 429.** They're rate-limiting unauth requests. Fix: create a script-type app at https://www.reddit.com/prefs/apps, switch `reddit.mjs` to OAuth.
- **Google Trends returns 404.** They moved the feed. Check `https://trends.google.com/trending/rss?geo=US` in a browser — if that redirects or 404s, the scraper needs to be rewritten.
- **Wikipedia returns "date not loaded yet".** The API lags 1-2 days. `wikipedia.mjs` already retries across 3 consecutive dates.

## Adding a tile

1. Create `scripts/sources/newthing.mjs` that exports `default async function() { return { source, label, fetched_at, items } }`.
2. Import and register it in `scripts/fetch-all.mjs`'s `SOURCES` array.
3. Add a renderer in `index.html`'s `renderers` object keyed by `source`.
4. Add the key to `ORDER` in `index.html`.
