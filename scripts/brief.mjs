// Deterministic narrative brief — no LLM, pure template.
// Generates 3-5 sentences summarizing the day's top cross-source clusters
// and highlights from diverse sources.

export function generateBrief(latest) {
  const { sources, clusters } = latest
  const date = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  })

  const sourceCount = Object.values(sources || {}).filter(
    (s) => !s.error && s.items?.length > 0
  ).length

  if (sourceCount === 0) {
    return "No standout stories today \u2014 check back in a few hours."
  }

  const parts = []

  if (clusters?.length > 0) {
    const top = clusters[0]
    parts.push(
      `Across ${sourceCount} sources on ${date}, the story of the day is ${top.name}, appearing in ${top.sources.join(", ")}.`
    )
    if (clusters.length > 1) {
      parts.push(`Also trending: ${clusters[1].name} (${clusters[1].sources.join(", ")}).`)
    }
  } else {
    parts.push(`Across ${sourceCount} sources on ${date}, no single topic dominated multiple sources.`)
  }

  const picks = [
    { key: "github", prefix: "In tech" },
    { key: "mediastack", prefix: "In news" },
    { key: "reddit", prefix: "On Reddit" },
    { key: "steam", prefix: "In gaming" },
    { key: "product-hunt", prefix: "In startups" },
  ]

  let added = 0
  for (const pick of picks) {
    if (added >= 2) break
    const src = sources?.[pick.key]
    if (src && !src.error && src.items?.[0]) {
      parts.push(`${pick.prefix}, ${src.items[0].title}.`)
      added++
    }
  }

  return parts.join(" ")
}
