// ════════════════════════════════════════════════════════════════════════════
//  Built-in card catalog.
//
//  Prices here are SAMPLE guide prices (near-mint, raw, USD) shipped with the
//  app so it works with zero network. They are illustrative, not live market
//  data — the Market view can pull real prices from the Pokémon TCG API
//  (see api.js) and will label them "live" once it does.
//
//  Card art is loaded from images.pokemontcg.io using the standard
//  `{setId}/{number}.png` pattern; anything that fails to load falls back to
//  the CSS card face in components.jsx, so the UI never shows a broken image.
// ════════════════════════════════════════════════════════════════════════════

export const SETS = {
  base1:      { name: "Base Set",        series: "Original",        year: 1999, printedTotal: 102, code: "BS"  },
  base2:      { name: "Jungle",          series: "Original",        year: 1999, printedTotal: 64,  code: "JU"  },
  base3:      { name: "Fossil",          series: "Original",        year: 1999, printedTotal: 62,  code: "FO"  },
  base5:      { name: "Team Rocket",     series: "Original",        year: 2000, printedTotal: 83,  code: "TR"  },
  neo1:       { name: "Neo Genesis",     series: "Neo",             year: 2000, printedTotal: 111, code: "N1"  },
  neo4:       { name: "Neo Destiny",     series: "Neo",             year: 2002, printedTotal: 105, code: "N4"  },
  xy12:       { name: "Evolutions",      series: "XY",              year: 2016, printedTotal: 108, code: "EVO" },
  swsh4:      { name: "Vivid Voltage",   series: "Sword & Shield",  year: 2020, printedTotal: 185, code: "VIV" },
  swsh12pt5:  { name: "Crown Zenith",    series: "Sword & Shield",  year: 2023, printedTotal: 159, code: "CRZ" },
  sv2:        { name: "Paldea Evolved",  series: "Scarlet & Violet", year: 2023, printedTotal: 193, code: "PAL" },
  sv3pt5:     { name: "151",             series: "Scarlet & Violet", year: 2023, printedTotal: 165, code: "MEW" },
};

// Rarity ladder — also drives pack-pull odds and filter ordering.
export const RARITIES = [
  "Common",
  "Uncommon",
  "Rare",
  "Holo Rare",
  "Double Rare",
  "Illustration Rare",
  "Special Illustration Rare",
  "Secret Rare",
];

export const TYPES = ["Grass", "Fire", "Water", "Lightning", "Psychic", "Fighting", "Colorless", "Darkness"];

// Energy glyph + accent used by the fallback card face.
export const TYPE_META = {
  Grass:     { glyph: "🍃", tint: "#1baf7a" },
  Fire:      { glyph: "🔥", tint: "#eb6834" },
  Water:     { glyph: "💧", tint: "#2a78d6" },
  Lightning: { glyph: "⚡", tint: "#eda100" },
  Psychic:   { glyph: "🔮", tint: "#9085e9" },
  Fighting:  { glyph: "✊", tint: "#c1642a" },
  Colorless: { glyph: "★", tint: "#c9c6b8" },
  Darkness:  { glyph: "🌑", tint: "#4a4a52" },
};

