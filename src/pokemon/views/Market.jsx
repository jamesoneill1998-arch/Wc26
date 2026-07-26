import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_RARITIES, RARITIES, TYPES, fmtMoney } from "../catalog.js";
import { CardTile } from "../components.jsx";
import { fetchPrices } from "../api.js";

const SORTS = {
  default:      { label: "Newest set first", fn: null },
  "price-desc": { label: "Price: high → low", fn: (a, b) => b.price - a.price },
  "price-asc":  { label: "Price: low → high", fn: (a, b) => a.price - b.price },
  name:         { label: "Name A → Z",        fn: (a, b) => a.name.localeCompare(b.name) },
};

export default function Market({ binder, catalog, onOpen }) {
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");       // debounced copy of `text`
  const [setId, setSetId] = useState("");
  const [rarity, setRarity] = useState("");
  const [type, setType] = useState("");
  const [owned, setOwned] = useState("all");
  const [sort, setSort] = useState("default");

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [syncing, setSyncing] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setQuery(text), 400);
    return () => clearTimeout(t);
  }, [text]);

  const run = useCallback(
    async (nextPage) => {
      const id = ++requestId.current;
      setLoading(true);
      const res = await catalog.search({ text: query, setId, rarity, type, page: nextPage });
      if (id !== requestId.current) return;          // a newer query already landed
      setItems((prev) => (nextPage === 1 ? res.cards : [...prev, ...res.cards]));
      setTotal(res.totalCount);
      setPage(res.page);
      setLoading(false);
      if (res.degraded) setNotice(`Live search failed (${res.degraded}) — showing built-in cards.`);
    },
    [catalog, query, setId, rarity, type]
  );

  // Refetch whenever the query or a filter changes; reset to page 1.
  useEffect(() => {
    if (catalog.status === "loading") return;
    setNotice("");
    run(1);
  }, [run, catalog.status]);

  const shown = useMemo(() => {
    const filtered = items.filter((c) => {
      if (owned === "owned") return binder.ownedIds.has(c.id);
      if (owned === "missing") return !binder.ownedIds.has(c.id);
      return true;
    });
    const fn = SORTS[sort].fn;
    return fn ? [...filtered].sort(fn) : filtered;
  }, [items, owned, sort, binder.ownedIds]);

  // Sets grouped by series for the picker.
  const setGroups = useMemo(() => {
    const m = new Map();
    for (const s of catalog.sets) {
      if (!m.has(s.series)) m.set(s.series, []);
      m.get(s.series).push(s);
    }
    return [...m.entries()];
  }, [catalog.sets]);

  const rarityOptions = catalog.live ? API_RARITIES : RARITIES;
  const hasMore = items.length < total;

  async function syncPrices() {
    setSyncing(true);
    setNotice("Refreshing market prices…");
    try {
      const ids = shown.slice(0, 60).map((c) => c.id);
      const prices = await fetchPrices(ids);
      const n = Object.keys(prices).length;
      if (!n) throw new Error("no prices returned");
      binder.setPrices(prices);
      setItems((prev) => prev.map((c) => (prices[c.id] ? { ...c, ...prices[c.id] } : c)));
      setNotice(`Refreshed ${n} price${n === 1 ? "" : "s"} from the Pokémon TCG API.`);
    } catch (err) {
      setNotice(`Could not refresh prices (${err.message}).`);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <>
      <div className="view-head">
        <div>
          <h2>Market</h2>
          <p className="sub">
            Search every Pokémon card ever printed, then log what you buy.
          </p>
        </div>
        <div className="head-actions">
          <button type="button" className="ghost-btn" onClick={syncPrices} disabled={syncing || !shown.length}>
            {syncing ? "Refreshing…" : "Refresh prices"}
          </button>
        </div>
      </div>

      <DatabaseBanner catalog={catalog} />
      {notice && <p className="notice" role="status">{notice}</p>}

      <div className="filter-row">
        <label className="filter grow">
          <span>Search</span>
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Charizard, Mew, Iono…"
          />
        </label>
        <label className="filter">
          <span>Set</span>
          <select value={setId} onChange={(e) => setSetId(e.target.value)}>
            <option value="">All sets</option>
            {setGroups.map(([series, list]) => (
              <optgroup key={series} label={series}>
                {list.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.year || "—"})</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="filter">
          <span>Rarity</span>
          <select value={rarity} onChange={(e) => setRarity(e.target.value)}>
            <option value="">All rarities</option>
            {rarityOptions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label className="filter">
          <span>Type</span>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All types</option>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="filter">
          <span>Collection</span>
          <select value={owned} onChange={(e) => setOwned(e.target.value)}>
            <option value="all">Everything</option>
            <option value="owned">Only owned</option>
            <option value="missing">Only missing</option>
          </select>
        </label>
        <label className="filter">
          <span>Sort loaded</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
          </select>
        </label>
      </div>

      <p className="result-count">
        {loading && items.length === 0
          ? "Searching…"
          : `${total.toLocaleString()} match${total === 1 ? "" : "es"} · showing ${shown.length.toLocaleString()}`}
      </p>

      {!loading && shown.length === 0 && (
        <div className="empty-state">
          <p>Nothing matches those filters.</p>
          <p className="sub">Try a different name, or clear the set and rarity filters.</p>
        </div>
      )}

      <div className={`card-grid${loading && items.length ? " refreshing" : ""}`}>
        {shown.map((c) => (
          <CardTile
            key={c.id}
            card={c}
            owned={binder.ownedIds.has(c.id)}
            wished={binder.wishedIds.has(c.id)}
            onOpen={onOpen}
          />
        ))}
      </div>

      {hasMore && (
        <div className="load-more">
          <button type="button" className="ghost-btn" onClick={() => run(page + 1)} disabled={loading}>
            {loading ? "Loading…" : `Load more (${(total - items.length).toLocaleString()} left)`}
          </button>
        </div>
      )}
    </>
  );
}

/** Says plainly which database the cards on screen came from. */
export function DatabaseBanner({ catalog }) {
  if (catalog.status === "loading") {
    return <p className="notice loading" role="status">Loading the card database…</p>;
  }
  if (catalog.status === "live") {
    return (
      <p className="notice ok" role="status">
        <strong>Live database</strong> — {catalog.sets.length} sets from the Pokémon TCG API, with
        real scans and market prices.
      </p>
    );
  }
  return (
    <p className="notice error" role="status">
      <strong>Offline</strong> — the Pokémon TCG API could not be reached
      {catalog.error ? ` (${catalog.error})` : ""}. Showing the small built-in catalog with sample
      prices.{" "}
      <button type="button" className="link-btn" onClick={() => catalog.reload({ force: true })}>
        Try again
      </button>
    </p>
  );
}
