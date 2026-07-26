import { useState } from "react";
import { fmtMoney } from "../catalog.js";
import { Meter } from "../charts.jsx";
import { CardTile } from "../components.jsx";

/**
 * Set completion. Progress is measured against the cards this catalog tracks
 * for each set — not the full printed checklist — and the card says so.
 */
export default function Sets({ binder, onOpen }) {
  const [open, setOpen] = useState(null);
  const openSet = binder.setProgress.find((s) => s.id === open);
  const setCards = openSet ? binder.cards.filter((c) => c.set === openSet.id).sort((a, b) => a.num - b.num) : [];

  return (
    <>
      <div className="view-head">
        <div>
          <h2>Set completion</h2>
          <p className="sub">How far through each set you are, and what finishing it would cost.</p>
        </div>
      </div>

      <div className="set-grid">
        {binder.setProgress.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`card set-card${open === s.id ? " active" : ""}`}
            onClick={() => setOpen(open === s.id ? null : s.id)}
            aria-expanded={open === s.id}
          >
            <div className="set-top">
              <span className="set-code">{s.code}</span>
              <div>
                <strong>{s.name}</strong>
                <span className="cell-sub">{s.series} · {s.year}</span>
              </div>
              <span className="set-pct">{s.pct.toFixed(0)}%</span>
            </div>
            <Meter pct={s.pct} label={`${s.name} completion`} />
            <div className="set-bottom">
              <span>{s.owned} of {s.tracked} tracked</span>
              <span>{s.printedTotal} in the printed set</span>
              <span>{fmtMoney(s.missingValue, { cents: 0 })} to finish</span>
            </div>
          </button>
        ))}
      </div>

      {openSet && (
        <section className="set-detail">
          <h3 className="section-head">
            {openSet.name} — {setCards.filter((c) => binder.ownedIds.has(c.id)).length} owned,{" "}
            {setCards.filter((c) => !binder.ownedIds.has(c.id)).length} still missing
          </h3>
          <div className="card-grid">
            {setCards.map((c) => (
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
        </section>
      )}
    </>
  );
}
