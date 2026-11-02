import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { describeFilters, filterFields, matches } from '../filters.js';
import { usePhone } from '../usePhone.js';
import FilterBar from './FilterBar.jsx';
import Popover from './Popover.jsx';
import { CardMeta, PropertyValue, Tag, formatDate, formatDateTime, isEmpty, timeAgo, toPeople } from './props.jsx';

const POLL_MS = 10000;

// What the list shows (and so what CSV and print include), remembered in this browser.
const VIEW_KEY = 'clique-list-view';
const DEFAULT_VIEW = { hidden: [], todos: true, doneTodos: true, todoOwners: true };
function useListView() {
  const [view, setView] = useState(() => {
    try {
      return { ...DEFAULT_VIEW, ...JSON.parse(localStorage.getItem(VIEW_KEY)) };
    } catch {
      return DEFAULT_VIEW;
    }
  });
  const update = (fields) =>
    setView((v) => {
      const next = { ...v, ...fields };
      try {
        localStorage.setItem(VIEW_KEY, JSON.stringify(next));
      } catch {
        // storage unavailable; the choice just won't be remembered
      }
      return next;
    });
  return [view, update];
}

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

export default function ListView({ workspace, filters, onFilters }) {
  const [projects, setProjects] = useState(null);
  const [query, setQuery] = useState('');
  const [view, setView] = useListView();
  const [sort, setSort] = useState({ id: 'status', dir: 1 });
  const [columnsOpen, setColumnsOpen] = useState(false);
  const columnsRef = useRef(null);
  const phone = usePhone();

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
  const groupName = (p) => workspace.groups.find((g) => g.id === p.group)?.name ?? '';
  const progress = (p) => (p.subtasks.total ? p.subtasks.done / p.subtasks.total : null);

  const allColumns = useMemo(
    () => [
      { id: 'title', label: 'Project', sort: (p) => p.title.toLowerCase(), text: (p) => p.title },
      { id: 'status', label: 'Status', sort: statusIndex, text: statusName },
      ...(workspace.groups.length ? [{ id: 'group', label: 'Group', sort: (p) => groupName(p).toLowerCase(), text: groupName }] : []),
      {
        id: 'blocked',
        label: 'Blocked',
        sort: (p) => (p.blocked ? 0 : 1),
        text: (p) => (p.blocked ? 'Yes' : ''),
        reason: (p) => p.blockedReason,
        reasonLabel: 'Blocked reason',
      },
      {
        id: 'maintenance',
        label: 'Maintenance',
        sort: (p) => (p.maintenance ? 0 : 1),
        text: (p) => (p.maintenance ? 'Yes' : ''),
        reason: (p) => p.maintenanceReason,
        reasonLabel: 'Maintenance reason',
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
        label: 'Tasks',
        sort: progress,
        text: (p) => (p.subtasks.total ? `${p.subtasks.done}/${p.subtasks.total}` : ''),
      },
      {
        id: 'latest',
        label: 'Latest update',
        sort: (p) => p.latestUpdate?.at ?? '',
        text: (p) => p.latestUpdate?.text ?? '',
        extra: (p) => [p.latestUpdate?.author ?? '', p.latestUpdate?.at?.slice(0, 10) ?? ''],
      },
      { id: 'updated', label: 'Updated', sort: (p) => p.updated ?? '', text: (p) => (p.updated ?? '').slice(0, 10) },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workspace],
  );
  // The project name is always shown; everything else can be hidden.
  const columns = useMemo(() => allColumns.filter((c) => c.id === 'title' || !view.hidden.includes(c.id)), [allColumns, view.hidden]);
  const fields = useMemo(() => filterFields(workspace, projects ?? []), [workspace, projects]);
  const todosOf = (p) => (view.doneTodos ? (p.subtasks.items ?? []) : (p.subtasks.items ?? []).filter((t) => !t.done));

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const col = columns.find((c) => c.id === sort.id) ?? columns[0];
    const list = (projects ?? []).filter((p) => (!q || allColumns.some((c) => c.text(p).toLowerCase().includes(q))) && matches(p, filters, fields));
    // Empty values always sort last, whichever direction is chosen.
    return list.sort((a, b) => {
      const x = col.sort(a);
      const y = col.sort(b);
      const xe = x === null || x === undefined || x === '';
      const ye = y === null || y === undefined || y === '';
      if (xe || ye) return xe === ye ? 0 : xe ? 1 : -1;
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir || a.title.localeCompare(b.title);
    });
  }, [projects, columns, allColumns, query, filters, fields, sort]);

  function exportCsv() {
    const header = [];
    for (const c of columns) {
      header.push(c.label);
      if (c.reason) header.push(c.reasonLabel);
      if (c.id === 'subtasks') header.push('Tasks done', 'Tasks total', 'Progress');
      if (c.extra) header.push('Latest update by', 'Latest update date');
    }
    if (view.todos) header.push('Task', 'Task status', ...(view.todoOwners ? ['Task owners'] : []));
    const lines = [header.map((h) => csvCell(h, false))];
    for (const p of rows) {
      const cells = [];
      for (const c of columns) {
        const numeric = c.def?.type === 'number' || c.def?.type === 'date' || c.id === 'updated';
        cells.push(csvCell(c.text(p), !numeric));
        if (c.reason) cells.push(csvCell(c.reason(p)));
        if (c.extra) cells.push(...c.extra(p).map((v) => csvCell(v)));
        if (c.id === 'subtasks') {
          const pr = progress(p);
          cells.push(p.subtasks.done, p.subtasks.total, pr === null ? '' : `${Math.round(pr * 100)}%`);
        }
      }
      // With to-dos on, each to-do gets its own row that repeats the project columns,
      // so the file can be filtered and pivoted by project. A project without to-dos is one row.
      const items = view.todos ? todosOf(p) : [];
      const todoCells = (t) => [csvCell(t.text), t.done ? 'Done' : 'Open', ...(view.todoOwners ? [csvCell(toPeople(t.owners).join(', '))] : [])];
      if (!view.todos) lines.push(cells);
      else if (items.length === 0) lines.push([...cells, ...todoCells({ text: '' }).map(() => '')]);
      else for (const t of items) lines.push([...cells, ...todoCells(t)]);
    }
    const day = new Date().toISOString().slice(0, 10);
    download(`clique-projects-${day}.csv`, lines.map((l) => l.join(',')).join('\r\n') + '\r\n');
  }

  if (!projects) return <div className="loading">Loading…</div>;

  const blockedCount = projects.filter((p) => p.blocked).length;

  if (phone) {
    return (
      <div className="list-wrap phone-list">
        <div className="phone-list-tools">
          <input className="search" type="search" aria-label="Search projects" placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <FilterBar fields={fields} projects={projects} filters={filters} onChange={onFilters} />
          <div className="phone-list-sort">
            <span className="muted small">
              {rows.length === projects.length ? `${projects.length} projects` : `${rows.length} of ${projects.length} projects`}
              {blockedCount > 0 && ` · ${blockedCount} blocked`}
            </span>
            <span className="spacer" />
            <select aria-label="Sort by" value={sort.id} onChange={(e) => setSort({ id: e.target.value, dir: 1 })}>
              {columns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <button className="icon" aria-label={sort.dir === 1 ? 'Sorted ascending, switch to descending' : 'Sorted descending, switch to ascending'} onClick={() => setSort((s) => ({ ...s, dir: -s.dir }))}>
              {sort.dir === 1 ? '▲' : '▼'}
            </button>
          </div>
        </div>
        <ul className="phone-rows">
          {rows.map((p) => (
            <PhoneRow key={p.id} project={p} workspace={workspace} status={statusName(p)} />
          ))}
          {rows.length === 0 && <li className="muted empty">No projects match.</li>}
        </ul>
        <button className="toolbar-btn phone-export" onClick={exportCsv} disabled={rows.length === 0}>
          Export CSV
        </button>
      </div>
    );
  }

  return (
    <div className="list-wrap">
      <div className="board-toolbar list-toolbar">
        <input className="search" placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <FilterBar fields={fields} projects={projects} filters={filters} onChange={onFilters} />
        <span className="muted">
          {rows.length === projects.length ? `${projects.length} projects` : `${rows.length} of ${projects.length} projects`}
          {blockedCount > 0 && ` · ${blockedCount} blocked`}
        </span>
        <span className="spacer" />
        <span className="filter-anchor">
          <button ref={columnsRef} className="toolbar-btn" onClick={() => setColumnsOpen((o) => !o)} aria-expanded={columnsOpen}>
            Columns{view.hidden.length > 0 && ` (${columns.length}/${allColumns.length})`} ▾
          </button>
          {columnsOpen && (
            <Popover anchor={columnsRef} onClose={() => setColumnsOpen(false)} align="right" className="columns-menu">
              <div className="popover-label">Columns</div>
              <p className="muted small popover-note">What's shown here is also what Export CSV and Print include.</p>
              {allColumns.map((c) => (
                <label key={c.id} className={`popover-item check ${c.id === 'title' ? 'muted' : ''}`}>
                  <input
                    type="checkbox"
                    disabled={c.id === 'title'}
                    checked={c.id === 'title' || !view.hidden.includes(c.id)}
                    onChange={(e) => setView({ hidden: e.target.checked ? view.hidden.filter((h) => h !== c.id) : [...view.hidden, c.id] })}
                  />
                  {c.label}
                </label>
              ))}
              <div className="popover-label">Tasks</div>
              <label className="popover-item check">
                <input type="checkbox" checked={view.todos} onChange={(e) => setView({ todos: e.target.checked })} />
                List tasks under each project
              </label>
              <label className={`popover-item check ${view.todos ? '' : 'muted'}`}>
                <input type="checkbox" disabled={!view.todos} checked={view.doneTodos} onChange={(e) => setView({ doneTodos: e.target.checked })} />
                Include finished tasks
              </label>
              <label className={`popover-item check ${view.todos ? '' : 'muted'}`}>
                <input type="checkbox" disabled={!view.todos} checked={view.todoOwners} onChange={(e) => setView({ todoOwners: e.target.checked })} />
                Show task owners
              </label>
              <div className="popover-foot">
                <button className="link" onClick={() => setView(DEFAULT_VIEW)}>
                  Show everything
                </button>
              </div>
            </Popover>
          )}
        </span>
        <button onClick={() => window.print()}>Print / PDF</button>
        <button className="primary" onClick={exportCsv} disabled={rows.length === 0}>
          Export CSV
        </button>
      </div>
      {describeFilters(filters, fields) && <p className="muted small print-only print-filters">Filtered to {describeFilters(filters, fields)}</p>}
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
            {rows.map((p) => {
              const todos = view.todos ? todosOf(p) : [];
              return (
                <Fragment key={p.id}>
                  <tr className={`project-row ${p.blocked ? 'blocked' : ''} ${p.maintenance ? 'maintenance' : ''} ${todos.length ? 'has-subtasks' : ''}`}>
                    {columns.map((c) => (
                      <td key={c.id} className={`col-${c.id.replace(/\W/g, '-')}`}>
                        <Cell c={c} p={p} workspace={workspace} />
                      </td>
                    ))}
                  </tr>
                  {todos.length > 0 && (
                    <tr className="subtask-row">
                      <td colSpan={columns.length}>
                        <ul className="list-subtasks">
                          {todos.map((t, i) => (
                            <li key={i} className={t.done ? 'done' : ''}>
                              <span className="box" aria-label={t.done ? 'Done' : 'Open'}>
                                {t.done ? '☑' : '☐'}
                              </span>
                              <span className="text">{t.text}</span>
                              {view.todoOwners && toPeople(t.owners).map((n) => <Tag key={n}>{n}</Tag>)}
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
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

function PhoneRow({ project, workspace, status }) {
  const { done, total } = project.subtasks;
  return (
    <li className={`phone-row-item ${project.blocked ? 'blocked' : ''}`}>
      <a href={`#/p/${encodeURIComponent(project.id)}`}>
        <div className="phone-row-top">
          <span className="phone-row-title">{project.title}</span>
          {total > 0 && (
            <span className="muted small">
              {done}/{total}
            </span>
          )}
        </div>
        {project.blocked && (
          <div className="card-blocked">
            <strong>⛔ Blocked</strong>
            {project.blockedReason && <span>: {project.blockedReason}</span>}
          </div>
        )}
        {project.maintenance && (
          <div className="card-maintenance">
            <strong>🔧 In maintenance</strong>
            {project.maintenanceReason && <span>: {project.maintenanceReason}</span>}
          </div>
        )}
        <div className="phone-row-meta">
          <Tag>{status}</Tag>
          <CardMeta project={project} workspace={workspace} />
        </div>
      </a>
    </li>
  );
}

function Cell({ c, p, workspace }) {
  if (c.id === 'title') return <a href={`#/p/${encodeURIComponent(p.id)}`}>{p.title}</a>;
  if (c.id === 'status') return <Tag>{workspace.columns.find((x) => x.id === p.status)?.name ?? ''}</Tag>;
  if (c.id === 'group') return c.text(p);
  if (c.id === 'blocked')
    return p.blocked ? (
      <div className="blocked-cell">
        <strong>⛔ Blocked</strong>
        {p.blockedReason && <div>{p.blockedReason}</div>}
      </div>
    ) : null;
  if (c.id === 'maintenance')
    return p.maintenance ? (
      <div className="maintenance-cell">
        <strong>🔧 In maintenance</strong>
        {p.maintenanceReason && <div>{p.maintenanceReason}</div>}
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
  if (c.id === 'latest') {
    const u = p.latestUpdate;
    if (!u) return null;
    return (
      <div className="latest-update" title={formatDateTime(u.at)}>
        <div>{u.text}</div>
        <div className="muted small">{[u.author, timeAgo(u.at)].filter(Boolean).join(' · ')}</div>
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
