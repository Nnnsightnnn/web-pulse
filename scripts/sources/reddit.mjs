// Reddit r/all top in the last hour — real-time cultural pulse.
// Public JSON endpoint; tolerant as long as we send a real User-Agent.
//
// Note: Reddit has been tightening unauth access. If this starts 429-ing,
// the fix is to create a script-type Reddit app and switch to OAuth.

const URL_HOUR = "https://www.reddit.com/r/all/top.json?t=hour&limit=25";

export default async function fetchReddit() {
  const res = await fetch(URL_HOUR, {
    headers: { "User-Agent": "web-pulse/0.1 (https://github.com/nnnsightnnn/web-pulse)" },
  });
  if (!res.ok) throw new Error(`Reddit: HTTP ${res.status}`);
  const json = await res.json();

  const items = (json.data?.children || []).map((child, i) => {
    const d = child.data;
    return {
      rank: i + 1,
      title: d.title,
      url: `https://reddit.com${d.permalink}`,
      external_url: d.url_overridden_by_dest || null,
      subreddit: d.subreddit_name_prefixed, // e.g. "r/NatureIsFuckingLit"
      score: d.score,
      comments: d.num_comments,
      author: d.author,
    };
  });

  return {
    source: "reddit",
    label: "Reddit — r/all, past hour",
    fetched_at: new Date().toISOString(),
    items,
  };
}
