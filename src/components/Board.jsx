import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { navigate } from '../App.jsx';
import { PropertyValue, formatDateTime, isEmpty, timeAgo } from './props.jsx';

const POLL_MS = 10000;

export default function Board({ workspace }) {
  const [projects, setProjects] = useState(null);
  const [query, setQuery] = useState('');
  const [drag, setDrag] = useState(null); // { id, over: { status, index } }
  const [adding, setAdding] = useState(null); // column id with the "new project" input open

  const load = useCallback(() => api.projects().then(setProjects).catch(() => {}), []);

  // Everyone edits the same board, so refresh periodically and when the tab regains focus.
  useEffect(() => {
    load();
    const t = setInterval(() => document.visibilityState === 'visible' && load(), POLL_MS);
    window.addEventListener('focus', load);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', load);
    };
  }, [load]);

  const columns = useMemo(() => {
    const cols = workspace.columns.map((c) => ({ ...c, items: [] }));
    const q = query.trim().toLowerCase();
    for (const p of projects ?? []) {
      if (q && !p.title.toLowerCase().includes(q)) continue;
      cols.find((c) => c.id === p.status)?.items.push(p);
    }
    for (const c of cols) c.items.sort((a, b) => a.order - b.order);
    return cols;
  }, [workspace.columns, projects, query]);

  async function drop(status) {
    if (!drag?.over) return setDrag(null);
    const col = columns.find((c) => c.id === status);
    const ids = col.items.map((p) => p.id).filter((id) => id !== drag.id);
    // When reordering inside the same column, the dragged card's old slot shifts the index.
    let index = drag.over.index;
    const oldIndex = col.items.findIndex((p) => p.id === drag.id);
    if (oldIndex !== -1 && oldIndex < index) index--;
    ids.splice(index, 0, drag.id);
    setDrag(null);

    // Optimistic update, then persist.
    setProjects((prev) =>
      prev.map((p) => {
        const i = ids.indexOf(p.id);
        return i === -1 ? p : { ...p, status, order: i };
      }),
    );
    try {
      await api.reorder(status, ids);
    } finally {
      load();
    }
  }

  async function create(status, title) {
    setAdding(null);
    if (!title.trim()) return;
    const p = await api.createProject({ title, status });
    navigate(`#/p/${encodeURIComponent(p.id)}`);
  }

  if (!projects) return <div className="loading">Loading…</div>;

  return (
    <div className="board-wrap">
      <div className="board-toolbar">
        <input className="search" placeholder="Filter projects…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <span className="muted">{projects.length} projects</span>
      </div>
      <div className="board">
        {columns.map((col) => (
          <section
            key={col.id}
            className={`column ${drag?.over?.status === col.id ? 'drag-over' : ''}`}
            onDragOver={(e) => {
              if (!drag) return;
              e.preventDefault();
              // Dropping on empty space in a column appends to the end.
              if (e.target === e.currentTarget || e.target.classList.contains('cards'))
                setDrag((d) => ({ ...d, over: { status: col.id, index: col.items.length } }));
            }}
            onDrop={(e) => {
              e.preventDefault();
              drop(col.id);
            }}
          >
            <header className="column-head">
              <span>{col.name}</span>
              <span className="count">{col.items.length}</span>
            </header>
            <div className="cards">
              {col.items.map((p, i) => (
                <Card
                  key={p.id}
                  project={p}
                  workspace={workspace}
                  dragging={drag?.id === p.id}
                  dropBefore={drag?.over?.status === col.id && drag.over.index === i}
                  onDragStart={() => setDrag({ id: p.id, over: null })}
                  onDragEnd={() => setDrag(null)}
                  onDragOverCard={(after) => {
                    setDrag((d) => d && { ...d, over: { status: col.id, index: after ? i + 1 : i } });
                  }}
                />
              ))}
              {drag?.over?.status === col.id && drag.over.index === col.items.length && <div className="drop-marker" />}
            </div>
            {adding === col.id ? (
              <NewCardInput onDone={(title) => create(col.id, title)} />
            ) : (
              <button className="add-card" onClick={() => setAdding(col.id)}>
                + New project
              </button>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function Card({ project, workspace, dragging, dropBefore, onDragStart, onDragEnd, onDragOverCard }) {
  const { subtasks } = project;
  return (
    <>
      {dropBefore && <div className="drop-marker" />}
      <a
        className={`card ${project.blocked ? 'blocked' : ''} ${project.maintenance ? 'maintenance' : ''} ${dragging ? 'dragging' : ''}`}
        href={`#/p/${encodeURIComponent(project.id)}`}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', project.id);
          onDragStart();
        }}
        onDragEnd={onDragEnd}
        onDragOver={(e) => {
          e.preventDefault();
          const r = e.currentTarget.getBoundingClientRect();
          onDragOverCard(e.clientY > r.top + r.height / 2);
        }}
      >
        <div className="card-title">{project.title}</div>
        {project.blocked && (
          <div className="card-blocked">
            <strong>⛔ Blocked</strong>
            {project.blockedReason && <span>: {project.blockedReason}</span>}
          </div>
        )}
        {project.maintenance && (
          <div className="card-maintenance">
            <strong>🔧 In maintenance</strong>
          </div>
        )}
        <div className="card-props">
          {workspace.properties
            .filter((def) => !isEmpty(project.properties[def.key]) && project.properties[def.key] !== false)
            .map((def) => (
              <div className="card-prop" key={def.key}>
                <span className="card-prop-label">{def.name}</span>
                <span className="card-prop-value">
                  <PropertyValue def={def} value={project.properties[def.key]} showLabel={false} />
                </span>
              </div>
            ))}
        </div>
        {project.latestUpdate && (
          <div className="card-update" title={formatDateTime(project.latestUpdate.at)}>
            <div className="card-update-text">{project.latestUpdate.text}</div>
            <div className="card-update-meta">
              {[project.latestUpdate.author, timeAgo(project.latestUpdate.at)].filter(Boolean).join(' · ')}
            </div>
          </div>
        )}
        {subtasks.total > 0 && (
          <div className="card-progress" title={`${subtasks.done} of ${subtasks.total} to-dos done`}>
            <div className="bar">
              <div style={{ width: `${(subtasks.done / subtasks.total) * 100}%` }} />
            </div>
            <span>
              {subtasks.done}/{subtasks.total}
            </span>
          </div>
        )}
      </a>
    </>
  );
}

function NewCardInput({ onDone }) {
  const ref = useRef(null);
  const done = useRef(false);
  const finish = (v) => {
    if (done.current) return;
    done.current = true;
    onDone(v);
  };
  return (
    <input
      ref={ref}
      autoFocus
      className="new-card"
      placeholder="Project name, then Enter"
      onKeyDown={(e) => {
        if (e.key === 'Enter') finish(e.currentTarget.value);
        if (e.key === 'Escape') finish('');
      }}
      onBlur={(e) => finish(e.currentTarget.value)}
    />
  );
}
