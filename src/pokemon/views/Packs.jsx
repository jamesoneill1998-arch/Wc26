import { useEffect, useMemo, useState } from "react";
import { fmtMoney, todayISO } from "../catalog.js";
import { CardArt } from "../components.jsx";
import { StatTile } from "../charts.jsx";

// ════════════════════════════════════════════════════════════════════════════
//  Booster simulator — a toy, and labelled as one.
//
//  Odds are a simplified stand-in for real print runs: 8 filler slots, one
//  rare slot, and a hit slot that lands about one pack in six. It draws from
//  the first page of the chosen set's checklist, so it is a feel for variance,
//  not a model of any real product.
// ════════════════════════════════════════════════════════════════════════════

const HIT_CHANCE = 1 / 6;
const isFiller = (r = "") => /^(common|uncommon)$/i.test(r);
const isHit = (r = "") => /(illustration|secret|rainbow|hyper|ultra|shiny|radiant|amazing|ace spec)/i.test(r);

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export default function Packs({ binder, catalog, onOpen }) {
  const [setId, setSetId] = useState("");
  const [pool, setPool] = useState([]);
  const [loading, setLoading] = useState(false);
  const [packPrice, setPackPrice] = useState(4.99);
  const [pulls, setPulls] = useState(null);
  const [session, setSession] = useState({ packs: 0, spent: 0, pulled: 0 });
  const [added, setAdded] = useState(false);

  // Default to the newest set once the database lands.
  useEffect(() => {
    if (!setId && catalog.sets.length) setSetId(catalog.sets[0].id);
  }, [catalog.sets, setId]);

  useEffect(() => {
    if (!setId) return;
    let alive = true;
    setLoading(true);
    setPulls(null);
    catalog.getSetCards(setId, 1).then((res) => {
      if (!alive) return;
      setPool(res.cards);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [setId, catalog]);

  const { fillers, rares, hits } = useMemo(
    () => ({
      fillers: pool.filter((c) => isFiller(c.rarity)),
      rares: pool.filter((c) => !isFiller(c.rarity) && !isHit(c.rarity)),
      hits: pool.filter((c) => isHit(c.rarity)),
    }),
    [pool]
  );

  const canOpen = pool.length > 0 && !loading;

  function open() {
    if (!canOpen) return;
    const filler = fillers.length ? fillers : pool;
    const rare = rares.length ? rares : pool;
    const out = [];
    for (let i = 0; i < 8; i++) out.push(pick(filler));
    out.push(pick(rare));
    out.push(hits.length && Math.random() < HIT_CHANCE ? pick(hits) : pick(rare));

    setPulls(out);
    setAdded(false);
    setSession((s) => ({
      packs: s.packs + 1,
      spent: s.spent + Number(packPrice),
      pulled: s.pulled + out.reduce((n, c) => n + c.price, 0),
    }));
  }

  /** Log the pull, splitting the pack price across cards by their share of value. */
  function keepPulls() {
    if (!pulls) return;
    const total = pulls.reduce((s, c) => s + c.price, 0);
    const byCard = new Map();
    for (const c of pulls) byCard.set(c.id, (byCard.get(c.id) ?? 0) + 1);

    const lots = [];
    for (const [cardId, qty] of byCard) {
      const card = pulls.find((c) => c.id === cardId);
      binder.addCard(card);
      const share = total > 0
        ? (card.price / total) * Number(packPrice)
        : Number(packPrice) / pulls.length;
      lots.push({
        cardId,
        qty,
        condition: "NM",
        pricePaid: Math.round(share * 100) / 100,
        date: todayISO(),
        note: `Pack pull — ${catalog.sets.find((s) => s.id === setId)?.name ?? setId}`,
      });
    }
    binder.addLots(lots);
    setAdded(true);
  }

  const pullValue = pulls ? pulls.reduce((s, c) => s + c.price, 0) : 0;
  const net = pullValue - Number(packPrice);
  const running = session.pulled - session.spent;

  return (
    <>
      <div className="view-head">
        <div>
          <h2>Pack simulator</h2>
          <p className="sub">
            A simulation, not a store. It draws from the first 60 cards of the set&apos;s checklist,
            so pull values run above a real pack — treat it as a feel for variance, nothing more.
          </p>
        </div>
      </div>

      <div className="filter-row">
        <label className="filter grow">
          <span>Set</span>
          <select value={setId} onChange={(e) => setSetId(e.target.value)}>
            {catalog.sets.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.year || "—"})</option>
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
            {loading ? "Loading set…" : "Open a pack"}
          </button>
        </div>
      </div>

      <div className="stat-row">
        <StatTile hero label="Packs opened this session" value={String(session.packs)} />
        <StatTile label="Simulated spend" value={fmtMoney(session.spent)} />
        <StatTile label="Value pulled" value={fmtMoney(session.pulled)} />
        <StatTile
          label="Running result"
          value={fmtMoney(Math.abs(running))}
          delta={running >= 0 ? "ahead" : "behind"}
          tone={running >= 0 ? "good" : "bad"}
        />
      </div>

      {!loading && pool.length === 0 && setId && (
        <p className="notice error">No cards loaded for that set — pick another.</p>
      )}

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
