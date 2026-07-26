import { useMemo, useState } from "react";
import { RARITIES, SETS, TYPES, fmtMoney } from "../catalog.js";
import { CardTile } from "../components.jsx";
import { fetchPrices, searchCards } from "../api.js";

const SORTS = {
  "price-desc": { label: "Price: high → low", fn: (a, b) => b.price - a.price },
  "price-asc":  { label: "Price: low → high", fn: (a, b) => a.price - b.price },
  "name":       { label: "Name A → Z",        fn: (a, b) => a.name.localeCompare(b.name) },
  "year-asc":   { label: "Oldest first",      fn: (a, b) => a.year - b.year || a.num - b.num },
  "year-desc":  { label: "Newest first",      fn: (a, b) => b.year - a.year || a.num - b.num },
};

export default function Market({ binder, onOpen }) {
  const [q, setQ] = useState("");
  const [set, setSet] = useState("all");
  const [rarity, setRarity] = useState("all");
  const [type, setType] = useState("all");
  const [maxPrice, setMaxPrice] = useState(1000);
  const [owned, setOwned] = useState("all");
  const [sort, setSort] = useState("price-desc");

  const [sync, setSync] = useState({ state: "idle", msg: "" });
  const [remote, setRemote] = useState(null);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return binder.cards
      .filter((c) => {
        if (needle && !`${c.name} ${c.setName}`.toLowerCase().includes(needle)) return false;
        if (set !== "all" && c.set !== set) return false;
        if (rarity !== "all" && c.rarity !== rarity) return false;
        if (type !== "all" && c.type !== type) return false;
        if (c.price > maxPrice) return false;
        if (owned === "owned" && !binder.ownedIds.has(c.id)) return false;
        if (owned === "missing" && binder.ownedIds.has(c.id)) return false;
        return true;
      })
      .sort(SORTS[sort].fn);
  }, [binder.cards, binder.ownedIds, q, set, rarity, type, maxPrice, owned, sort]);

  const anyLive = binder.cards.some((c) => c.live);

  async function syncPrices() {
    setSync({ state: "loading", msg: "Fetching live prices…" });
    try {
      const ids = results.slice(0, 60).map((c) => c.id);
      const prices = await fetchPrices(ids);
      const n = Object.keys(prices).length;
      if (!n) throw new Error("no prices returned");
      binder.setPrices(prices);
      setSync({ state: "ok", msg: `Updated ${n} card${n === 1 ? "" : "s"} from the Pokémon TCG API.` });
    } catch (err) {
      setSync({
        state: "error",
        msg: `Live prices unavailable (${err.message}). Showing the built-in sample prices.`,
      });
    }
  }

  async function searchLive() {
    setSync({ state: "loading", msg: "Searching the Pokémon TCG API…" });
    try {
      const found = await searchCards(q.trim());
      setRemote(found);
      setSync({ state: "ok", msg: `${found.length} live result${found.length === 1 ? "" : "s"} for “${q.trim()}”.` });
    } catch (err) {
      setRemote(null);
      setSync({ state: "error", msg: `Live search unavailable (${err.message}).` });
    }
  }

  return (
    <>
      <div className="view-head">
        <div>
          <h2>Market</h2>
          <p className="sub">
            Browse the catalog, check what a copy is worth, then log what you buy.{" "}
            {anyLive ? "Some prices are live." : "Prices are built-in samples until you sync."}
          </p>
        </div>
        <div className="head-actions">
          <button type="button" className="ghost-btn" onClick={syncPrices} disabled={sync.state === "loading"}>
            {sync.state === "loading" ? "Syncing…" : "Sync live prices"}
          </button>
          {anyLive && (
            <button type="button" className="ghost-btn sm" onClick={binder.clearPrices}>
              Reset to sample
            </button>
          )}
        </div>
      </div>

      {sync.msg && (
        <p className={`notice ${sync.state}`} role="status">
          {sync.msg}
        </p>
      )}

      {/* One filter row above everything it scopes. */}
      <div className="filter-row">
        <label className="filter grow">
          <span>Search</span>
          <input
            type="search"
            value={q}
            onChange={(e) => { setQ(e.target.value); setRemote(null); }}
            placeholder="Charizard, Jungle, Lugia…"
          />
        </label>
        <label className="filter">
          <span>Set</span>
          <select value={set} onChange={(e) => setSet(e.target.value)}>
            <option value="all">All sets</option>
            {Object.entries(SETS).map(([id, s]) => (
              <option key={id} value={id}>{s.name} ({s.year})</option>
            ))}
          </select>
        </label>
        <label className="filter">
          <span>Rarity</span>
          <select value={rarity} onChange={(e) => setRarity(e.target.value)}>
            <option value="all">All rarities</option>
            {RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label className="filter">
          <span>Type</span>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">All types</option>
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
          <span>Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
          </select>
        </label>
        <label className="filter range">
          <span>Under {fmtMoney(maxPrice, { cents: 0 })}</span>
          <input
            type="range" min="5" max="1000" step="5"
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
          />
        </label>
      </div>

      <p className="result-count">
        {results.length} card{results.length === 1 ? "" : "s"}
        {results.length > 0 && ` · ${fmtMoney(results.reduce((s, c) => s + c.price, 0), { compact: true })} to buy one of each`}
      </p>

      {results.length === 0 && (
        <div className="empty-state">
          <p>Nothing in the built-in catalog matches that.</p>
          {q.trim().length > 1 && (
            <button type="button" className="primary-btn" onClick={searchLive}>
              Search the live Pokémon TCG API for “{q.trim()}”
            </button>
          )}
        </div>
      )}

      <div className="card-grid">
        {results.map((c) => (
          <CardTile
            key={c.id}
            card={c}
            owned={binder.ownedIds.has(c.id)}
            wished={binder.wishedIds.has(c.id)}
            onOpen={onOpen}
          />
        ))}
      </div>

      {remote && remote.length > 0 && (
        <>
          <h3 className="section-head">Live results from the Pokémon TCG API</h3>
          <div className="card-grid">
            {remote.map((c) => (
              <CardTile
                key={c.id}
                card={c}
                owned={binder.ownedIds.has(c.id)}
                wished={binder.wishedIds.has(c.id)}
                onOpen={onOpen}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}
