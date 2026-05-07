// USGS — earthquakes in the last 24 hours, M2.5+, sorted by significance.
// Public GeoJSON feed, no auth.
//
// Endpoint: https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson
//
// `sig` is USGS's own significance score — a composite of magnitude, "did
// you feel it" reports, PAGER impact estimate, and tsunami flag. Sorting
// by sig surfaces big-deal events even when the raw magnitude is moderate
// (e.g. a M4 in a populated area beats a M5 in the deep ocean).

const ENDPOINT =
  "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson"

export default async function fetchUSGS() {
  const res = await fetch(ENDPOINT, {
    headers: { "User-Agent": "web-pulse/0.1", Accept: "application/geo+json" },
  })
  if (!res.ok) throw new Error(`USGS: HTTP ${res.status}`)
  const json = await res.json()
  const features = json.features || []

  // Sort by significance descending, then by magnitude as tiebreaker.
  features.sort((a, b) => {
    const sa = a.properties?.sig ?? 0
    const sb = b.properties?.sig ?? 0
    if (sb !== sa) return sb - sa
    return (b.properties?.mag ?? 0) - (a.properties?.mag ?? 0)
  })

  return {
    source: "usgs",
    label: "USGS — earthquakes (24h, M2.5+)",
    fetched_at: new Date().toISOString(),
    items: features.slice(0, 25).map((f, i) => {
      const p = f.properties || {}
      const [lon, lat, depthKm] = f.geometry?.coordinates || []
      return {
        rank: i + 1,
        title: p.place || "Unknown location",
        url: p.url,
        magnitude: typeof p.mag === "number" ? Math.round(p.mag * 10) / 10 : null,
        place: p.place || null,
        time: p.time || null, // unix ms
        sig: p.sig ?? 0,
        felt: p.felt ?? 0, // count of "did you feel it" reports
        tsunami: p.tsunami === 1,
        depth_km:
          typeof depthKm === "number" ? Math.round(depthKm * 10) / 10 : null,
        lat: typeof lat === "number" ? lat : null,
        lon: typeof lon === "number" ? lon : null,
      }
    }),
  }
}
