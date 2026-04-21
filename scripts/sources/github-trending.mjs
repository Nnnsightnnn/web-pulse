// GitHub Trending — scraped from github.com/trending because there's no official API.
// Parses the HTML with node-html-parser; selectors match the current page as of April 2026.
//
// If GitHub changes their markup, the fix is in the selector constants below.

import { parse } from "node-html-parser";

const URL = "https://github.com/trending?since=daily";

export default async function fetchGitHubTrending() {
  const res = await fetch(URL, {
    headers: { "User-Agent": "web-pulse/0.1" },
  });
  if (!res.ok) throw new Error(`GitHub trending: HTTP ${res.status}`);
  const html = await res.text();
  const root = parse(html);

  const rows = root.querySelectorAll("article.Box-row");
  const items = rows.slice(0, 25).map((row, i) => {
    const h2 = row.querySelector("h2.h3");
    const link = h2?.querySelector("a");
    const href = link?.getAttribute("href")?.trim() || "";
    const fullName = href.replace(/^\//, "");

    const description = row.querySelector("p")?.text?.trim() || "";
    const language = row.querySelector('[itemprop="programmingLanguage"]')?.text?.trim() || null;

    // "Stars today" is in a span next to a star icon near the bottom-right of the card.
    const starsTodayText = row.querySelectorAll("span.d-inline-block.float-sm-right")[0]?.text?.trim() || "";
    const starsTodayMatch = starsTodayText.match(/([\d,]+)\s+stars?\s+today/);
    const starsToday = starsTodayMatch ? parseInt(starsTodayMatch[1].replace(/,/g, ""), 10) : null;

    // Total stars and forks
    const statLinks = row.querySelectorAll('a.Link--muted');
    const parseNum = (el) => {
      const t = el?.text?.trim() || "";
      const n = parseInt(t.replace(/[^\d]/g, ""), 10);
      return Number.isFinite(n) ? n : null;
    };
    const stars = parseNum(statLinks[0]);
    const forks = parseNum(statLinks[1]);

    return {
      rank: i + 1,
      title: fullName,
      url: `https://github.com${href}`,
      description,
      language,
      stars_today: starsToday,
      stars,
      forks,
    };
  });

  return {
    source: "github",
    label: "GitHub — trending today",
    fetched_at: new Date().toISOString(),
    items,
  };
}
