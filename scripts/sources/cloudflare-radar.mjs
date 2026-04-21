// Cloudflare Radar — top trending domains globally.
// Requires a free API token from https://dash.cloudflare.com/profile/api-tokens
// (use the "Radar - Read" template). Store it in .env as CF_RADAR_TOKEN.
//
// Without a token we return an empty result with a helpful note so the dashboard
// can render a "not configured yet" tile instead of blowing up.

const TOKEN = process.env.CF_RADAR_TOKEN;
const ENDPOINT = "https://api.cloudflare.com/client/v4/radar/ranking/top";

export default async function fetchCloudflareRadar() {
  if (!TOKEN) {
    return {
      source: "cloudflare-radar",
      label: "Cloudflare Radar — trending domains",
      fetched_at: new Date().toISOString(),
      configured: false,
      message: "Set CF_RADAR_TOKEN in .env to enable. Free token at https://dash.cloudflare.com/profile/api-tokens (Radar - Read template).",
      items: [],
    };
  }

  const params = new URLSearchParams({
    limit: "25",
    // "name": "TRENDING_RISING", // optional: highlight rising domains
  });
  const res = await fetch(`${ENDPOINT}?${params}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) throw new Error(`Cloudflare Radar: HTTP ${res.status}`);
  const json = await res.json();

  const raw = json.result?.top_0 || [];
  return {
    source: "cloudflare-radar",
    label: "Cloudflare Radar — top domains",
    fetched_at: new Date().toISOString(),
    configured: true,
    items: raw.slice(0, 25).map((d, i) => ({
      rank: d.rank ?? i + 1,
      title: d.domain,
      url: `https://${d.domain}`,
      category: d.categories?.[0]?.name || null,
    })),
  };
}
