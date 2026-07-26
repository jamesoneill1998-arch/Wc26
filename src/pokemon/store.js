import { useCallback, useEffect, useMemo, useState } from "react";
import { CARDS, CARDS_BY_ID, SETS, conditionMult, todayISO } from "./catalog.js";

const KEY = "pkmn-binder-v1";

const EMPTY = {
  lots: [],            // { uid, cardId, qty, condition, pricePaid, date, note }
  wishlist: [],        // { cardId, target, priority, added }
  budget: 150,         // monthly buying budget, USD
  prices: {},          // cardId -> { price, live, at }  (live sync overrides)
  custom: {},          // cards pulled in from the live API, kept so holdings resolve
  theme: "dark",
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { ...EMPTY, ...parsed };
  } catch {
    return null;
  }
}

/**
 * An optional demo portfolio, only ever loaded when someone explicitly asks
 * for it from the Collection tab. A new collection starts empty.
 */
function demo() {
  const lots = [
    ["base1-58", 1, "NM",  14.0, "2025-11-08", "First card of the binder"],
    ["base1-4",  1, "MP", 210.0, "2025-12-02", "Local card show"],
    ["base3-5",  1, "LP",  58.0, "2026-01-17", ""],
    ["xy12-11",  2, "NM",  82.0, "2026-02-21", "Bought a pair, one to trade"],
    ["sv3pt5-6", 3, "NM",  16.5, "2026-03-14", "Box hit"],
    ["base2-10", 1, "NM",  41.0, "2026-04-05", ""],
    ["swsh4-44", 1, "NM",  49.0, "2026-05-19", ""],
    ["sv3pt5-151", 2, "NM", 11.0, "2026-06-11", ""],
    ["base1-10", 1, "PSA9", 175.0, "2026-07-02", "Slabbed, came back a 9"],
  ].map(([cardId, qty, condition, pricePaid, date, note], i) => ({
    uid: `demo-${i}`, cardId, qty, condition, pricePaid, date, note,
  }));

  const wishlist = [
    { cardId: "base1-2",  target: 210, priority: "high",   added: "2026-06-01" },
    { cardId: "neo1-9",   target: 275, priority: "medium", added: "2026-06-14" },
    { cardId: "base3-4",  target: 45,  priority: "low",    added: "2026-07-04" },
    { cardId: "sv3pt5-199", target: 200, priority: "high", added: "2026-07-19" },
  ];

  return { ...EMPTY, lots, wishlist };
}

let uidCounter = 0;
const newUid = () => `lot-${Date.now().toString(36)}-${(uidCounter++).toString(36)}`;

