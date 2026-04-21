// Hacker News top stories.
// API docs: https://github.com/HackerNews/API
//
// topstories.json returns an ordered list of ~500 item IDs.
// We fetch the top 25, then hydrate each in parallel.

const TOP_URL = "https://hacker-news.firebaseio.com/v0/topstories.json";
const ITEM_URL = (id) => `https://hacker-news.firebaseio.com/v0/item/${id}.json`;

async function json(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "web-pulse/0.1" },
  });
  if (!res.ok) throw new Error(`HN ${url}: HTTP ${res.status}`);
  return res.json();
}

export default async function fetchHackerNews() {
  const ids = await json(TOP_URL);
  const topIds = ids.slice(0, 25);
  const items = await Promise.all(topIds.map((id) => json(ITEM_URL(id))));

  return {
    source: "hackernews",
    label: "Hacker News — top stories",
    fetched_at: new Date().toISOString(),
    items: items
      .filter((it) => it && it.type === "story")
      .map((it, i) => ({
        rank: i + 1,
        title: it.title,
        url: it.url || `https://news.ycombinator.com/item?id=${it.id}`,
        hn_url: `https://news.ycombinator.com/item?id=${it.id}`,
        score: it.score ?? 0,
        comments: it.descendants ?? 0,
        author: it.by,
      })),
  };
}
