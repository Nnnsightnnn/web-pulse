// Wikipedia Pageviews — what the world was reading on English Wikipedia yesterday.
// API docs: https://wikimedia.org/api/rest_v1/#/Pageviews_data
//
// Notes:
// - "all-projects" is unreliable; en.wikipedia works consistently.
// - Pageview data lags ~1-2 days. We ask for two days ago to be safe.
// - Heavy filtering: Main_Page, Special:*, Wikipedia:*, etc. dominate raw results
//   and aren't what anyone means by "what people are reading."

const BORING = /^(Main_Page|Special:|Wikipedia:|File:|Category:|Portal:|Help:|Talk:|User:)/;

function dateString(daysAgo) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return { y, m, day, iso: `${y}-${m}-${day}` };
}

async function fetchForDate({ y, m, day }) {
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/${y}/${m}/${day}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "web-pulse/0.1 (kjautry@gmail.com)" },
  });
  if (!res.ok) throw new Error(`Wikipedia ${y}-${m}-${day}: HTTP ${res.status}`);
  const json = await res.json();
  return json.items?.[0]?.articles || [];
}

export default async function fetchWikipedia() {
  // Try yesterday, fall back one more day if data isn't ready yet.
  let raw, dataDate;
  for (const daysAgo of [1, 2, 3]) {
    const d = dateString(daysAgo);
    try {
      raw = await fetchForDate(d);
      dataDate = d.iso;
      break;
    } catch (err) {
      if (daysAgo === 3) throw err;
    }
  }

  const items = raw
    .filter((a) => !BORING.test(a.article))
    .slice(0, 25)
    .map((a, i) => ({
      rank: i + 1,
      title: a.article.replace(/_/g, " "),
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(a.article)}`,
      views: a.views,
    }));

  return {
    source: "wikipedia",
    label: "Wikipedia — most read yesterday",
    fetched_at: new Date().toISOString(),
    data_date: dataDate,
    items,
  };
}
