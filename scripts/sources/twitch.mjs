// Twitch — top 25 live streams by viewer count.
// Helix API requires a free OAuth client-credentials token. Register an app
// at https://dev.twitch.tv/console/apps, then put both halves in .env:
//   TWITCH_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxx
//   TWITCH_CLIENT_SECRET=yyyyyyyyyyyyyyyyyyyyyyyyy
//
// Without those we return a "configured: false" payload so the dashboard
// renders a setup hint, mirroring the Cloudflare Radar tile pattern.
//
// We exchange client credentials for a bearer token on every fetch (it's
// cheap and avoids needing to persist token expiry). Then a single call to
// /helix/streams?first=25 gives top live streams worldwide by viewers.

const TOKEN_URL = "https://id.twitch.tv/oauth2/token"
const STREAMS_URL = "https://api.twitch.tv/helix/streams?first=25"

async function getToken(clientId, clientSecret) {
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
  })
  const res = await fetch(`${TOKEN_URL}?${params}`, { method: "POST" })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Twitch token: HTTP ${res.status}${body ? ` — ${body.slice(0, 200)}` : ""}`)
  }
  const json = await res.json()
  if (!json.access_token) throw new Error("Twitch token: missing access_token")
  return json.access_token
}

export default async function fetchTwitch() {
  const CLIENT_ID = process.env.TWITCH_CLIENT_ID
  const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return {
      source: "twitch",
      label: "Twitch — top streams",
      fetched_at: new Date().toISOString(),
      configured: false,
      message:
        "Set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET in .env. Register a free app at https://dev.twitch.tv/console/apps (any redirect URL is fine — we use the client-credentials flow).",
      items: [],
    }
  }

  const token = await getToken(CLIENT_ID, CLIENT_SECRET)
  const res = await fetch(STREAMS_URL, {
    headers: {
      "Client-Id": CLIENT_ID,
      Authorization: `Bearer ${token}`,
      "User-Agent": "web-pulse/0.1",
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Twitch streams: HTTP ${res.status}${body ? ` — ${body.slice(0, 200)}` : ""}`)
  }
  const json = await res.json()
  const streams = json.data || []
  if (!streams.length) throw new Error("Twitch: empty streams list")

  return {
    source: "twitch",
    label: "Twitch — top streams (live)",
    fetched_at: new Date().toISOString(),
    configured: true,
    items: streams.map((s, i) => ({
      rank: i + 1,
      title: s.user_name || s.user_login,
      stream_title: s.title || "",
      url: `https://twitch.tv/${s.user_login}`,
      viewers: s.viewer_count ?? 0,
      game: s.game_name || null,
      language: s.language || null,
      started_at: s.started_at || null,
    })),
  }
}
