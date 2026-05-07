// Polymarket — top 25 active markets by 24h trading volume.
// Public Gamma API, no auth required.
//
// Endpoint: https://gamma-api.polymarket.com/markets
// Sort param: order=volume24hr, ascending=false
//
// The most pulse-like field is the implied probability of "Yes" — that's
// the market's live consensus on whether the question will resolve true.
// outcomePrices is returned as a stringified JSON array, so we parse it.

const ENDPOINT =
  "https://gamma-api.polymarket.com/markets?limit=50&active=true&closed=false&order=volume24hr&ascending=false"

function parsePriceArray(s) {
  if (!s || typeof s !== "string") return []
  try {
    return JSON.parse(s).map(Number)
  } catch {
    return []
  }
}

function parseOutcomeArray(s) {
  if (!s || typeof s !== "string") return []
  try {
    return JSON.parse(s)
  } catch {
    return []
  }
}

export default async function fetchPolymarket() {
  const res = await fetch(ENDPOINT, {
    headers: { "User-Agent": "web-pulse/0.1", Accept: "application/json" },
  })
  if (!res.ok) throw new Error(`Polymarket: HTTP ${res.status}`)
  const all = await res.json()
  if (!Array.isArray(all) || !all.length) {
    throw new Error("Polymarket: empty markets list")
  }

  // Some entries have null volume24hr — filter them out so we don't ship
  // stale-looking rows. Also de-dupe near-identical group items: Polymarket
  // sometimes returns 5 variants of the same parent question.
  const seen = new Set()
  const filtered = all
    .filter((m) => typeof m.volume24hr === "number" && m.volume24hr > 0)
    .filter((m) => {
      const key = m.events?.[0]?.id || m.id
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 25)

  return {
    source: "polymarket",
    label: "Polymarket — top 24h volume",
    fetched_at: new Date().toISOString(),
    items: filtered.map((m, i) => {
      const outcomes = parseOutcomeArray(m.outcomes)
      const prices = parsePriceArray(m.outcomePrices)
      // For 2-outcome (Yes/No) markets, Yes is conventionally outcome[0].
      const yesIdx = outcomes.findIndex((o) => /^yes$/i.test(o))
      const yesPrice = yesIdx >= 0 ? prices[yesIdx] : prices[0] ?? null
      // For multi-outcome markets, surface the leading outcome.
      let leader = null
      if (prices.length && outcomes.length === prices.length) {
        const maxIdx = prices.indexOf(Math.max(...prices))
        leader = { name: outcomes[maxIdx], price: prices[maxIdx] }
      }
      return {
        rank: i + 1,
        title: m.question,
        url: `https://polymarket.com/event/${m.events?.[0]?.slug || m.slug}`,
        volume_24h: m.volume24hr,
        volume_total: m.volumeNum ?? Number(m.volume) ?? 0,
        liquidity: m.liquidityNum ?? Number(m.liquidity) ?? 0,
        yes_price: typeof yesPrice === "number" ? yesPrice : null,
        leader, // {name, price} for non-binary markets, else null when binary
        end_date: m.endDate || null,
        outcomes,
      }
    }),
  }
}
