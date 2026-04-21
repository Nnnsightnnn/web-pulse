import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { clusterItems } from "./cluster.mjs"

function makeSource(name, items) {
  return {
    source: name,
    label: name,
    fetched_at: "2026-04-21T00:00:00Z",
    items: items.map((title, i) => ({
      rank: i + 1,
      title,
      url: `https://example.com/${encodeURIComponent(title)}`,
    })),
  }
}

describe("clusterItems", () => {
  it("clusters items across two sources with overlapping tokens", () => {
    const sources = {
      hackernews: makeSource("hackernews", ["John Ternus becomes Apple CEO"]),
      wikipedia: makeSource("wikipedia", ["John Ternus named new Apple CEO"]),
    }
    const clusters = clusterItems(sources)
    assert.equal(clusters.length, 1)
    assert.equal(clusters[0].sources.length, 2)
    assert.ok(clusters[0].sources.includes("hackernews"))
    assert.ok(clusters[0].sources.includes("wikipedia"))
  })

  it("does NOT cluster items within the same source", () => {
    const sources = {
      hackernews: makeSource("hackernews", [
        "Apple CEO transition announced",
        "Apple CEO news breaking today",
      ]),
    }
    const clusters = clusterItems(sources)
    assert.equal(clusters.length, 0)
  })

  it("clusters a transitive chain across three sources", () => {
    const sources = {
      hackernews: makeSource("hackernews", ["OpenAI GPT-5 model launch"]),
      reddit: makeSource("reddit", ["GPT-5 model benchmark results"]),
      wikipedia: makeSource("wikipedia", ["GPT-5 benchmark results analysis"]),
    }
    const clusters = clusterItems(sources)
    assert.equal(clusters.length, 1)
    assert.equal(clusters[0].sources.length, 3)
    assert.equal(clusters[0].items.length, 3)
  })

  it("does not cluster items with no token overlap", () => {
    const sources = {
      hackernews: makeSource("hackernews", ["Rust compiler optimization"]),
      reddit: makeSource("reddit", ["Best pizza recipe ever"]),
    }
    const clusters = clusterItems(sources)
    assert.equal(clusters.length, 0)
  })

  it("does not cluster items sharing only one token (below threshold)", () => {
    const sources = {
      hackernews: makeSource("hackernews", ["Kubernetes security patch"]),
      reddit: makeSource("reddit", ["Docker security vulnerability"]),
    }
    // only "security" overlaps — need >= 2 tokens
    const clusters = clusterItems(sources)
    assert.equal(clusters.length, 0)
  })

  it("filters out year-only tokens to avoid false clusters", () => {
    const sources = {
      wikipedia: makeSource("wikipedia", ["2026 Bulgarian parliamentary election"]),
      reddit: makeSource("reddit", ["2026 FIFA World Cup qualification"]),
    }
    // "2026" is stripped; remaining tokens don't overlap enough
    const clusters = clusterItems(sources)
    assert.equal(clusters.length, 0)
  })

  it("strips 'List of' prefix before tokenizing", () => {
    const sources = {
      wikipedia: makeSource("wikipedia", ["List of highest-grossing Indian films"]),
      reddit: makeSource("reddit", ["Best action movies streaming now"]),
    }
    const clusters = clusterItems(sources)
    assert.equal(clusters.length, 0)
  })

  it("returns clusters sorted by score descending", () => {
    const sources = {
      hackernews: makeSource("hackernews", [
        "SpaceX Starship launch success",       // rank 1
        "Minor Python library update released",  // rank 2
      ]),
      reddit: makeSource("reddit", [
        "SpaceX Starship launch was incredible", // rank 1
        "Python library update patch notes",     // rank 2
      ]),
    }
    const clusters = clusterItems(sources)
    assert.ok(clusters.length >= 1)
    // higher-ranked cluster should come first
    for (let i = 1; i < clusters.length; i++) {
      assert.ok(clusters[i - 1].score >= clusters[i].score)
    }
  })

  it("caps output at 25 clusters", () => {
    // Create 30 unique cross-source pairs
    const hnItems = []
    const redditItems = []
    for (let i = 0; i < 30; i++) {
      const topic = `unique topic alpha bravo ${i}`
      hnItems.push(`${topic} hackernews post`)
      redditItems.push(`${topic} reddit thread`)
    }
    const sources = {
      hackernews: makeSource("hackernews", hnItems),
      reddit: makeSource("reddit", redditItems),
    }
    const clusters = clusterItems(sources)
    assert.ok(clusters.length <= 25)
  })

  it("handles empty sources gracefully", () => {
    const sources = {
      hackernews: { source: "hackernews", fetched_at: "2026-04-21T00:00:00Z", error: "timeout", items: [] },
      reddit: makeSource("reddit", ["Something trending"]),
    }
    const clusters = clusterItems(sources)
    assert.equal(clusters.length, 0)
  })
})
