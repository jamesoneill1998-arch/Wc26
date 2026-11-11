import { useMemo, useRef, useState } from "react";
import { CONDITIONS, fmtDate, fmtMoney, fmtPct } from "../catalog.js";
import { CardArt } from "../components.jsx";

const COLUMNS = [
  { key: "name",  label: "Card",       get: (l) => l.card.name,   align: "" },
  { key: "set",   label: "Set",        get: (l) => l.card.setName, align: "" },
  { key: "cond",  label: "Condition",  get: (l) => l.condition,   align: "" },
  { key: "qty",   label: "Qty",        get: (l) => l.qty,         align: "num" },
  { key: "paid",  label: "Paid each",  get: (l) => l.pricePaid,   align: "num" },
  { key: "cost",  label: "Cost",       get: (l) => l.cost,        align: "num" },
  { key: "value", label: "Value now",  get: (l) => l.value,       align: "num" },
  { key: "gain",  label: "Gain / loss", get: (l) => l.value - l.cost, align: "num" },
  { key: "date",  label: "Bought",     get: (l) => l.date,        align: "" },
];

export default function Collection({ binder, onOpen }) {
  const [sort, setSort] = useState({ key: "value", dir: -1 });
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const fileRef = useRef(null);

  const lots = useMemo(() => {
    const all = binder.holdings.flatMap((h) => h.lots);
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? all.filter((l) => `${l.card.name} ${l.card.setName} ${l.note}`.toLowerCase().includes(needle))
      : all;
    const col = COLUMNS.find((c) => c.key === sort.key) ?? COLUMNS[0];
    return [...filtered].sort((a, b) => {
      const av = col.get(a), bv = col.get(b);
      const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
      return cmp * sort.dir;
    });
  }, [binder.holdings, q, sort]);

  const totals = lots.reduce(
    (t, l) => ({ cost: t.cost + l.cost, value: t.value + l.value, qty: t.qty + l.qty }),
    { cost: 0, value: 0, qty: 0 }
  );

  function toggleSort(key) {
    setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: key === "name" || key === "set" ? 1 : -1 }));
  }

  function exportJSON() {
    const payload = {
      exported: new Date().toISOString(),
      app: "Binder — Pokémon card collection tracker",
      lots: binder.lots,
      wishlist: binder.wishlist,
      budget: binder.budget,
      custom: binder.custom,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `binder-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg("Exported your collection as JSON.");
  }

  function importJSON(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!Array.isArray(data.lots)) throw new Error("no lots array in that file");
        binder.replaceAll({
          lots: data.lots,
          wishlist: Array.isArray(data.wishlist) ? data.wishlist : [],
          budget: Number(data.budget) || 150,
          custom: data.custom && typeof data.custom === "object" ? data.custom : {},
          theme: binder.theme,
        });
        setMsg(`Imported ${data.lots.length} purchase records.`);
      } catch (err) {
        setMsg(`Could not import that file: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <>
      <div className="view-head">
        <div>
          <h2>Collection</h2>
          <p className="sub">
            {totals.qty} card{totals.qty === 1 ? "" : "s"} · {fmtMoney(totals.cost, { cents: 0 })} invested ·{" "}
            {fmtMoney(totals.value, { cents: 0 })} estimated value
          </p>
        </div>
        <div className="head-actions">
          <button type="button" className="ghost-btn" onClick={exportJSON}>Export JSON</button>
          <button type="button" className="ghost-btn" onClick={() => fileRef.current?.click()}>Import JSON</button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={importJSON} />
        </div>
      </div>

      {msg && <p className="notice ok" role="status">{msg}</p>}

      <div className="filter-row">
        <label className="filter grow">
          <span>Filter</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Card, set or note…" />
        </label>
      </div>

      {lots.length === 0 ? (
        <div className="empty-state start">
          <h3>Nothing logged yet</h3>
          <p className="sub">
            Open any card in the Market or Sets tab and use “Log a purchase”. Or load a demo
            collection to see what the dashboard looks like with data in it.
          </p>
          <div className="head-actions">
            <button type="button" className="ghost-btn" onClick={binder.loadDemo}>
              Load demo collection
            </button>
            <button type="button" className="ghost-btn" onClick={() => fileRef.current?.click()}>
              Import a JSON backup
            </button>
          </div>
        </div>
      ) : (
        <div className="table-wrap card">
          <table className="data-table lots">
            <thead>
              <tr>
                <th scope="col" className="art-col" />
                {COLUMNS.map((c) => (
                  <th key={c.key} scope="col" className={c.align}>
                    <button type="button" className="sort-btn" onClick={() => toggleSort(c.key)}>
                      {c.label}
                      {sort.key === c.key && <span aria-hidden="true"> {sort.dir === 1 ? "↑" : "↓"}</span>}
                    </button>
                  </th>
                ))}
                <th scope="col" className="num">Edit</th>
              </tr>
            </thead>
            <tbody>
              {lots.map((l) => {
                const gain = l.value - l.cost;
                const pct = l.cost > 0 ? (gain / l.cost) * 100 : 0;
                return (
                  <tr key={l.uid}>
                    <td className="art-col">
                      <button type="button" className="thumb-btn" onClick={() => onOpen(l.card)} aria-label={`Open ${l.card.name}`}>
                        <CardArt card={l.card} className="xs" />
                      </button>
                    </td>
                    <th scope="row">
                      <span className="cell-name">{l.card.name}</span>
                      {l.note && <span className="cell-sub">{l.note}</span>}
                    </th>
                    <td>{l.card.setName} <span className="cell-sub inline">#{l.card.num}</span></td>
                    <td>
                      <select
                        className="inline-select"
                        value={l.condition}
                        onChange={(e) => binder.updateLot(l.uid, { condition: e.target.value })}
                        aria-label={`Condition of ${l.card.name}`}
                      >
                        {CONDITIONS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                    </td>
                    <td className="num">
                      <input
                        className="inline-num"
                        type="number" min="1" step="1" value={l.qty}
                        onChange={(e) => binder.updateLot(l.uid, { qty: Math.max(1, Number(e.target.value) || 1) })}
                        aria-label={`Quantity of ${l.card.name}`}
                      />
                    </td>
                    <td className="num">{fmtMoney(l.pricePaid)}</td>
                    <td className="num">{fmtMoney(l.cost, { cents: 0 })}</td>
                    <td className="num">{fmtMoney(l.value, { cents: 0 })}</td>
                    <td className={`num ${gain >= 0 ? "tone-good" : "tone-bad"}`}>
                      <span aria-hidden="true">{gain >= 0 ? "▲ " : "▼ "}</span>
                      {fmtMoney(Math.abs(gain), { cents: 0 })} <span className="cell-sub inline">{fmtPct(pct)}</span>
                    </td>
                    <td className="nowrap">{fmtDate(l.date)}</td>
                    <td className="num">
                      <button
                        type="button"
                        className="ghost-btn sm danger"
                        onClick={() => binder.removeLot(l.uid)}
                        aria-label={`Remove ${l.card.name}`}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="art-col" />
                <th scope="row">Total</th>
                <td />
                <td />
                <td className="num">{totals.qty}</td>
                <td />
                <td className="num">{fmtMoney(totals.cost, { cents: 0 })}</td>
                <td className="num">{fmtMoney(totals.value, { cents: 0 })}</td>
                <td className={`num ${totals.value - totals.cost >= 0 ? "tone-good" : "tone-bad"}`}>
                  <span aria-hidden="true">{totals.value - totals.cost >= 0 ? "▲ " : "▼ "}</span>
                  {fmtMoney(Math.abs(totals.value - totals.cost), { cents: 0 })}
                </td>
                <td />
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div className="danger-row">
        {lots.length > 0 && (
          <button type="button" className="ghost-btn sm" onClick={binder.loadDemo}>
            Replace with demo collection
          </button>
        )}
        <button
          type="button"
          className="ghost-btn sm danger"
          onClick={() => { if (confirm("Delete every purchase, wishlist entry and setting stored in this browser?")) binder.clearAll(); }}
        >
          Clear everything
        </button>
      </div>
    </>
  );
}
