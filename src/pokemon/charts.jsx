import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ════════════════════════════════════════════════════════════════════════════
//  Chart primitives.
//
//  Colors come from CSS custom properties (--series-1, --grid, --ink-*) so
//  light and dark are each a selected set of steps, not an automatic flip.
//  Every chart ships a table-view twin — no value is reachable only by hover.
// ════════════════════════════════════════════════════════════════════════════

function ChartFrame({ title, sub, children, table, footnote, wide = false }) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className={wide ? "card chart-card wide" : "card chart-card"}>
      <header className="chart-head">
        <div>
          <h3>{title}</h3>
          {sub && <p className="sub">{sub}</p>}
        </div>
        {table && (
          <button
            type="button"
            className="ghost-btn sm"
            aria-pressed={showTable}
            onClick={() => setShowTable((v) => !v)}
          >
            {showTable ? "Chart" : "Table"}
          </button>
        )}
      </header>
      {showTable && table ? <div className="table-wrap">{table}</div> : children}
      {footnote && <p className="footnote">{footnote}</p>}
    </section>
  );
}

/** Stat tile — label / value / optional signed delta. The number is the chart. */
export function StatTile({ label, value, delta, deltaLabel, tone = "neutral", hero = false }) {
  return (
    <div className={`stat-tile${hero ? " hero" : ""}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {delta != null && (
        <span className={`stat-delta tone-${tone}`}>
          <span aria-hidden="true" className="delta-icon">
            {tone === "good" ? "▲" : tone === "bad" ? "▼" : "■"}
          </span>
          {delta}
          {deltaLabel && <span className="delta-label"> {deltaLabel}</span>}
        </span>
      )}
    </div>
  );
}

/**
 * Horizontal bars for magnitude-by-category. One series, one color — bar
 * length already encodes the value, so hue carries nothing extra.
 */
export function BarChart({ title, sub, data, format = (v) => v, footnote, emptyText = "Nothing to plot yet." }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const table = (
    <table className="data-table">
      <thead>
        <tr><th scope="col">{sub ?? "Category"}</th><th scope="col" className="num">Value</th></tr>
      </thead>
      <tbody>
        {data.map((d) => (
          <tr key={d.key ?? d.label}>
            <th scope="row">{d.label}</th>
            <td className="num">{format(d.value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <ChartFrame title={title} sub={sub} table={data.length ? table : null} footnote={footnote}>
      {data.length === 0 ? (
        <p className="empty">{emptyText}</p>
      ) : (
        <ul className="bars">
          {data.map((d) => (
            <li key={d.key ?? d.label} className="bar-row" title={`${d.label}: ${format(d.value)}`}>
              <span className="bar-label">{d.label}</span>
              <span className="bar-track">
                <span className="bar-fill" style={{ width: `${Math.max(1.5, (d.value / max) * 100)}%` }} />
              </span>
              <span className="bar-value">{format(d.value)}</span>
            </li>
          ))}
        </ul>
      )}
    </ChartFrame>
  );
}

/**
 * Cumulative line + area wash over time, with a crosshair tooltip and a
 * direct label on the endpoint only.
 */
export function LineChart({ title, sub, data, format = (v) => v, xLabel = (d) => d.x, footnote, wide = false }) {
  const [hover, setHover] = useState(null);
  const [width, setWidth] = useState(640);
  const wrapRef = useRef(null);

  // Render at 1:1 with the container so axis text never scales with the card.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const W = width, H = 240, PAD = { t: 16, r: 64, b: 30, l: 56 };
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;

  const { pts, ticks, maxY } = useMemo(() => {
    if (!data.length) return { pts: [], ticks: [], maxY: 1 };
    const raw = Math.max(...data.map((d) => d.y), 1);
    const step = Math.pow(10, Math.floor(Math.log10(raw))) / 2;
    const niceMax = Math.ceil(raw / step) * step;
    const n = data.length;
    const pts = data.map((d, i) => ({
      ...d,
      cx: PAD.l + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW),
      cy: PAD.t + plotH - (d.y / niceMax) * plotH,
    }));
    const ticks = [0, 0.5, 1].map((f) => ({
      v: niceMax * f,
      y: PAD.t + plotH - f * plotH,
    }));
    return { pts, ticks, maxY: niceMax };
  }, [data, plotW, plotH, PAD.l, PAD.t]);

  const onMove = useCallback(
    (e) => {
      if (!pts.length || !wrapRef.current) return;
      const rect = wrapRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      let nearest = pts[0];
      for (const p of pts) if (Math.abs(p.cx - x) < Math.abs(nearest.cx - x)) nearest = p;
      setHover(nearest);
    },
    [pts]
  );

  const line = pts.map((p, i) => `${i ? "L" : "M"}${p.cx.toFixed(1)},${p.cy.toFixed(1)}`).join(" ");
  const area = pts.length
    ? `${line} L${pts[pts.length - 1].cx.toFixed(1)},${PAD.t + plotH} L${pts[0].cx.toFixed(1)},${PAD.t + plotH} Z`
    : "";
  const last = pts[pts.length - 1];

  const table = (
    <table className="data-table">
      <thead>
        <tr><th scope="col">Date</th><th scope="col" className="num">Value</th></tr>
      </thead>
      <tbody>
        {data.map((d) => (
          <tr key={d.x}>
            <th scope="row">{xLabel(d)}</th>
            <td className="num">{format(d.y)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <ChartFrame title={title} sub={sub} table={data.length ? table : null} footnote={footnote} wide={wide}>
      {!data.length ? (
        <p className="empty">Log a purchase and this fills in.</p>
      ) : (
        <div className="line-wrap" ref={wrapRef} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
          <svg
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={`${title}. Table view available.`}
            className="line-svg"
          >
            {ticks.map((t) => (
              <g key={t.v}>
                <line x1={PAD.l} x2={W - PAD.r} y1={t.y} y2={t.y} className="grid-line" />
                <text x={PAD.l - 10} y={t.y + 4} className="axis-text" textAnchor="end">
                  {format(t.v)}
                </text>
              </g>
            ))}
            <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + plotH} y2={PAD.t + plotH} className="axis-line" />
            <path d={area} className="area-fill" />
            <path d={line} className="series-line" />
            {hover && <line x1={hover.cx} x2={hover.cx} y1={PAD.t} y2={PAD.t + plotH} className="crosshair" />}
            {last && (
              <>
                <circle cx={last.cx} cy={last.cy} r="5" className="end-dot" />
                <text x={last.cx + 12} y={last.cy + 4} className="end-label">{format(last.y)}</text>
              </>
            )}
            {hover && hover !== last && <circle cx={hover.cx} cy={hover.cy} r="5" className="end-dot" />}
            <text x={PAD.l} y={H - 8} className="axis-text">{xLabel(data[0])}</text>
            {data.length > 1 && (
              <text x={W - PAD.r} y={H - 8} className="axis-text" textAnchor="end">
                {xLabel(data[data.length - 1])}
              </text>
            )}
          </svg>
          {hover && (
            <div
              className="chart-tip"
              style={{ left: `${(hover.cx / W) * 100}%`, top: `${(hover.cy / H) * 100}%` }}
            >
              <strong>{format(hover.y)}</strong>
              <span>{xLabel(hover)}</span>
            </div>
          )}
        </div>
      )}
    </ChartFrame>
  );
}

/** Progress meter — fill on a lighter step of the same ramp. */
export function Meter({ pct, label }) {
  return (
    <div className="meter" role="img" aria-label={`${label ?? "Progress"}: ${pct.toFixed(0)} percent`}>
      <span className="meter-fill" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}
