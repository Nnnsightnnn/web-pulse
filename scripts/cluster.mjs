// Cross-source clustering — finds topics that appear in 2+ sources on the same day.
// Pure JS, no NLP deps. Uses token-set Jaccard similarity + union-find.

const SOURCE_WEIGHTS = {
  "wikipedia": 1, "hackernews": 1,
  "github": 1, "google-trends": 1, "cloudflare-radar": 1,
  "lemmy": 1, "stackoverflow": 1, "steam": 1,
  "youtube": 1, "bluesky": 1,
  "mastodon-trending": 1, "product-hunt": 1,
  // A Polymarket market on a game or an election pairs with Google Trends
  // every day; real, but thin, so it counts for less than a human-ranked feed.
  "polymarket": 0.4,
}

// Sources whose titles should only name a cluster when nothing else can.
const NAME_LAST = new Set(["polymarket"])

const STOPWORDS = new Set([
  "the", "be", "to", "of", "and", "in", "that", "have", "for", "not", "on",
  "with", "he", "as", "you", "do", "at", "this", "but", "his", "by", "from",
  "they", "we", "her", "she", "or", "an", "will", "my", "one", "all", "would",
  "there", "their", "what", "so", "up", "out", "if", "about", "who", "get",
  "which", "go", "me", "when", "make", "can", "like", "time", "no", "just",
  "him", "know", "take", "people", "into", "year", "your", "good", "some",
  "could", "them", "see", "other", "than", "then", "now", "look", "only",
  "come", "its", "over", "think", "also", "back", "after", "use", "two",
  "how", "our", "work", "first", "well", "way", "even", "new", "want",
  "because", "any", "these", "give", "day", "most", "us", "been", "has",
  "had", "are", "was", "were", "did", "does", "being", "made", "it", "is",
  "am", "been", "more", "very", "much", "own", "same", "such", "here",
  "through", "each", "where", "both", "few", "those", "may", "should",
  "still", "too", "while", "down", "off", "between", "never", "under",
  "last", "every", "another", "really", "thing",
  // domain-specific
  "list", "show", "video", "watch", "best", "top", "news", "world",
  "official", "full", "free", "today", "big", "old",
])

const DIGIT_ROMAN = { 2: "ii", 3: "iii", 4: "iv", 5: "v", 6: "vi", 7: "vii", 8: "viii", 9: "ix", 11: "xi", 12: "xii" }
// "x" is left out: in titles like "49ers x vikings" it means versus.
const ROMAN = /^(ii|iii|iv|v|vi|vii|viii|ix|xi|xii)$/

export function isNumeral(tok) {
  return ROMAN.test(tok) || (/^\d+$/.test(tok) && !/^\d{4}$/.test(tok))
}

// Both titles carry a sequel or edition number and the numbers differ:
// different things, however many other words they share.
export function numeralsConflict(a, b) {
  const na = [...a].filter(isNumeral), nb = [...b].filter(isNumeral)
  return na.length > 0 && nb.length > 0 && !na.some((t) => nb.includes(t))
}

export function tokenize(title) {
  let t = title
  // strip "List of" prefix
  t = t.replace(/^list\s+of\s+/i, "")
  // strip parenthetical suffixes like "(film)", "(TV series)"
  t = t.replace(/\s*\(.*?\)\s*$/, "")
  // strip HN prefixes
  t = t.replace(/^(Show|Ask|Tell)\s+HN:\s*/i, "")
  // strip common TLDs from domain names
  t = t.replace(/\.(com|org|net|io|dev|ai|app|gov|edu|co)$/i, "")
  // lowercase, replace non-alphanumeric with spaces, split
  const tokens = t.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
  const result = new Set()
  let count = 0
  for (let tok of tokens) {
    // Short tokens are noise, except numbers and Roman numerals, which are
    // what tell "Grand Theft Auto V" from "Grand Theft Auto VI".
    if (tok.length < 3 && !isNumeral(tok)) continue
    if (/^\d{4}$/.test(tok)) continue // drop year-only tokens
    tok = DIGIT_ROMAN[tok] || tok // "GTA 6" and "GTA VI" are the same number
    if (STOPWORDS.has(tok)) continue
    result.add(tok)
    if (++count >= 12) break // truncate long titles
  }
  return result
}

