// Deterministic narrative brief — the fallback when the LLM copy desk is
// unavailable. No LLM, pure template, but seeded by day-of-year so the
// sentence shapes rotate instead of repeating verbatim every morning.

function dayOfYear(d) {
  return Math.floor((d - new Date(Date.UTC(d.getUTCFullYear(), 0, 0))) / 864e5);
}

// Deterministic pick: same day → same copy; different day → different shape.
function pick(seed, salt, arr) {
  return arr[(seed + salt) % arr.length];
}

export function generateBrief(latest) {
  const now = new Date(latest?.generated_at || Date.now());
  const seed = dayOfYear(now) + now.getUTCFullYear();
  const { sources, clusters } = latest;
  const date = now.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", timeZone: "UTC",
  });

  const live = Object.values(sources || {}).filter(
    (s) => !s.error && s.items?.length > 0
  ).length;

  if (live === 0) {
    return "Every feed came back empty this morning — check back in a few hours.";
  }

  const parts = [];

  if (clusters?.length > 0) {
    const top = clusters[0];
    const where = top.sources.join(", ");
    parts.push(pick(seed, 0, [
      `${top.name} is the one topic ${date}'s feeds agree on — it surfaced on ${where} at the same minute.`,
      `One story crossed feeds this ${date}: ${top.name}, live on ${where} simultaneously.`,
      `${date}'s snapshot has a throughline — ${top.name}, which turned up on ${where} at once.`,
    ]));
    if (clusters.length > 1) {
      parts.push(pick(seed, 1, [
        `Behind it, ${clusters[1].name} was working ${clusters[1].sources.join(" and ")}.`,
        `${clusters[1].name} made a quieter run across ${clusters[1].sources.join(" and ")}.`,
      ]));
    }
  } else {
    parts.push(pick(seed, 0, [
      `No topic managed to cross feeds this ${date} — ${live} sources, ${live} separate conversations.`,
      `The ${live} feeds spent ${date} ignoring each other; nothing charted twice.`,
      `A scattered ${date}: every feed ran its own story and none of them matched.`,
    ]));
  }

  const picks = [
    { key: "github", frames: ["Builders spent the day on {t}.", "{t} led GitHub trending."] },
    { key: "steam", frames: ["{t} owned the evening on Steam.", "On Steam, {t} drew the biggest crowd."] },
    { key: "product-hunt", frames: ["The launch of the day was {t}.", "{t} took Product Hunt."] },
    { key: "lemmy", frames: ["Lemmy's front page went to {t}.", "{t} topped Lemmy."] },
  ];

  let added = 0;
  for (const [i, p] of picks.entries()) {
    if (added >= 2) break;
    const src = sources?.[p.key];
    const title = src && !src.error && src.items?.[0]?.title;
    if (title) {
      parts.push(pick(seed, 2 + i, p.frames).replace("{t}", title));
      added++;
    }
  }

  return parts.join(" ");
}