export function useBinder() {
  const [state, setState] = useState(() => load() ?? { ...EMPTY });

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* quota or private mode — the app still works for this session */
    }
  }, [state]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", state.theme);
  }, [state.theme]);

  const patch = useCallback((fn) => setState((s) => ({ ...s, ...fn(s) })), []);

  // ── Cards, with any live prices folded in ────────────────────────────────
  const cards = useMemo(
    () =>
      [...CARDS, ...Object.values(state.custom)].map((c) => {
        const p = state.prices[c.id];
        return p ? { ...c, price: p.price, live: true, pricedAt: p.at } : c;
      }),
    [state.prices, state.custom]
  );
  const cardsById = useMemo(() => Object.fromEntries(cards.map((c) => [c.id, c])), [cards]);
  const priceOf = useCallback((id) => cardsById[id]?.price ?? CARDS_BY_ID[id]?.price ?? 0, [cardsById]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const addLot = useCallback(
    (lot) =>
      patch((s) => ({
        lots: [
          ...s.lots,
          {
            uid: newUid(),
            condition: "NM",
            date: todayISO(),
            note: "",
            ...lot,
            pricePaid: Number(lot.pricePaid) || 0,
            qty: Math.max(1, Number(lot.qty) || 1),
          },
        ],
      })),
    [patch]
  );

  const addLots = useCallback(
    (newLots) =>
      patch((s) => ({
        lots: [
          ...s.lots,
          ...newLots.map((l) => ({
            uid: newUid(), qty: 1, condition: "NM", date: todayISO(), note: "", ...l,
          })),
        ],
      })),
    [patch]
  );

  /** Remember a card that came from the live API so holdings can resolve it. */
  const addCard = useCallback(
    (card) =>
      patch((s) =>
        s.custom[card.id] || CARDS_BY_ID[card.id] ? {} : { custom: { ...s.custom, [card.id]: card } }
      ),
    [patch]
  );

  const updateLot = useCallback(
    (uid, fields) =>
      patch((s) => ({ lots: s.lots.map((l) => (l.uid === uid ? { ...l, ...fields } : l)) })),
    [patch]
  );

  const removeLot = useCallback(
    (uid) => patch((s) => ({ lots: s.lots.filter((l) => l.uid !== uid) })),
    [patch]
  );

  const toggleWish = useCallback(
    (cardId, target) =>
      patch((s) =>
        s.wishlist.some((w) => w.cardId === cardId)
          ? { wishlist: s.wishlist.filter((w) => w.cardId !== cardId) }
          : {
              wishlist: [
                ...s.wishlist,
                {
                  cardId,
                  target: Math.round((target ?? priceOf(cardId)) * 0.85 * 100) / 100,
                  priority: "medium",
                  added: todayISO(),
                },
              ],
            }
      ),
    [patch, priceOf]
  );

  const updateWish = useCallback(
    (cardId, fields) =>
      patch((s) => ({ wishlist: s.wishlist.map((w) => (w.cardId === cardId ? { ...w, ...fields } : w)) })),
    [patch]
  );

  const setBudget = useCallback((budget) => patch(() => ({ budget: Math.max(0, Number(budget) || 0) })), [patch]);
  const setTheme = useCallback((theme) => patch(() => ({ theme })), [patch]);
  const setPrices = useCallback(
    (map) => patch((s) => ({ prices: { ...s.prices, ...map } })),
    [patch]
  );
  const clearPrices = useCallback(() => patch(() => ({ prices: {} })), [patch]);

  const replaceAll = useCallback((next) => setState({ ...EMPTY, ...next }), []);
  const loadDemo = useCallback(() => setState((s) => ({ ...demo(), theme: s.theme })), []);
  const clearAll = useCallback(() => setState((s) => ({ ...EMPTY, theme: s.theme })), []);

  // ── Derived portfolio ────────────────────────────────────────────────────
  const holdings = useMemo(() => {
    const byCard = new Map();
    for (const lot of state.lots) {
      const card = cardsById[lot.cardId];
      if (!card) continue;
      const value = card.price * conditionMult(lot.condition) * lot.qty;
      const cost = lot.pricePaid * lot.qty;
      const h = byCard.get(lot.cardId) ?? { card, qty: 0, cost: 0, value: 0, lots: [] };
      h.qty += lot.qty;
      h.cost += cost;
      h.value += value;
      h.lots.push({ ...lot, card, value, cost });
      byCard.set(lot.cardId, h);
    }
    return [...byCard.values()]
      .map((h) => ({ ...h, gain: h.value - h.cost, gainPct: h.cost > 0 ? ((h.value - h.cost) / h.cost) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);
  }, [state.lots, cardsById]);

  const stats = useMemo(() => {
    const value = holdings.reduce((s, h) => s + h.value, 0);
    const cost = holdings.reduce((s, h) => s + h.cost, 0);
    const qty = holdings.reduce((s, h) => s + h.qty, 0);
    const gain = value - cost;
    const ranked = [...holdings].filter((h) => h.cost > 0).sort((a, b) => b.gainPct - a.gainPct);
    return {
      value,
      cost,
      gain,
      gainPct: cost > 0 ? (gain / cost) * 100 : 0,
      qty,
      unique: holdings.length,
      best: ranked[0] ?? null,
      worst: ranked.length > 1 ? ranked[ranked.length - 1] : null,
      avgCost: qty > 0 ? cost / qty : 0,
    };
  }, [holdings]);

  /** Cumulative money invested, by purchase date. */
  const spendSeries = useMemo(() => {
    const byDate = new Map();
    for (const lot of state.lots) {
      byDate.set(lot.date, (byDate.get(lot.date) ?? 0) + lot.pricePaid * lot.qty);
    }
    let running = 0;
    return [...byDate.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, spent]) => ({ date, spent, cumulative: (running += spent) }));
  }, [state.lots]);

  const bySet = useMemo(() => {
    const m = new Map();
    for (const h of holdings) {
      const label = SETS[h.card.set]?.name ?? h.card.setName ?? h.card.set;
      const e = m.get(h.card.set) ?? { set: h.card.set, label, value: 0, cost: 0, qty: 0 };
      e.value += h.value;
      e.cost += h.cost;
      e.qty += h.qty;
      m.set(h.card.set, e);
    }
    return [...m.values()].sort((a, b) => b.value - a.value);
  }, [holdings]);

  const byRarity = useMemo(() => {
    const m = new Map();
    for (const h of holdings) {
      const e = m.get(h.card.rarity) ?? { label: h.card.rarity, qty: 0, value: 0 };
      e.qty += h.qty;
      e.value += h.value;
      m.set(h.card.rarity, e);
    }
    return [...m.values()].sort((a, b) => b.value - a.value);
  }, [holdings]);

  /**
   * What you own per set id — unique cards, copies and value. The Sets view
   * joins this onto the live set list to work out completion against the
   * real printed size of each set.
   */
  const ownedBySet = useMemo(() => {
    const m = new Map();
    for (const h of holdings) {
      const e = m.get(h.card.set) ?? { unique: 0, qty: 0, value: 0, cost: 0 };
      e.unique += 1;
      e.qty += h.qty;
      e.value += h.value;
      e.cost += h.cost;
      m.set(h.card.set, e);
    }
    return m;
  }, [holdings]);

  const ownedIds = useMemo(() => new Set(state.lots.map((l) => l.cardId)), [state.lots]);
  const wishedIds = useMemo(() => new Set(state.wishlist.map((w) => w.cardId)), [state.wishlist]);

  return {
    ...state,
    cards,
    cardsById,
    priceOf,
    holdings,
    stats,
    spendSeries,
    bySet,
    byRarity,
    ownedBySet,
    ownedIds,
    wishedIds,
    addLot,
    addLots,
    addCard,
    updateLot,
    removeLot,
    toggleWish,
    updateWish,
    setBudget,
    setTheme,
    setPrices,
    clearPrices,
    replaceAll,
    loadDemo,
    clearAll,
  };
}
