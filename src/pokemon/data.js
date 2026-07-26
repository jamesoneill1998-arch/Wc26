import { useCallback, useEffect, useRef, useState } from "react";
import { CARDS, LOCAL_SET_LIST } from "./catalog.js";
import { fetchSetCards, fetchSets, searchCards } from "./api.js";

// ════════════════════════════════════════════════════════════════════════════
//  The card database.
//
//  Live: every set and every card from the Pokémon TCG API, fetched in the
//  browser and cached (sets for a day in localStorage, card pages for the
//  session in memory).
//
//  Offline: the small built-in catalog in catalog.js, filtered locally. The
//  same functions serve both, so views never branch on which one is active —
//  they only read `status` to tell the user what they are looking at.
// ════════════════════════════════════════════════════════════════════════════

const PAGE_SIZE = 60;

function localPage(cards, page, pageSize) {
  const start = (page - 1) * pageSize;
  return { cards: cards.slice(start, start + pageSize), page, pageSize, totalCount: cards.length };
}

export function useCatalog() {
  const [status, setStatus] = useState("loading"); // loading | live | offline
  const [sets, setSets] = useState(LOCAL_SET_LIST);
  const [error, setError] = useState("");
  const pageCache = useRef(new Map());

  const loadSets = useCallback(async ({ force = false } = {}) => {
    setStatus("loading");
    setError("");
    try {
      const live = await fetchSets({ force });
      setSets(live);
      setStatus("live");
    } catch (err) {
      setSets(LOCAL_SET_LIST);
      setStatus("offline");
      setError(err.message || "the card database could not be reached");
    }
  }, []);

  useEffect(() => {
    loadSets();
  }, [loadSets]);

  const live = status === "live";

  /** One page of a set's checklist. */
  const getSetCards = useCallback(
    async (setId, page = 1) => {
      const key = `set:${setId}:${page}`;
      if (pageCache.current.has(key)) return pageCache.current.get(key);

      if (!live) {
        const local = CARDS.filter((c) => c.set === setId).sort((a, b) => a.num - b.num);
        return localPage(local, page, PAGE_SIZE);
      }
      try {
        const res = await fetchSetCards(setId, { page, pageSize: PAGE_SIZE });
        pageCache.current.set(key, res);
        return res;
      } catch (err) {
        const local = CARDS.filter((c) => c.set === setId).sort((a, b) => a.num - b.num);
        return { ...localPage(local, page, PAGE_SIZE), degraded: err.message };
      }
    },
    [live]
  );

  /** Search across the database, with optional set / rarity / type filters. */
  const search = useCallback(
    async ({ text = "", setId = "", rarity = "", type = "", page = 1 } = {}) => {
      const key = `q:${text}|${setId}|${rarity}|${type}|${page}`;
      if (pageCache.current.has(key)) return pageCache.current.get(key);

      const localMatch = () => {
        const needle = text.trim().toLowerCase();
        const local = CARDS.filter(
          (c) =>
            (!needle || `${c.name} ${c.setName}`.toLowerCase().includes(needle)) &&
            (!setId || c.set === setId) &&
            (!rarity || c.rarity === rarity) &&
            (!type || c.type === type)
        ).sort((a, b) => b.price - a.price);
        return localPage(local, page, PAGE_SIZE);
      };

      if (!live) return localMatch();
      try {
        const res = await searchCards(text, { setId, rarity, type, page, pageSize: PAGE_SIZE });
        pageCache.current.set(key, res);
        return res;
      } catch (err) {
        return { ...localMatch(), degraded: err.message };
      }
    },
    [live]
  );

  return { status, live, sets, error, reload: loadSets, getSetCards, search, pageSize: PAGE_SIZE };
}
