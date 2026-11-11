import { useMemo } from "react";
import { fmtMoney } from "../catalog.js";
import { CardArt } from "../components.jsx";
import { StatTile } from "../charts.jsx";

const PRIORITIES = ["high", "medium", "low"];
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

/**
 * The buy planner: what you want, what it costs today, what you are willing to
 * pay, and how much of it fits inside this month's budget.
 */
export default function Wishlist({ binder, onOpen }) {
  const rows = useMemo(
    () =>
      binder.wishlist
        .map((w) => {
          const card = binder.cardsById[w.cardId];
          if (!card) return null;
          const gap = card.price - w.target;          // > 0 means it costs more than you'll pay
          return { ...w, card, gap, atTarget: gap <= 0 };
        })
        .filter(Boolean)
        .sort(
          (a, b) =>
            PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
            Number(b.atTarget) - Number(a.atTarget) ||
            a.gap - b.gap
        ),
    [binder.wishlist, binder.cardsById]
  );

  const marketTotal = rows.reduce((s, r) => s + r.card.price, 0);
  const targetTotal = rows.reduce((s, r) => s + r.target, 0);
  const ready = rows.filter((r) => r.atTarget);

  // Greedy fill: walk the priority-ordered list and take what the budget covers.
  const plan = [];
  let left = binder.budget;
  for (const r of rows) {
    if (r.card.price <= left) {
      plan.push(r);
      left -= r.card.price;
    }
  }
  const planCost = plan.reduce((s, r) => s + r.card.price, 0);
  const months = binder.budget > 0 ? marketTotal / binder.budget : Infinity;

  return (
    <>
      <div className="view-head">
        <div>
          <h2>Wishlist &amp; buy plan</h2>
          <p className="sub">Set the price you are willing to pay, then let the budget decide the order.</p>
        </div>
        <label className="budget-field">
          <span>Monthly budget</span>
          <input
            type="number" min="0" step="10"
            value={binder.budget}
            onChange={(e) => binder.setBudget(e.target.value)}
          />
        </label>
      </div>

      <div className="stat-row">
        <StatTile hero label="Wishlist at market" value={fmtMoney(marketTotal, { compact: true, cents: 0 })} />
        <StatTile label="At your target prices" value={fmtMoney(targetTotal, { cents: 0 })} />
        <StatTile
          label="Already at or below target"
          value={`${ready.length} of ${rows.length}`}
          delta={ready.length ? "buy now" : "keep watching"}
          tone={ready.length ? "good" : "neutral"}
        />
        <StatTile
          label="Months to finish"
          value={Number.isFinite(months) ? `${Math.ceil(months)}` : "—"}
          delta={binder.budget > 0 ? `at ${fmtMoney(binder.budget, { cents: 0 })}/mo` : "set a budget"}
        />
      </div>

      {rows.length === 0 ? (
        <div className="empty-state">
          <p>Your wishlist is empty.</p>
          <p className="sub">Open a card in the Market tab and hit “Add to wishlist”.</p>
        </div>
      ) : (
        <>
          <section className="card plan-card">
            <header className="chart-head">
              <div>
                <h3>This month&apos;s plan</h3>
                <p className="sub">
                  {plan.length
                    ? `${plan.length} card${plan.length === 1 ? "" : "s"} for ${fmtMoney(planCost, { cents: 0 })}, leaving ${fmtMoney(left, { cents: 0 })} of the budget.`
                    : "Nothing on the list fits this month's budget yet."}
                </p>
              </div>
            </header>
            {plan.length > 0 && (
              <ul className="plan-list">
                {plan.map((r) => (
                  <li key={r.cardId}>
                    <button type="button" className="thumb-btn" onClick={() => onOpen(r.card)}>
                      <CardArt card={r.card} className="xs" />
                    </button>
                    <div>
                      <strong>{r.card.name}</strong>
                      <span className="cell-sub">{r.card.setName} · {fmtMoney(r.card.price)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="table-wrap card">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col" className="art-col" />
                  <th scope="col">Card</th>
                  <th scope="col" className="num">Market</th>
                  <th scope="col" className="num">Your target</th>
                  <th scope="col" className="num">Gap</th>
                  <th scope="col">Priority</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="num">Remove</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.cardId}>
                    <td className="art-col">
                      <button type="button" className="thumb-btn" onClick={() => onOpen(r.card)} aria-label={`Open ${r.card.name}`}>
                        <CardArt card={r.card} className="xs" />
                      </button>
                    </td>
                    <th scope="row">
                      <span className="cell-name">{r.card.name}</span>
                      <span className="cell-sub">{r.card.setName} #{r.card.num}</span>
                    </th>
                    <td className="num">{fmtMoney(r.card.price)}</td>
                    <td className="num">
                      <input
                        className="inline-num wide"
                        type="number" min="0" step="1" value={r.target}
                        onChange={(e) => binder.updateWish(r.cardId, { target: Number(e.target.value) || 0 })}
                        aria-label={`Target price for ${r.card.name}`}
                      />
                    </td>
                    <td className={`num ${r.atTarget ? "tone-good" : ""}`}>
                      {r.atTarget ? "—" : fmtMoney(r.gap)}
                    </td>
                    <td>
                      <select
                        className="inline-select"
                        value={r.priority}
                        onChange={(e) => binder.updateWish(r.cardId, { priority: e.target.value })}
                        aria-label={`Priority for ${r.card.name}`}
                      >
                        {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </td>
                    <td className={r.atTarget ? "tone-good" : "tone-muted"}>
                      <span aria-hidden="true">{r.atTarget ? "● " : "○ "}</span>
                      {r.atTarget ? "At target" : `${fmtMoney(r.gap)} to go`}
                    </td>
                    <td className="num">
                      <button
                        type="button"
                        className="ghost-btn sm danger"
                        onClick={() => binder.toggleWish(r.cardId)}
                        aria-label={`Remove ${r.card.name} from wishlist`}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
