// Reddit r/all top in the last hour — real-time cultural pulse.
// Uses OAuth (script app, client_credentials grant) because Reddit blocks
// unauthenticated JSON requests from datacenter/residential IPs (HTTP 403).
//
// Setup (one-time):
//   1. https://www.reddit.com/prefs/apps → "create another app" → type: script
//   2. Add to .env:
//        REDDIT_CLIENT_ID=<the string under the app name>
//        REDDIT_CLIENT_SECRET=<the secret>

const TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
const TOP_URL = "https://oauth.reddit.com/r/all/top?t=hour&limit=25&raw_json=1";
const UA = "web-pulse/0.1 (https://github.com/nnnsightnnn/web-pulse)";

async function getToken(id, secret) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Authorization": "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": UA,
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Reddit token: HTTP ${res.status}`);
  const json = await res.json();
  if (!json.access_token) throw new Error("Reddit token: no access_token in response");
  return json.access_token;
}

export default async function fetchReddit() {
  const id = process.env.REDDIT_CLIENT_ID;
  const secret = process.env.REDDIT_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error(
      "Reddit: REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET not set in .env — create a script app at https://www.reddit.com/prefs/apps"
    );
  }

  const token = await getToken(id, secret);
  const res = await fetch(TOP_URL, {
    headers: { "Authorization": `Bearer ${token}`, "User-Agent": UA },
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
      subreddit: d.subreddit_name_prefixed,
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
