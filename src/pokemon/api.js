// ════════════════════════════════════════════════════════════════════════════
//  Optional live data from the Pokémon TCG API (api.pokemontcg.io).
//
//  Everything here is best-effort: the app ships with a full sample catalog
//  and never depends on this succeeding. If the request fails — offline, rate
//  limited, blocked by a network policy — callers get a rejected promise and
//  the UI keeps the sample prices with an honest "sample data" label.
//
//  No API key is required for light use. To raise the rate limit, set
//  VITE_POKEMONTCG_KEY and it is sent as the X-Api-Key header.
// ════════════════════════════════════════════════════════════════════════════

const BASE = "https://api.pokemontcg.io/v2";
const KEY = import.meta.env?.VITE_POKEMONTCG_KEY;

function headers() {
  return KEY ? { "X-Api-Key": KEY } : undefined;
}

async function get(path, { timeout = 12000 } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(`${BASE}${path}`, { headers: headers(), signal: ctl.signal });
    if (!res.ok) throw new Error(`Pokémon TCG API returned ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Pull the most representative market price out of a card payload.
 * TCGplayer reports several printings (normal / holofoil / reverse); we take
 * the one with the highest market price, which is the printing collectors
 * usually mean when they name a card.
 */
export function extractPrice(apiCard) {
  const printings = apiCard?.tcgplayer?.prices;
  if (printings) {
    const candidates = Object.values(printings)
      .map((p) => p?.market ?? p?.mid ?? p?.directLow)
      .filter((n) => typeof n === "number" && n > 0);
    if (candidates.length) return Math.max(...candidates);
  }
  const cm = apiCard?.cardmarket?.prices;
  if (typeof cm?.trendPrice === "number" && cm.trendPrice > 0) return cm.trendPrice;
  if (typeof cm?.averageSellPrice === "number" && cm.averageSellPrice > 0) return cm.averageSellPrice;
  return null;
}

/**
 * Fetch live market prices for the given card ids.
 * Returns { cardId: { price, live: true, at } } for whatever came back.
 * Ids are queried in chunks so the query string stays a sane length.
 */
export async function fetchPrices(ids, { chunkSize = 20 } = {}) {
  const out = {};
  const at = new Date().toISOString();
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const q = chunk.map((id) => `id:${id}`).join(" OR ");
    const data = await get(
      `/cards?q=${encodeURIComponent(q)}&pageSize=${chunkSize}&select=id,name,tcgplayer,cardmarket`
    );
    for (const card of data?.data ?? []) {
      const price = extractPrice(card);
      if (price != null) out[card.id] = { price: Math.round(price * 100) / 100, live: true, at };
    }
  }
  return out;
}

/** Free-text card search against the live API, mapped to this app's shape. */
export async function searchCards(text, { pageSize = 24 } = {}) {
  const q = `name:"${text.replace(/"/g, "")}*"`;
  const data = await get(
    `/cards?q=${encodeURIComponent(q)}&pageSize=${pageSize}&orderBy=-set.releaseDate`
  );
  return (data?.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    set: c.set?.id ?? "unknown",
    setName: c.set?.name ?? "Unknown set",
    num: c.number,
    rarity: c.rarity ?? "Unknown",
    type: c.types?.[0] ?? "Colorless",
    hp: Number(c.hp) || 0,
    year: Number((c.set?.releaseDate ?? "").slice(0, 4)) || 0,
    price: extractPrice(c) ?? 0,
    live: extractPrice(c) != null,
    img: c.images?.small ?? null,
    remote: true,
  }));
}
