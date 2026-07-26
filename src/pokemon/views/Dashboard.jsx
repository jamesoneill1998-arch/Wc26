import { fmtDate, fmtMoney, fmtPct } from "../catalog.js";
import { BarChart, LineChart, StatTile } from "../charts.jsx";

export default function Dashboard({ binder, onOpen }) {
  const { stats, spendSeries, bySet, byRarity, holdings } = binder;
  const up = stats.gain >= 0;
  const liveCount = binder.cards.filter((c) => c.live).length;

  return (
    <>
      <div className="view-head">
        <div>
          <h2>Dashboard</h2>
          <p className="sub">
            Everything below is computed from the purchases you have logged
            {liveCount > 0 ? " and live market prices." : " and the built-in sample prices."}
          </p>
        </div>
      </div>

      {/* Hero figure — exactly one per view — then supporting tiles. */}
      <div className="stat-row">
        <StatTile
          hero
          label="Collection value"
          value={fmtMoney(stats.value, { compact: true, cents: 0 })}
          delta={`${up ? "+" : "−"}${fmtMoney(Math.abs(stats.gain), { cents: 0 })} (${fmtPct(stats.gainPct)})`}
          deltaLabel="vs what you paid"
          tone={up ? "good" : "bad"}
        />
        <StatTile label="Total invested" value={fmtMoney(stats.cost, { cents: 0 })} />
        <StatTile label="Cards held" value={stats.qty.toLocaleString()} />
        <StatTile label="Unique cards" value={stats.unique.toLocaleString()} />
        <StatTile label="Average cost per card" value={fmtMoney(stats.avgCost)} />
      </div>

      <div className="chart-grid">
        <LineChart
          wide
          title="Money invested over time"
          sub="Cumulative outlay by purchase date"
          data={spendSeries.map((p) => ({ x: p.date, y: p.cumulative, spent: p.spent }))}
          format={(v) => fmtMoney(v, { compact: true, cents: 0 })}
          xLabel={(d) => fmtDate(d.x)}
          footnote="Real purchase history from your own log — no simulated price curve."
        />

        <div className="chart-stack">
          <BarChart
            title="Value by set"
            sub="Set"
            data={bySet.map((s) => ({ key: s.set, label: s.label, value: s.value }))}
            format={(v) => fmtMoney(v, { cents: 0 })}
          />

          <BarChart
            title="Value by rarity"
            sub="Rarity"
            data={byRarity.map((r) => ({ label: r.label, value: r.value }))}
            format={(v) => fmtMoney(v, { cents: 0 })}
          />
        </div>

        <section className="card chart-card">
          <header className="chart-head">
            <div>
              <h3>Top holdings</h3>
              <p className="sub">Ranked by current estimated value</p>
            </div>
          </header>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Card</th>
                  <th scope="col" className="num">Qty</th>
                  <th scope="col" className="num">Cost</th>
                  <th scope="col" className="num">Value</th>
                  <th scope="col" className="num">Gain / loss</th>
                </tr>
              </thead>
              <tbody>
                {holdings.slice(0, 8).map((h) => (
                  <tr key={h.card.id} className="clickable" onClick={() => onOpen(h.card)}>
                    <th scope="row">
                      <span className="cell-name">{h.card.name}</span>
                      <span className="cell-sub">{h.card.setName} #{h.card.num}</span>
                    </th>
                    <td className="num">{h.qty}</td>
                    <td className="num">{fmtMoney(h.cost, { cents: 0 })}</td>
                    <td className="num">{fmtMoney(h.value, { cents: 0 })}</td>
                    <td className={`num ${h.gain >= 0 ? "tone-good" : "tone-bad"}`}>
                      <span aria-hidden="true">{h.gain >= 0 ? "▲ " : "▼ "}</span>
                      {fmtMoney(Math.abs(h.gain), { cents: 0 })}{" "}
                      <span className="cell-sub inline">{fmtPct(h.gainPct)}</span>
                    </td>
                  </tr>
                ))}
                {holdings.length === 0 && (
                  <tr><td colSpan="5" className="empty">Log a purchase from the Market tab to get started.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {(stats.best || stats.worst) && (
        <div className="callout-row">
          {stats.best && (
            <div className="card callout">
              <span className="callout-label">Best performer</span>
              <strong>{stats.best.card.name}</strong>
              <span className="tone-good">
                <span aria-hidden="true">▲ </span>{fmtPct(stats.best.gainPct)} since you bought it
              </span>
            </div>
          )}
          {stats.worst && stats.worst.card.id !== stats.best?.card.id && (
            <div className="card callout">
              <span className="callout-label">Weakest performer</span>
              <strong>{stats.worst.card.name}</strong>
              <span className={stats.worst.gainPct >= 0 ? "tone-good" : "tone-bad"}>
                <span aria-hidden="true">{stats.worst.gainPct >= 0 ? "▲ " : "▼ "}</span>
                {fmtPct(stats.worst.gainPct)} since you bought it
              </span>
            </div>
          )}
        </div>
      )}

      <p className="method-note">
        <strong>How values are estimated.</strong> Each copy is valued at its card's near-mint
        price multiplied by a condition factor (lightly played ×0.8, PSA 10 ×7.5, and so on).
        These are rules of thumb for tracking a collection, not appraisals — check a live
        sales history before you buy or sell.
      </p>
    </>
  );
}
