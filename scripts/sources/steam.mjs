// Steam — top games by player count via SteamSpy (unofficial, free, no key).
// SteamSpy returns a JSON object keyed by app ID; we sort by players_2weeks.

export default async function fetchSteam() {
  const res = await fetch("https://steamspy.com/api.php?request=top100in2weeks", {
    headers: { "User-Agent": "web-pulse/0.1" },
  })
  if (!res.ok) throw new Error(`Steam: HTTP ${res.status}`)
  const data = await res.json()

  const entries = Object.entries(data)
    .map(([appid, v]) => ({ appid, ...v }))
    .sort((a, b) => (b.players_2weeks || 0) - (a.players_2weeks || 0))
    .slice(0, 25)

  return {
    source: "steam",
    label: "Steam — top games",
    fetched_at: new Date().toISOString(),
    items: entries.map((g, i) => ({
      rank: i + 1,
      title: g.name,
      url: `https://store.steampowered.com/app/${g.appid}`,
      players: g.players_2weeks || 0,
      score_rank: g.score_rank || null,
    })),
  }
}
