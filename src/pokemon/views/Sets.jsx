import { useEffect, useMemo, useState } from "react";
import { fmtMoney } from "../catalog.js";
import { Meter } from "../charts.jsx";
import { CardTile } from "../components.jsx";
import { DatabaseBanner } from "./Market.jsx";

/**
 * Every set in the database, with completion measured against the real
 * printed size of each one. Opening a set loads its checklist so you can see
 * exactly which cards are still missing.
 */
export default function Sets({ binder, catalog, onOpen }) {
  const [q, setQ] = useState("");
  const [series, setSeries] = useState("");
  const [only, setOnly] = useState("all");
  const [open, setOpen] = useState(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return catalog.sets
      .map((s) => {
        const owned = binder.ownedBySet.get(s.id) ?? { unique: 0, qty: 0, value: 0, cost: 0 };
        const size = s.total || s.printedTotal || 0;
        return { ...s, ...owned, size, pct: size ? (owned.unique / size) * 100 : 0 };
      })
      .filter((s) => {
        if (needle && !`${s.name} ${s.series}`.toLowerCase().includes(needle)) return false;
        if (series && s.series !== series) return false;
        if (only === "started" && s.unique === 0) return false;
        if (only === "untouched" && s.unique > 0) return false;
        return true;
      })
      .sort((a, b) => b.pct - a.pct || b.year - a.year || a.name.localeCompare(b.name));
  }, [catalog.sets, binder.ownedBySet, q, series, only]);

  const allSeries = useMemo(
    () => [...new Set(catalog.sets.map((s) => s.series))].filter(Boolean).sort(),
    [catalog.sets]
  );

  const started = rows.filter((s) => s.unique > 0);
  const totalOwned = started.reduce((n, s) => n + s.unique, 0);

  return (
    <>
      <div className="view-head">
        <div>
          <h2>Set completion</h2>
          <p className="sub">
            {catalog.sets.length} sets · you have cards from {started.length} of them ({totalOwned}{" "}
            unique card{totalOwned === 1 ? "" : "s"})
          </p>
        </div>
      </div>

      <DatabaseBanner catalog={catalog} />

      <div className="filter-row">
        <label className="filter grow">
          <span>Find a set</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Base, Evolving Skies…" />
        </label>
        <label className="filter">
          <span>Series</span>
          <select value={series} onChange={(e) => setSeries(e.target.value)}>
            <option value="">All series</option>
            {allSeries.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="filter">
          <span>Show</span>
          <select value={only} onChange={(e) => setOnly(e.target.value)}>
            <option value="all">All sets</option>
            <option value="started">Started</option>
            <option value="untouched">Not started</option>
          </select>
        </label>
      </div>

      <div className="set-grid">
        {rows.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`card set-card${open === s.id ? " active" : ""}`}
            onClick={() => setOpen(open === s.id ? null : s.id)}
            aria-expanded={open === s.id}
          >
            <div className="set-top">
              {s.symbol ? (
                <img className="set-symbol" src={s.symbol} alt="" loading="lazy" />
              ) : (
                <span className="set-code">{s.id.slice(0, 4).toUpperCase()}</span>
              )}
              <div>
                <strong>{s.name}</strong>
                <span className="cell-sub">{s.series} · {s.year || "—"}</span>
              </div>
              <span className="set-pct">{s.pct.toFixed(0)}%</span>
            </div>
            <Meter pct={s.pct} label={`${s.name} completion`} />
            <div className="set-bottom">
              <span>{s.unique} of {s.size} cards</span>
              {s.value > 0 && <span>{fmtMoney(s.value, { cents: 0 })} held</span>}
            </div>
          </button>
        ))}
      </div>

      {rows.length === 0 && (
        <div className="empty-state"><p>No sets match that filter.</p></div>
      )}

      {open && (
        <SetChecklist
          key={open}
          setId={open}
          set={rows.find((s) => s.id === open)}
          binder={binder}
          catalog={catalog}
          onOpen={onOpen}
        />
      )}
    </>
  );
}

/** The card-by-card checklist for one set, loaded a page at a time. */
function SetChecklist({ setId, set, binder, catalog, onOpen }) {
  const [cards, setCards] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [hideOwned, setHideOwned] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    catalog.getSetCards(setId, 1).then((res) => {
      if (!alive) return;
      setCards(res.cards);
      setTotal(res.totalCount);
      setPage(1);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [setId, catalog]);

  async function more() {
    setLoading(true);
    const res = await catalog.getSetCards(setId, page + 1);
    setCards((prev) => [...prev, ...res.cards]);
    setPage(res.page);
    setLoading(false);
  }

  const shown = hideOwned ? cards.filter((c) => !binder.ownedIds.has(c.id)) : cards;
  const ownedHere = cards.filter((c) => binder.ownedIds.has(c.id)).length;

  return (
    <section className="set-detail">
      <div className="chart-head">
        <div>
          <h3>{set?.name ?? setId}</h3>
          <p className="sub">
            {loading && !cards.length
              ? "Loading the checklist…"
              : `${ownedHere} owned of ${cards.length} loaded${total > cards.length ? ` (${total} in the set)` : ""}`}
          </p>
        </div>
        <button type="button" className="ghost-btn sm" aria-pressed={hideOwned} onClick={() => setHideOwned((v) => !v)}>
          {hideOwned ? "Show all" : "Only missing"}
        </button>
      </div>

      <div className={`card-grid${loading && cards.length ? " refreshing" : ""}`}>
        {shown.map((c) => (
          <div key={c.id} className={binder.ownedIds.has(c.id) ? "owned-wrap owned" : "owned-wrap"}>
            <CardTile
              card={c}
              owned={binder.ownedIds.has(c.id)}
              wished={binder.wishedIds.has(c.id)}
              onOpen={onOpen}
            />
          </div>
        ))}
      </div>

      {cards.length < total && (
        <div className="load-more">
          <button type="button" className="ghost-btn" onClick={more} disabled={loading}>
            {loading ? "Loading…" : `Load more (${total - cards.length} left)`}
          </button>
        </div>
      )}
    </section>
  );
}
