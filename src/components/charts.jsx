// Small chart pieces for the stats page, built from divs rather than a charting library:
// one less dependency to keep working on the server, and they inherit the app's own theme
// tokens so light and dark mode need no extra wiring.
//
// Series colours come from --series-1..8 in styles.css, which are a validated colourblind-
// safe set stepped separately for each theme. Slots are handed out in a fixed order and
// never cycled, so a colour always means the same column.

import { useState } from 'react';

export const SERIES_SLOTS = 8;
export const seriesColor = (i) => (i < SERIES_SLOTS ? `var(--series-${i + 1})` : 'var(--chart-other)');

// Round an axis maximum up to something readable: 1, 2, 5, 10, 20, 50, 100...
export function niceMax(value) {
  if (value <= 4) return Math.max(1, Math.ceil(value));
  const pow = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 5, 10]) {
    const candidate = step * pow;
    if (value <= candidate) return candidate;
  }
  return 10 * pow;
}

export function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  const short = new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short' });
  // The year only where it changes, so twelve labels still fit across a narrow screen.
  return m === 1 ? `${short} ${String(y).slice(2)}` : short;
}

// One tooltip per chart, positioned inside the chart box. Marks are focusable so a
// keyboard shows exactly what hovering shows.
function useTooltip() {
  const [tip, setTip] = useState(null);
  const show = (e, text) => {
    const mark = e.currentTarget.getBoundingClientRect();
    const host = e.currentTarget.closest('.chart')?.getBoundingClientRect();
    if (!host) return;
    setTip({ x: mark.left - host.left + mark.width / 2, y: mark.top - host.top, text });
  };
  const hide = () => setTip(null);
  const mark = (text) => ({
    role: 'img',
    'aria-label': text,
    tabIndex: 0,
    onPointerEnter: (e) => show(e, text),
    onPointerLeave: hide,
    onFocus: (e) => show(e, text),
    onBlur: hide,
  });
  const tooltip = tip && (
    <div className="chart-tip" style={{ left: `${tip.x}px`, top: `${tip.y}px` }} aria-hidden="true">
      {tip.text}
    </div>
  );
  return [mark, tooltip];
}

// Every chart ships the same numbers as a table, so nothing is reachable only by hovering
// or only by telling two colours apart.
export function ChartTable({ head, rows }) {
  return (
    <details className="chart-table">
      <summary>Show the numbers</summary>
      <table className="list">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={h} className={i ? 'num' : ''}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={String(r[0])}>
              {r.map((cell, i) => (
                <td key={head[i]} className={i ? 'num' : ''}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

export function Legend({ items }) {
  return (
    <ul className="chart-legend">
      {items.map((it) => (
        <li key={it.label}>
          <span className="swatch" style={{ background: it.color }} />
          {it.label}
        </li>
      ))}
    </ul>
  );
}

export function StatTile({ label, value, hint }) {
  return (
    <div className="tile">
      <div className="tile-label">{label}</div>
      <div className="tile-value">{value}</div>
      {hint && <div className="tile-hint">{hint}</div>}
    </div>
  );
}

export function Meter({ done, total, label }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="meter-block">
      <div className="meter-head">
        <span>{label}</span>
        <span className="muted">
          {done} of {total} done
        </span>
      </div>
      <div
        className="meter"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div className="meter-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// Horizontal bars, one series. One colour for every bar: the length already carries the
// value, so shading them by size would spend the colour channel saying it twice.
export function BarChart({ rows, unit = 'projects' }) {
  const [mark, tooltip] = useTooltip();
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="chart bars">
      {tooltip}
      {rows.map((r) => (
        <div className="bar-row" key={r.label}>
          <div className="bar-label" title={r.label}>
            {r.label}
          </div>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{ width: `${(r.value / max) * 100}%` }}
              {...mark(`${r.label}: ${r.value} ${unit}`)}
            />
          </div>
          <div className="bar-value">{r.value}</div>
        </div>
      ))}
    </div>
  );
}

// Horizontal stacked bars: each row's length is its total, so rows compare to each other,
// and the segments show what that total is made of.
export function StackedBar({ rows, series }) {
  const [mark, tooltip] = useTooltip();
  const max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <div className="chart stacked">
      {tooltip}
      {rows.map((r) => (
        <div className="bar-row" key={r.label}>
          <div className="bar-label" title={r.label}>
            {r.label}
          </div>
          <div className="bar-track">
            <div className="stack" style={{ width: `${(r.total / max) * 100}%` }}>
              {series.map((s, i) =>
                r.counts[s.id] > 0 ? (
                  <div
                    key={s.id}
                    className="seg"
                    style={{ flexGrow: r.counts[s.id], background: seriesColor(i) }}
                    {...mark(`${r.label} — ${s.name}: ${r.counts[s.id]}`)}
                  />
                ) : null,
              )}
            </div>
          </div>
          <div className="bar-value">{r.total}</div>
        </div>
      ))}
    </div>
  );
}

// Grouped columns over time. A series value of null means "not recorded" and draws
// nothing at all, because a zero-height bar would read as "nothing happened".
export function ColumnChart({ months, series, startIndex }) {
  const [mark, tooltip] = useTooltip();
  const top = niceMax(Math.max(1, ...months.flatMap((m) => series.map((s) => m[s.key] ?? 0))));
  const ticks = [top, top / 2, 0].filter((t, i, a) => a.indexOf(t) === i);
  const height = (v) => `${(v / top) * 100}%`;

  return (
    <div className="chart columns">
      {tooltip}
      <div className="plot">
        <div className="y-axis" aria-hidden="true">
          {ticks.map((t) => (
            // The zero line would double up with the axis rule underneath it.
            <div className={`y-tick${t === 0 ? ' zero' : ''}`} key={t} style={{ bottom: height(t) }}>
              <span>{t}</span>
            </div>
          ))}
        </div>
        <div className="col-groups">
          {months.map((m, i) => (
            <div className={`col-group${i === startIndex ? ' history-start' : ''}`} key={m.month}>
              <div className="col-stack">
                {series.map((s, si) =>
                  m[s.key] === null || m[s.key] === undefined ? null : (
                    <div
                      key={s.key}
                      className="col"
                      style={{ height: height(m[s.key]), background: seriesColor(si) }}
                      {...mark(
                        `${monthLabel(m.month)} — ${s.name}: ${m[s.key]}${m.partial && s.partial ? ' (part month)' : ''}`,
                      )}
                    />
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="x-axis" aria-hidden="true">
        {months.map((m) => (
          <div key={m.month}>{monthLabel(m.month)}</div>
        ))}
      </div>
    </div>
  );
}
