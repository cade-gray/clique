import { Fragment, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { PropertyValue, Tag, formatDate, isEmpty, toPeople } from './props.jsx';

const POLL_MS = 10000;

// Plain-text form of a property value, used for sorting and for the CSV export.
function plain(def, value) {
  if (isEmpty(value)) return '';
  if (def.type === 'checkbox') return value ? 'Yes' : '';
  if (Array.isArray(value) || def.type === 'people') return toPeople(value).join(', ');
  return String(value);
}

// Spreadsheets run text that starts with = + - @ as a formula, so neutralise it.
function csvCell(value, safe = true) {
  let s = String(value ?? '');
  if (safe && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function download(name, text) {
  // The BOM makes Excel read the file as UTF-8.
  const url = URL.createObjectURL(new Blob(['﻿', text], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ListView({ workspace }) {
  const [projects, setProjects] = useState(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [blockedOnly, setBlockedOnly] = useState(false);
  const [showSubtasks, setShowSubtasks] = useState(true);
  const [sort, setSort] = useState({ id: 'status', dir: 1 });

  useEffect(() => {
    const load = () => api.projects({ subtasks: true }).then(setProjects).catch(() => {});
    load();
    const t = setInterval(() => document.visibilityState === 'visible' && load(), POLL_MS);
    window.addEventListener('focus', load);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', load);
    };
  }, []);

  const statusIndex = (p) => workspace.columns.findIndex((c) => c.id === p.status);
  const statusName = (p) => workspace.columns.find((c) => c.id === p.status)?.name ?? '';
  const progress = (p) => (p.subtasks.total ? p.subtasks.done / p.subtasks.total : null);

  const columns = useMemo(
    () => [
      { id: 'title', label: 'Project', sort: (p) => p.title.toLowerCase(), text: (p) => p.title },
      { id: 'status', label: 'Status', sort: statusIndex, text: statusName },
      {
        id: 'blocked',
        label: 'Blocked',
        sort: (p) => (p.blocked ? 0 : 1),
        text: (p) => (p.blocked ? 'Yes' : ''),
        reason: (p) => p.blockedReason,
      },
      ...workspace.properties.map((def) => ({
        id: `prop:${def.key}`,
        label: def.name,
        def,
        sort: (p) => (def.type === 'number' ? p.properties[def.key] : plain(def, p.properties[def.key]).toLowerCase()),
        text: (p) => plain(def, p.properties[def.key]),
      })),
      {
        id: 'subtasks',
        label: 'Subtasks',
        sort: progress,
        text: (p) => (p.subtasks.total ? `${p.subtasks.done}/${p.subtasks.total}` : ''),
      },
      { id: 'updated', label: 'Updated', sort: (p) => p.updated ?? '', text: (p) => (p.updated ?? '').slice(0, 10) },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workspace],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const col = columns.find((c) => c.id === sort.id) ?? columns[0];
    const list = (projects ?? []).filter(
      (p) =>
        (!q || p.title.toLowerCase().includes(q) || columns.some((c) => c.text(p).toLowerCase().includes(q))) &&
        (!status || p.status === status) &&
        (!blockedOnly || p.blocked),
    );
    // Empty values always sort last, whichever direction is chosen.
    return list.sort((a, b) => {
      const x = col.sort(a);
      const y = col.sort(b);
      const xe = x === null || x === undefined || x === '';
      const ye = y === null || y === undefined || y === '';
      if (xe || ye) return xe === ye ? 0 : xe ? 1 : -1;
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir || a.title.localeCompare(b.title);
    });
  }, [projects, columns, query, status, blockedOnly, sort]);

  function exportCsv() {
    const header = [];
    for (const c of columns) {
      header.push(c.label);
      if (c.reason) header.push('Blocked reason');
      if (c.id === 'subtasks') header.push('Subtasks done', 'Subtasks total', 'Progress');
    }
    if (showSubtasks) header.push('Subtask', 'Subtask status', 'Subtask owners');
    const lines = [header.map((h) => csvCell(h, false))];
    for (const p of rows) {
      const cells = [];
      for (const c of columns) {
        const numeric = c.def?.type === 'number' || c.def?.type === 'date' || c.id === 'updated';
        cells.push(csvCell(c.text(p), !numeric));
        if (c.reason) cells.push(csvCell(c.reason(p)));
        if (c.id === 'subtasks') {
          const pr = progress(p);
          cells.push(p.subtasks.done, p.subtasks.total, pr === null ? '' : `${Math.round(pr * 100)}%`);
        }
      }
      // With subtasks on, each subtask gets its own row that repeats the project columns,
      // so the file can be filtered and pivoted by project. A project without subtasks is one row.
      const items = showSubtasks ? p.subtasks.items ?? [] : [];
      if (!showSubtasks) lines.push(cells);
      else if (items.length === 0) lines.push([...cells, '', '', '']);
      else
        for (const t of items)
          lines.push([...cells, csvCell(t.text), t.done ? 'Done' : 'Open', csvCell(toPeople(t.owners).join(', '))]);
    }
    const day = new Date().toISOString().slice(0, 10);
    download(`clique-projects-${day}.csv`, lines.map((l) => l.join(',')).join('\r\n') + '\r\n');
  }

  if (!projects) return <div className="loading">Loading…</div>;

  const blockedCount = projects.filter((p) => p.blocked).length;

  return (
    <div className="list-wrap">
      <div className="board-toolbar list-toolbar">
        <input className="search" placeholder="Filter projects…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>
          {workspace.columns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="check">
          <input type="checkbox" checked={blockedOnly} onChange={(e) => setBlockedOnly(e.target.checked)} /> Blocked only
        </label>
        <label className="check">
          <input type="checkbox" checked={showSubtasks} onChange={(e) => setShowSubtasks(e.target.checked)} /> Show subtasks
        </label>
        <span className="muted">
          {rows.length === projects.length ? `${projects.length} projects` : `${rows.length} of ${projects.length} projects`}
          {blockedCount > 0 && ` · ${blockedCount} blocked`}
        </span>
        <span className="spacer" />
        <button onClick={() => window.print()}>Print / PDF</button>
        <button className="primary" onClick={exportCsv} disabled={rows.length === 0}>
          Export CSV
        </button>
      </div>
      <div className="list-scroll">
        <table className="list">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.id} aria-sort={sort.id === c.id ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
                  <button onClick={() => setSort((s) => ({ id: c.id, dir: s.id === c.id ? -s.dir : 1 }))}>
                    {c.label}
                    <span className="arrow">{sort.id === c.id ? (sort.dir === 1 ? '▲' : '▼') : ''}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <Fragment key={p.id}>
                <tr className={`project-row ${p.blocked ? 'blocked' : ''} ${showSubtasks && p.subtasks.total ? 'has-subtasks' : ''}`}>
                  {columns.map((c) => (
                    <td key={c.id} className={`col-${c.id.replace(/\W/g, '-')}`}>
                      <Cell c={c} p={p} columns={workspace.columns} />
                    </td>
                  ))}
                </tr>
                {showSubtasks && p.subtasks.total > 0 && (
                  <tr className="subtask-row">
                    <td colSpan={columns.length}>
                      <ul className="list-subtasks">
                        {p.subtasks.items.map((t, i) => (
                          <li key={i} className={t.done ? 'done' : ''}>
                            <span className="box" aria-label={t.done ? 'Done' : 'Open'}>
                              {t.done ? '☑' : '☐'}
                            </span>
                            <span className="text">{t.text}</span>
                            {toPeople(t.owners).map((n) => (
                              <Tag key={n}>{n}</Tag>
                            ))}
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="muted empty">
                  No projects match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="muted small print-only">Exported {new Date().toLocaleString()}</p>
    </div>
  );
}

function Cell({ c, p, columns }) {
  if (c.id === 'title') return <a href={`#/p/${encodeURIComponent(p.id)}`}>{p.title}</a>;
  if (c.id === 'status') return <Tag>{columns.find((x) => x.id === p.status)?.name ?? ''}</Tag>;
  if (c.id === 'blocked')
    return p.blocked ? (
      <div className="blocked-cell">
        <strong>⛔ Blocked</strong>
        {p.blockedReason && <div>{p.blockedReason}</div>}
      </div>
    ) : null;
  if (c.id === 'subtasks') {
    const { done, total } = p.subtasks;
    if (!total) return null;
    return (
      <div className="list-progress" title={`${done} of ${total} subtasks done`}>
        <div className="bar">
          <div style={{ width: `${(done / total) * 100}%` }} />
        </div>
        <span>
          {done}/{total}
        </span>
      </div>
    );
  }
  if (c.id === 'updated') return p.updated ? formatDate(p.updated) : null;
  return (
    <div className="cell-values">
      <PropertyValue def={c.def} value={p.properties[c.def.key]} showLabel={false} />
    </div>
  );
}