// id, name, set, num, rarity, type, hp, price (sample NM raw, USD)
const RAW = [
  // ── Base Set (1999) ──────────────────────────────────────────────────────
  ["base1",  4, "Charizard",   "Holo Rare", "Fire",      120, 420],
  ["base1",  2, "Blastoise",   "Holo Rare", "Water",     100, 260],
  ["base1", 15, "Venusaur",    "Holo Rare", "Grass",     100, 180],
  ["base1", 10, "Mewtwo",      "Holo Rare", "Psychic",    60,  70],
  ["base1",  1, "Alakazam",    "Holo Rare", "Psychic",    80,  60],
  ["base1", 14, "Raichu",      "Holo Rare", "Lightning",  80,  58],
  ["base1", 16, "Zapdos",      "Holo Rare", "Lightning",  90,  55],
  ["base1",  6, "Gyarados",    "Holo Rare", "Water",     100,  52],
  ["base1",  3, "Chansey",     "Holo Rare", "Colorless", 120,  50],
  ["base1", 12, "Ninetales",   "Holo Rare", "Fire",       80,  48],
  ["base1", 11, "Nidoking",    "Holo Rare", "Grass",      90,  46],
  ["base1",  5, "Clefairy",    "Holo Rare", "Colorless",  40,  44],
  ["base1",  7, "Hitmonchan",  "Holo Rare", "Fighting",   70,  38],
  ["base1", 13, "Poliwrath",   "Holo Rare", "Water",      90,  36],
  ["base1",  9, "Magneton",    "Holo Rare", "Lightning",  60,  32],
  ["base1",  8, "Machamp",     "Holo Rare", "Fighting",  100,  22],
  ["base1", 58, "Pikachu",     "Common",    "Lightning",  40,  16],
  ["base1", 46, "Charmander",  "Common",    "Fire",       50,   9],
  ["base1", 63, "Squirtle",    "Common",    "Water",      40,   7],
  ["base1", 44, "Bulbasaur",   "Common",    "Grass",      40,   8],

  // ── Jungle (1999) ────────────────────────────────────────────────────────
  ["base2", 10, "Snorlax",     "Holo Rare", "Colorless",  90,  45],
  ["base2", 11, "Vaporeon",    "Holo Rare", "Water",      80,  42],
  ["base2",  3, "Flareon",     "Holo Rare", "Fire",       70,  40],
  ["base2",  4, "Jolteon",     "Holo Rare", "Lightning",  70,  36],
  ["base2",  1, "Clefable",    "Holo Rare", "Colorless",  70,  28],
  ["base2",  5, "Kangaskhan",  "Holo Rare", "Colorless",  90,  26],
  ["base2", 14, "Vileplume",   "Holo Rare", "Grass",      80,  24],
  ["base2",  6, "Mr. Mime",    "Holo Rare", "Psychic",    40,  22],
  ["base2",  2, "Electrode",   "Holo Rare", "Lightning",  80,  18],

  // ── Fossil (1999) ────────────────────────────────────────────────────────
  ["base3",  5, "Gengar",      "Holo Rare", "Psychic",    80,  85],
  ["base3",  4, "Dragonite",   "Holo Rare", "Colorless", 100,  55],
  ["base3",  2, "Articuno",    "Holo Rare", "Water",      70,  45],
  ["base3", 15, "Zapdos",      "Holo Rare", "Lightning",  80,  38],
  ["base3", 10, "Lapras",      "Holo Rare", "Water",      80,  34],
  ["base3", 12, "Moltres",     "Holo Rare", "Fire",       70,  32],
  ["base3",  1, "Aerodactyl",  "Holo Rare", "Fighting",   60,  28],

  // ── Team Rocket (2000) ───────────────────────────────────────────────────
  ["base5",  4, "Dark Charizard", "Holo Rare", "Fire",     80, 110],
  ["base5",  3, "Dark Blastoise", "Holo Rare", "Water",    70,  34],
  ["base5",  1, "Dark Alakazam",  "Holo Rare", "Psychic",  60,  24],

  // ── Neo (2000–2002) ──────────────────────────────────────────────────────
  ["neo1",   9, "Lugia",       "Holo Rare", "Colorless",  90, 320],
  ["neo1",  17, "Typhlosion",  "Holo Rare", "Fire",      100,  58],
  ["neo1",   5, "Feraligatr",  "Holo Rare", "Water",     100,  40],
  ["neo1",  10, "Meganium",    "Holo Rare", "Grass",     100,  34],
  ["neo4", 107, "Shining Charizard", "Secret Rare", "Fire", 100, 850],

  // ── Evolutions (2016) ────────────────────────────────────────────────────
  ["xy12",  11, "Charizard",   "Holo Rare", "Fire",      150,  95],
  ["xy12",   2, "Blastoise",   "Holo Rare", "Water",     140,  26],
  ["xy12",   1, "Venusaur",    "Holo Rare", "Grass",     140,  22],
  ["xy12",  51, "Mewtwo",      "Holo Rare", "Psychic",   130,  12],
  ["xy12",  35, "Pikachu",     "Common",    "Lightning",  60,   6],

  // ── Modern (2020–2023) ───────────────────────────────────────────────────
  ["swsh4",     44, "Pikachu VMAX",  "Double Rare",  "Lightning", 310,  58],
  ["swsh4",    188, "Pikachu VMAX",  "Secret Rare",  "Lightning", 310,  86],
  ["swsh4",    117, "Eternatus VMAX","Double Rare",  "Darkness",  340,  14],
  ["swsh12pt5", 40, "Mewtwo VSTAR",  "Double Rare",  "Psychic",   280,  11],
  ["sv2",      254, "Iono",          "Special Illustration Rare", "Colorless", 0, 68],
  ["sv3pt5",   199, "Charizard ex",  "Special Illustration Rare", "Fire", 330, 250],
  ["sv3pt5",   205, "Mew ex",        "Special Illustration Rare", "Psychic", 180, 190],
  ["sv3pt5",     6, "Charizard ex",  "Double Rare",  "Fire",      330,  18],
  ["sv3pt5",   151, "Mew ex",        "Double Rare",  "Psychic",   180,  12],
  ["sv3pt5",    25, "Pikachu",       "Common",       "Lightning",  60,   3],
  ["sv3pt5",     4, "Charmander",    "Common",       "Fire",       60,   2],
];

