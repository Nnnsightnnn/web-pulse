// Lemmy (lemmy.world) — top posts of the day, federated Reddit-style pulse.
// Open API, no auth required. Docs: https://join-lemmy.org/api/
//
// Sort=TopDay matches the daily refresh cadence. Smaller volume than
// Reddit's r/all, but the same shape: communities, scores, comments.

const URL = "https://lemmy.world/api/v3/post/list?sort=TopDay&limit=25&type_=All";

export default async function fetchLemmy() {
  const res = await fetch(URL, {
    headers: { "User-Agent": "web-pulse/0.1 (https://github.com/nnnsightnnn/web-pulse)" },
  });
  if (!res.ok) throw new Error(`Lemmy: HTTP ${res.status}`);
  const json = await res.json();

  const items = (json.posts || []).map((p, i) => ({
    rank: i + 1,
    title: p.post.name,
    url: `https://lemmy.world/post/${p.post.id}`,
    external_url: p.post.url || null,
    community: p.community.name,
    score: p.counts.score,
    comments: p.counts.comments,
    author: p.creator.name,
  }));

  return {
    source: "lemmy",
    label: "Lemmy — top of the day",
    fetched_at: new Date().toISOString(),
    items,
  };
}
