import { useEffect, useRef, useState } from "react";
import {
  CONDITIONS,
  SETS,
  TYPE_META,
  buyLinks,
  conditionMult,
  fmtMoney,
  todayISO,
} from "./catalog.js";

/**
 * Card art. The real scan loads from images.pokemontcg.io; until (or unless)
 * it arrives, a CSS card face stands in — so an offline or blocked request
 * degrades to something deliberate instead of a broken image icon.
 */
export function CardArt({ card, className = "", large = false }) {
  const [loaded, setLoaded] = useState(false);
  const meta = TYPE_META[card.type] ?? TYPE_META.Colorless;
  const setMeta = SETS[card.set];
  const src = large ? card.imgLarge ?? card.img : card.img;

  return (
    <div className={`card-art ${className}`} style={{ "--tint": meta.tint }}>
      <div className="fallback-face">
        <div className="ff-top">
          <span className="ff-name">{card.name}</span>
          {card.hp > 0 && <span className="ff-hp">{card.hp} HP</span>}
        </div>
        <div className="ff-window">
          <span className="ff-glyph" aria-hidden="true">{meta.glyph}</span>
        </div>
        <div className="ff-bottom">
          <span>{setMeta ? `${setMeta.code} ${card.num}` : card.num}</span>
          <span className="ff-rarity">{card.rarity}</span>
        </div>
      </div>
      {src && (
        <img
          src={src}
          alt={`${card.name} — ${card.setName} #${card.num}`}
          loading="lazy"
          decoding="async"
          className={loaded ? "shown" : ""}
          onLoad={() => setLoaded(true)}
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
      )}
    </div>
  );
}

export function Pill({ children, tone = "neutral" }) {
  return <span className={`pill tone-${tone}`}>{children}</span>;
}

export function CardTile({ card, owned, wished, onOpen }) {
  return (
    <button type="button" className="card-tile" onClick={() => onOpen(card)}>
      <CardArt card={card} />
      <div className="tile-meta">
        <span className="tile-name">{card.name}</span>
        <span className="tile-set">{card.setName} · #{card.num}</span>
        <span className="tile-row">
          <span className="tile-price">
            {fmtMoney(card.price)}
            {card.live && <em className="live-dot" title="Live market price" />}
          </span>
          <span className="tile-flags">
            {owned && <Pill tone="good">Owned</Pill>}
            {wished && <Pill tone="accent">Wanted</Pill>}
          </span>
        </span>
      </div>
    </button>
  );
}

export function Modal({ onClose, children, labelledBy }) {
  const ref = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1} ref={ref}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
        {children}
      </div>
    </div>
  );
}

/** Card detail: what it's worth, where to buy it, and how to log the purchase. */
export function CardDetail({ card, binder, onClose }) {
  const wished = binder.wishedIds.has(card.id);
  const holding = binder.holdings.find((h) => h.card.id === card.id);
  const [form, setForm] = useState({
    qty: 1,
    condition: "NM",
    pricePaid: card.price.toFixed(2),
    date: todayISO(),
    note: "",
  });
  const [logged, setLogged] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const estimate = card.price * conditionMult(form.condition) * (Number(form.qty) || 1);
  const outlay = (Number(form.pricePaid) || 0) * (Number(form.qty) || 1);
  const delta = estimate - outlay;

  const submit = (e) => {
    e.preventDefault();
    if (card.remote) binder.addCard(card);   // keep live-API cards resolvable
    binder.addLot({
      cardId: card.id,
      qty: Number(form.qty),
      condition: form.condition,
      pricePaid: Number(form.pricePaid),
      date: form.date,
      note: form.note,
    });
    setLogged(true);
    setTimeout(onClose, 700);
  };

  return (
    <Modal onClose={onClose} labelledBy="card-detail-title">
      <div className="detail">
        <div className="detail-art">
          <CardArt card={card} className="lg" large />
          <div className="buy-links">
            {buyLinks(card).map((l) => (
              <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className="ghost-btn sm">
                {l.label} ↗
              </a>
            ))}
          </div>
        </div>

        <div className="detail-body">
          <h2 id="card-detail-title">{card.name}</h2>
          <p className="sub">
            {card.setName} · #{card.num} · {card.year || "—"} · {card.rarity}
            {card.artist && ` · illus. ${card.artist}`}
          </p>

          <div className="detail-price">
            <span className="detail-price-value">{card.price > 0 ? fmtMoney(card.price) : "No price"}</span>
            <span className="detail-price-note">
              {card.price > 0
                ? card.live
                  ? "live market price (near mint)"
                  : "sample guide price (near mint)"
                : "no market price published for this card — enter what you paid below"}
            </span>
          </div>

          {holding && (
            <p className="owned-note">
              You hold <strong>{holding.qty}</strong> — cost {fmtMoney(holding.cost)}, now worth{" "}
              {fmtMoney(holding.value)} ({holding.gain >= 0 ? "+" : "−"}
              {fmtMoney(Math.abs(holding.gain))}).
            </p>
          )}

          <div className="detail-actions">
            <button
              type="button"
              className={wished ? "ghost-btn active" : "ghost-btn"}
              onClick={() => {
                if (card.remote) binder.addCard(card);
                binder.toggleWish(card.id, card.price);
              }}
            >
              {wished ? "★ On wishlist" : "☆ Add to wishlist"}
            </button>
          </div>

          <form className="log-form" onSubmit={submit}>
            <h3>Log a purchase</h3>
            <div className="field-grid">
              <label>
                <span>Quantity</span>
                <input type="number" min="1" step="1" value={form.qty} onChange={set("qty")} required />
              </label>
              <label>
                <span>Condition</span>
                <select value={form.condition} onChange={set("condition")}>
                  {CONDITIONS.map((c) => (
                    <option key={c.id} value={c.id}>{c.label} (×{c.mult})</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Price paid, each</span>
                <input type="number" min="0" step="0.01" value={form.pricePaid} onChange={set("pricePaid")} required />
              </label>
              <label>
                <span>Date</span>
                <input type="date" value={form.date} onChange={set("date")} required />
              </label>
              <label className="wide">
                <span>Note</span>
                <input type="text" value={form.note} onChange={set("note")} placeholder="Where you bought it, grading plans…" />
              </label>
            </div>

            <p className="estimate">
              Outlay {fmtMoney(outlay)} · estimated value {fmtMoney(estimate)} ·{" "}
              {Math.abs(delta) < 0.005 ? (
                <span className="tone-muted">■ right at market</span>
              ) : (
                <span className={delta > 0 ? "tone-good" : "tone-bad"}>
                  {delta > 0 ? "▲ " : "▼ "}
                  {fmtMoney(Math.abs(delta))} {delta > 0 ? "under market" : "over market"}
                </span>
              )}
            </p>

            <button type="submit" className="primary-btn">
              {logged ? "Added ✓" : "Add to collection"}
            </button>
          </form>
        </div>
      </div>
    </Modal>
  );
}
