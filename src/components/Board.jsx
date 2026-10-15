import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { navigate } from '../App.jsx';
import { PropertyValue } from './props.jsx';

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
    const known = new Set(workspace.columns.map((c) => c.id));
    const cols = workspace.columns.map((c) => ({ ...c, items: [] }));
    const orphans = { id: '__none', name: 'No status', items: [], orphan: true };
    const q = query.trim().toLowerCase();
    for (const p of projects ?? []) {
      if (q && !p.title.toLowerCase().includes(q)) continue;
      (known.has(p.status) ? cols.find((c) => c.id === p.status) : orphans).items.push(p);
    }
    for (const c of cols) c.items.sort((a, b) => a.order - b.order);
    return orphans.items.length ? [...cols, orphans] : cols;
  }, [workspace.columns, projects, query]);

  async function drop(status) {
    if (!drag?.over || status === '__none') return setDrag(null);
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
              if (!drag || col.orphan) return;
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
                    if (col.orphan) return;
                    setDrag((d) => d && { ...d, over: { status: col.id, index: after ? i + 1 : i } });
                  }}
                />
              ))}
              {drag?.over?.status === col.id && drag.over.index === col.items.length && <div className="drop-marker" />}
            </div>
            {!col.orphan &&
              (adding === col.id ? (
                <NewCardInput onDone={(title) => create(col.id, title)} />
              ) : (
                <button className="add-card" onClick={() => setAdding(col.id)}>
                  + New project
                </button>
              ))}
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
        className={`card ${dragging ? 'dragging' : ''}`}
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
        <div className="card-props">
          {workspace.properties.map((def) => (
            <PropertyValue key={def.key} def={def} value={project.properties[def.key]} />
          ))}
        </div>
        {subtasks.total > 0 && (
          <div className="card-progress" title={`${subtasks.done} of ${subtasks.total} subtasks done`}>
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