function itemUrl(item, source) {
  if (source === "hackernews") return item.hn_url || item.url
  if (source === "google-trends") return item.news_url || null
  return item.url || null
}

function shortHash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0
  }
  return (h >>> 0).toString(36).padStart(6, "0").slice(0, 6)
}

// Union-find with path compression
class UnionFind {
  constructor(n) {
    this.parent = Array.from({ length: n }, (_, i) => i)
    this.rank = new Array(n).fill(0)
  }
  find(x) {
    if (this.parent[x] !== x) this.parent[x] = this.find(this.parent[x])
    return this.parent[x]
  }
  union(a, b) {
    const ra = this.find(a), rb = this.find(b)
    if (ra === rb) return
    if (this.rank[ra] < this.rank[rb]) this.parent[ra] = rb
    else if (this.rank[ra] > this.rank[rb]) this.parent[rb] = ra
    else { this.parent[rb] = ra; this.rank[ra]++ }
  }
}

export function clusterItems(sources) {
  // Flatten all items with their token sets
  const flat = []
  for (const [source, data] of Object.entries(sources)) {
    if (data.error || !data.items) continue
    for (const item of data.items) {
      const tokens = tokenize(item.title)
      if (tokens.size === 0) continue
      flat.push({ source, item, tokens, idx: flat.length })
    }
  }

  if (flat.length === 0) return []

  const uf = new UnionFind(flat.length)

  // Pairwise compare across sources only
  for (let i = 0; i < flat.length; i++) {
    for (let j = i + 1; j < flat.length; j++) {
      if (flat[i].source === flat[j].source) continue
      const a = flat[i].tokens, b = flat[j].tokens

      // Quick check: intersection size
      let overlap = 0
      for (const tok of a) {
        if (b.has(tok)) overlap++
      }
      if (overlap < 2) continue
      if (numeralsConflict(a, b)) continue

      const unionSize = new Set([...a, ...b]).size
      const jaccard = overlap / unionSize
      if (jaccard >= 0.3) {
        uf.union(i, j)
      }
    }
  }

  // Group by connected component
  const groups = new Map()
  for (let i = 0; i < flat.length; i++) {
    const root = uf.find(i)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root).push(flat[i])
  }

  // Filter: keep only clusters spanning 2+ sources
  const clusters = []
  for (const members of groups.values()) {
    const uniqueSources = new Set(members.map(m => m.source))
    if (uniqueSources.size < 2) continue

    // Pick name: best rank, tiebreak shorter title. A Polymarket question
    // ("Will X happen by...?") makes a poor headline, so any other feed's
    // title wins the name when one is in the cluster.
    const sorted = [...members].sort((a, b) => {
      const pa = NAME_LAST.has(a.source) ? 1 : 0, pb = NAME_LAST.has(b.source) ? 1 : 0
      if (pa !== pb) return pa - pb
      if (a.item.rank !== b.item.rank) return a.item.rank - b.item.rank
      return a.item.title.length - b.item.title.length
    })
    const name = sorted[0].item.title

    const items = members.map(m => ({
      source: m.source,
      title: m.item.title,
      url: itemUrl(m.item, m.source),
      rank: m.item.rank,
      movement: m.item.movement,
      days_on: m.item.days_on,
    }))

    const score = items.reduce((sum, it) =>
      sum + (1 / it.rank) * (SOURCE_WEIGHTS[it.source] || 1), 0)

    clusters.push({
      id: shortHash(name.toLowerCase()),
      name,
      sources: [...uniqueSources].sort(),
      items,
      score,
    })
  }

  // Sort by score desc, return top 25
  clusters.sort((a, b) => b.score - a.score)
  return clusters.slice(0, 25)
}
