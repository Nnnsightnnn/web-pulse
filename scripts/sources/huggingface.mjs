// Hugging Face — top 25 trending models by trendingScore.
// Public API, no auth required.
//
// Endpoint: https://huggingface.co/api/models?sort=trendingScore&direction=-1
//
// Each item carries downloads (24h), likes, trendingScore, pipeline_tag,
// and lastModified — plenty of signal for the dashboard. Day-over-day rank
// movement comes for free from the dashboard's history-based annotate().

const ENDPOINT =
  "https://huggingface.co/api/models?sort=trendingScore&direction=-1&limit=25&full=false"

export default async function fetchHuggingFace() {
  const res = await fetch(ENDPOINT, {
    headers: { "User-Agent": "web-pulse/0.1", Accept: "application/json" },
  })
  if (!res.ok) throw new Error(`Hugging Face: HTTP ${res.status}`)
  const data = await res.json()
  if (!Array.isArray(data) || !data.length) {
    throw new Error("Hugging Face: empty model list")
  }

  return {
    source: "huggingface",
    label: "Hugging Face — trending models",
    fetched_at: new Date().toISOString(),
    items: data.slice(0, 25).map((m, i) => ({
      rank: i + 1,
      title: m.id, // e.g. "deepseek-ai/DeepSeek-V4-Pro"
      url: `https://huggingface.co/${m.id}`,
      author: m.author || (m.id?.includes("/") ? m.id.split("/")[0] : null),
      downloads: m.downloads ?? 0,
      likes: m.likes ?? 0,
      trending_score: m.trendingScore ?? null,
      pipeline_tag: m.pipeline_tag || null, // text-generation, image-to-text, ...
      last_modified: m.lastModified || null,
    })),
  }
}
