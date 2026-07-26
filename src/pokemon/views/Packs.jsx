import { useMemo, useState } from "react";
import { SETS, fmtMoney, todayISO } from "../catalog.js";
import { CardArt } from "../components.jsx";
import { StatTile } from "../charts.jsx";

// ════════════════════════════════════════════════════════════════════════════
//  Booster simulator — a toy, and labelled as one.
//
//  Odds are a simplified stand-in for real print runs: 8 filler slots, one
//  rare slot, and a hit slot that lands about one pack in six. It pulls from
//  the cards this catalog tracks for the chosen set, so it is a feel for
//  variance, not a model of any real product.
// ════════════════════════════════════════════════════════════════════════════

const HIT_RARITIES = ["Illustration Rare", "Special Illustration Rare", "Secret Rare"];
const RARE_RARITIES = ["Rare", "Holo Rare", "Double Rare"];
const HIT_CHANCE = 1 / 6;

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export default function Packs({ binder, onOpen }) {
  const [setId, setSetId] = useState("base1");
  const [packPrice, setPackPrice] = useState(4.99);
  const [pulls, setPulls] = useState(null);
  const [session, setSession] = useState({ packs: 0, spent: 0, pulled: 0 });
  const [added, setAdded] = useState(false);

  const pool = useMemo(() => binder.cards.filter((c) => c.set === setId), [binder.cards, setId]);
  const fillers = pool.filter((c) => ["Common", "Uncommon"].includes(c.rarity));
  const rares = pool.filter((c) => RARE_RARITIES.includes(c.rarity));
  const hits = pool.filter((c) => HIT_RARITIES.includes(c.rarity));
  const canOpen = pool.length > 0;

  function open() {
    if (!canOpen) return;
    const filler = fillers.length ? fillers : pool;
    const rare = rares.length ? rares : pool;
    const out = [];
    for (let i = 0; i < 8; i++) out.push(pick(filler));
    out.push(pick(rare));
    out.push(hits.length && Math.random() < HIT_CHANCE ? pick(hits) : pick(rare));

    const value = out.reduce((s, c) => s + c.price, 0);
    setPulls(out);
    setAdded(false);
    setSession((s) => ({ packs: s.packs + 1, spent: s.spent + Number(packPrice), pulled: s.pulled + value }));
  }

  /** Log the pull, splitting the pack price across cards by their share of value. */
  function keepPulls() {
    if (!pulls) return;
    const total = pulls.reduce((s, c) => s + c.price, 0) || 1;
    const byCard = new Map();
    for (const c of pulls) byCard.set(c.id, (byCard.get(c.id) ?? 0) + 1);

    binder.addLots(
      [...byCard.entries()].map(([cardId, qty]) => {
        const card = binder.cardsById[cardId];
        const share = (card.price / total) * Number(packPrice);
        return {
          cardId,
          qty,
          condition: "NM",
          pricePaid: Math.round((share / 1) * 100) / 100,
          date: todayISO(),
          note: `Pack pull — ${SETS[setId].name}`,
        };
      })
    );
    setAdded(true);
  }

  const pullValue = pulls ? pulls.reduce((s, c) => s + c.price, 0) : 0;
  const net = pullValue - Number(packPrice);

  return (
    <>
      <div className="view-head">
        <div>
          <h2>Pack simulator</h2>
          <p className="sub">
            A simulation, not a store — it draws from the catalog to show how pack odds feel over time.
            The catalog only tracks each set&apos;s notable cards, so pull values run far above a real
            pack, where most slots are cards worth pennies.
          </p>
        </div>
      </div>

      <div className="filter-row">
        <label className="filter">
          <span>Set</span>
          <select value={setId} onChange={(e) => { setSetId(e.target.value); setPulls(null); }}>
            {Object.entries(SETS).map(([id, s]) => (
              <option key={id} value={id}>{s.name} ({s.year})</option>
            ))}
          </select>
        </label>
        <label className="filter">
          <span>Pack price</span>
          <input type="number" min="0" step="0.5" value={packPrice} onChange={(e) => setPackPrice(e.target.value)} />
        </label>
        <div className="filter">
          <span>&nbsp;</span>
          <button type="button" className="primary-btn" onClick={open} disabled={!canOpen}>
            Open a pack
          </button>
        </div>
      </div>

      <div className="stat-row">
        <StatTile hero label="Packs opened this session" value={String(session.packs)} />
        <StatTile label="Simulated spend" value={fmtMoney(session.spent)} />
        <StatTile label="Value pulled" value={fmtMoney(session.pulled)} />
        <StatTile
          label="Running result"
          value={fmtMoney(Math.abs(session.pulled - session.spent))}
          delta={session.pulled - session.spent >= 0 ? "ahead" : "behind"}
          tone={session.pulled - session.spent >= 0 ? "good" : "bad"}
        />
      </div>

      {!canOpen && <p className="notice error">No catalog cards for that set yet — pick another.</p>}

      {pulls && (
        <section className="pack-result">
          <header className="chart-head">
            <div>
              <h3>Your pull</h3>
              <p className="sub">
                {fmtMoney(pullValue)} of cards from a {fmtMoney(Number(packPrice))} pack ·{" "}
                <span className={net >= 0 ? "tone-good" : "tone-bad"}>
                  <span aria-hidden="true">{net >= 0 ? "▲ " : "▼ "}</span>
                  {fmtMoney(Math.abs(net))} {net >= 0 ? "ahead" : "behind"}
                </span>
              </p>
            </div>
            <button type="button" className="ghost-btn" onClick={keepPulls} disabled={added}>
              {added ? "Added to collection ✓" : "Add pulls to collection"}
            </button>
          </header>
          <div className="pull-strip">
            {pulls.map((c, i) => (
              <button
                key={`${c.id}-${i}`}
                type="button"
                className="pull-card"
                style={{ animationDelay: `${i * 60}ms` }}
                onClick={() => onOpen(c)}
              >
                <CardArt card={c} className="sm" />
                <span className="pull-price">{fmtMoney(c.price)}</span>
              </button>
            ))}
          </div>
          <p className="footnote">
            Adding pulls splits the {fmtMoney(Number(packPrice))} pack price across the cards in
            proportion to their value, so your cost basis stays honest.
          </p>
        </section>
      )}
    </>
  );
}