export const CARDS = RAW.map(([set, num, name, rarity, type, hp, price]) => ({
  id: `${set}-${num}`,
  name,
  set,
  setName: SETS[set].name,
  num,
  rarity,
  type,
  hp,
  year: SETS[set].year,
  price,          // sample guide price, may be replaced by a live sync
  live: false,    // true once a real market price has been fetched
  img: `https://images.pokemontcg.io/${set}/${num}.png`,
}));

export const CARDS_BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]));

// ── Condition & grading model ───────────────────────────────────────────────
// Multipliers applied to a card's near-mint raw price to estimate what a
// specific copy is worth. Rough industry rules of thumb, not appraisals.
export const CONDITIONS = [
  { id: "NM",    label: "Near Mint",   mult: 1.0  },
  { id: "LP",    label: "Lightly Played", mult: 0.8 },
  { id: "MP",    label: "Moderately Played", mult: 0.6 },
  { id: "HP",    label: "Heavily Played", mult: 0.4 },
  { id: "DMG",   label: "Damaged",     mult: 0.25 },
  { id: "PSA8",  label: "Graded PSA 8", mult: 1.6 },
  { id: "PSA9",  label: "Graded PSA 9", mult: 2.6 },
  { id: "PSA10", label: "Graded PSA 10", mult: 7.5 },
];
export const CONDITION_BY_ID = Object.fromEntries(CONDITIONS.map((c) => [c.id, c]));

export function conditionMult(id) {
  return CONDITION_BY_ID[id]?.mult ?? 1;
}

/** Estimated market value of one copy in a given condition. */
export function valueOf(card, condition = "NM") {
  if (!card) return 0;
  return card.price * conditionMult(condition);
}

// ── Formatting helpers ──────────────────────────────────────────────────────
export const fmtMoney = (n, opts = {}) => {
  const { compact = false, cents = null } = opts;
  const v = Number.isFinite(n) ? n : 0;
  if (compact && Math.abs(v) >= 10000) {
    return "$" + (v / 1000).toFixed(v >= 100000 ? 0 : 1) + "K";
  }
  const decimals = cents === null ? (Math.abs(v) < 100 ? 2 : 0) : cents;
  return "$" + v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

export const fmtPct = (n) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}%`;

export const fmtDate = (iso) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export const todayISO = () => new Date().toISOString().slice(0, 10);

/** Outbound search links — the app tracks purchases, the buying happens here. */
export function buyLinks(card) {
  const q = encodeURIComponent(`${card.name} ${SETS[card.set].name} ${card.num}`);
  return [
    { label: "TCGplayer", href: `https://www.tcgplayer.com/search/pokemon/product?q=${q}` },
    { label: "eBay",      href: `https://www.ebay.com/sch/i.html?_nkw=${q}+pokemon+card` },
    { label: "Price data", href: `https://www.pricecharting.com/search-products?q=${q}&type=prices` },
  ];
}
