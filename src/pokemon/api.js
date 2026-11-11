// ════════════════════════════════════════════════════════════════════════════
//  Pokémon TCG API client (api.pokemontcg.io).
//
//  This is the app's primary card database: every set, every card, real scans
//  and real TCGplayer/Cardmarket prices. It is fetched from the browser, so it
//  needs no server of our own.
//
//  Every call can fail — offline, rate limited, blocked by a network policy —
//  and callers are expected to fall back to the small built-in catalog in
//  catalog.js. Nothing here throws past its caller.
//
//  No API key is required for light use. Set VITE_POKEMONTCG_KEY to raise the
//  rate limit; it is sent as the X-Api-Key header.
// ════════════════════════════════════════════════════════════════════════════

const BASE = "https://api.pokemontcg.io/v2";
const KEY = import.meta.env?.VITE_POKEMONTCG_KEY;

const SETS_CACHE_KEY = "pkmn-sets-cache-v1";
const SETS_TTL_MS = 24 * 60 * 60 * 1000;

async function get(path, { timeout = 15000 } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: KEY ? { "X-Api-Key": KEY } : undefined,
      signal: ctl.signal,
    });
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    return await res.json();
  } catch (err) {
    if (err.name === "AbortError") throw new Error("the request timed out");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The market price for a card. TCGplayer reports several printings
 * (normal / holofoil / reverse); we take the highest, which is the printing
 * collectors usually mean when they name a card.
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
  for (const k of ["trendPrice", "averageSellPrice", "avg30", "avg7"]) {
    if (typeof cm?.[k] === "number" && cm[k] > 0) return cm[k];
  }
  return null;
}

/** Normalise an API card into the shape the rest of the app uses. */
export function mapCard(c) {
  const price = extractPrice(c);
  return {
    id: c.id,
    name: c.name,
    set: c.set?.id ?? "unknown",
    setName: c.set?.name ?? "Unknown set",
    setSeries: c.set?.series ?? "",
    num: c.number,
    rarity: c.rarity ?? "Unknown",
    type: c.types?.[0] ?? "Colorless",
    hp: Number(c.hp) || 0,
    year: Number((c.set?.releaseDate ?? "").slice(0, 4)) || 0,
    artist: c.artist ?? "",
    price: price ?? 0,
    live: price != null,
    priced: price != null,
    img: c.images?.small ?? null,
    imgLarge: c.images?.large ?? c.images?.small ?? null,
    remote: true,
  };
}

export function mapSet(s) {
  return {
    id: s.id,
    name: s.name,
    series: s.series ?? "Other",
    year: Number((s.releaseDate ?? "").slice(0, 4)) || 0,
    releaseDate: s.releaseDate ?? "",
    total: s.total ?? s.printedTotal ?? 0,
    printedTotal: s.printedTotal ?? s.total ?? 0,
    symbol: s.images?.symbol ?? null,
    logo: s.images?.logo ?? null,
    remote: true,
  };
}

/** Every set, newest first. Cached in localStorage for a day. */
export async function fetchSets({ force = false } = {}) {
  if (!force) {
    try {
      const raw = localStorage.getItem(SETS_CACHE_KEY);
      if (raw) {
        const { at, sets } = JSON.parse(raw);
        if (Array.isArray(sets) && sets.length && Date.now() - at < SETS_TTL_MS) return sets;
      }
    } catch {
      /* unreadable cache is not an error — just refetch */
    }
  }

  const data = await get("/sets?orderBy=-releaseDate&pageSize=250");
  const sets = (data?.data ?? []).map(mapSet);
  if (!sets.length) throw new Error("no sets returned");
  try {
    localStorage.setItem(SETS_CACHE_KEY, JSON.stringify({ at: Date.now(), sets }));
  } catch {
    /* storage full or blocked — the in-memory list is still fine */
  }
  return sets;
}

const CARD_FIELDS = "id,name,number,rarity,types,hp,artist,images,set,tcgplayer,cardmarket";

/** One page of a set's checklist, in card-number order. */
export async function fetchSetCards(setId, { page = 1, pageSize = 60 } = {}) {
  const data = await get(
    `/cards?q=${encodeURIComponent(`set.id:${setId}`)}` +
      `&orderBy=number&page=${page}&pageSize=${pageSize}&select=${CARD_FIELDS}`
  );
  return {
    cards: (data?.data ?? []).map(mapCard),
    page: data?.page ?? page,
    pageSize: data?.pageSize ?? pageSize,
    totalCount: data?.totalCount ?? 0,
  };
}

/**
 * Search the whole database. `text` matches card names; the optional filters
 * narrow by set, rarity or type using the API's Lucene-ish query syntax.
 */
export async function searchCards(text, { setId, rarity, type, page = 1, pageSize = 60 } = {}) {
  const clauses = [];
  const clean = (text ?? "").trim().replace(/["\\:]/g, "");
  if (clean) clauses.push(`name:"${clean}*"`);
  if (setId) clauses.push(`set.id:${setId}`);
  if (rarity) clauses.push(`rarity:"${rarity}"`);
  if (type) clauses.push(`types:${type}`);
  if (!clauses.length) clauses.push("supertype:Pokémon");

  const data = await get(
    `/cards?q=${encodeURIComponent(clauses.join(" "))}` +
      `&orderBy=-set.releaseDate,number&page=${page}&pageSize=${pageSize}&select=${CARD_FIELDS}`
  );
  return {
    cards: (data?.data ?? []).map(mapCard),
    page: data?.page ?? page,
    pageSize: data?.pageSize ?? pageSize,
    totalCount: data?.totalCount ?? 0,
  };
}

/** Refresh market prices for specific card ids, in chunks. */
export async function fetchPrices(ids, { chunkSize = 20 } = {}) {
  const out = {};
  const at = new Date().toISOString();
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const q = chunk.map((id) => `id:${id}`).join(" OR ");
    const data = await get(
      `/cards?q=${encodeURIComponent(q)}&pageSize=${chunkSize}&select=id,tcgplayer,cardmarket`
    );
    for (const card of data?.data ?? []) {
      const price = extractPrice(card);
      if (price != null) out[card.id] = { price: Math.round(price * 100) / 100, live: true, at };
    }
  }
  return out;
}

/** The full rarity list, so filters aren't limited to what's on screen. */
export async function fetchRarities() {
  const data = await get("/rarities");
  return (data?.data ?? []).filter(Boolean);
}
