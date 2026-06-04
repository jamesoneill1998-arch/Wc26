// Secure proxy for API-Football.
// Your API key lives ONLY here (as an environment variable on Vercel) —
// it is never sent to the browser, so it can't be stolen from page source.
//
// It also caches responses at Vercel's edge so heavy traffic doesn't burn
// through your 100-requests/day free quota.

const WC_LEAGUE = 1;      // FIFA World Cup league id in API-Football
const WC_SEASON = 2026;

export default async function handler(req, res) {
  const KEY = process.env.API_FOOTBALL_KEY;

  // If no key is set yet, tell the app to use sample data (no error).
  if (!KEY) {
    res.setHeader("Cache-Control", "public, s-maxage=60");
    return res.status(200).json({ configured: false });
  }

  const { type, fixture } = req.query;

  let path;
  let cacheSeconds;
  switch (type) {
    case "fixtures":   // all WC matches + scores
      path = `/fixtures?league=${WC_LEAGUE}&season=${WC_SEASON}`;
      cacheSeconds = 1800;       // 30 min — schedule barely changes
      break;
    case "live":       // only in-play matches
      path = `/fixtures?league=${WC_LEAGUE}&season=${WC_SEASON}&live=all`;
      cacheSeconds = 60;         // refresh scores ~1/min
      break;
    case "standings":  // all 12 group tables
      path = `/standings?league=${WC_LEAGUE}&season=${WC_SEASON}`;
      cacheSeconds = 600;        // 10 min
      break;
    case "lineups":    // starting XI for one match
      path = `/fixtures/lineups?fixture=${fixture}`;
      cacheSeconds = 120;
      break;
    case "events":     // goals, cards, subs for one match
      path = `/fixtures/events?fixture=${fixture}`;
      cacheSeconds = 60;
      break;
    case "statistics": // shots, possession etc for one match
      path = `/fixtures/statistics?fixture=${fixture}`;
      cacheSeconds = 60;
      break;
    default:
      return res.status(400).json({ error: "unknown type" });
  }

  try {
    const r = await fetch(`https://v3.football.api-sports.io${path}`, {
      headers: { "x-apisports-key": KEY },
    });
    const data = await r.json();

    // Edge cache: repeated visitor requests are served from Vercel's CDN,
    // so we only actually call API-Football when the cache expires.
    res.setHeader(
      "Cache-Control",
      `public, s-maxage=${cacheSeconds}, stale-while-revalidate=86400`
    );
    res.setHeader("configured", "true");
    return res.status(200).json({ configured: true, ...data });
  } catch (e) {
    return res.status(502).json({ configured: true, error: "upstream error" });
  }
}
