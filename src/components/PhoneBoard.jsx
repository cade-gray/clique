import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { paneAt } from './phone.js';
import { CardMeta } from './props.jsx';
import Sheet from './Sheet.jsx';

// The screen forgets its state when a project is opened, so the stage and how far each stage was
// scrolled are kept here for the way back.
const memory = { stage: null, tops: {} };

// The board on a phone: one stage fills the screen, and a swipe or the strip of stage names moves
// between them. Cards are shorter than on desktop, and moving one happens in a sheet, because
// browsers on phones don't start a drag from a touch.
export default function PhoneBoard({ workspace, columns, projects, perspectiveBar, shownCount, query, onQuery, filterBar, filtersActive, defaultGroup, onCreate, onPlace }) {
  const [stage, setStage] = useState(memory.stage);
  const [searching, setSearching] = useState(Boolean(query));
  const [filtering, setFiltering] = useState(filtersActive);
  const [movingId, setMovingId] = useState(null);
  const [adding, setAdding] = useState(false);
  const panes = useRef(null);
  const activeTab = useRef(null);

  const current = columns.find((c) => c.id === stage) ?? columns[0];
  const columnKey = columns.map((c) => c.id).join();
  const moving = projects.find((p) => p.id === movingId);

  // Put back the stage and scroll positions without animating, also when a filter changes the stages.
  useLayoutEffect(() => {
    const el = panes.current;
    if (!el) return;
    el.scrollLeft = columns.indexOf(current) * el.clientWidth;
    [...el.children].forEach((pane, i) => {
      pane.scrollTop = memory.tops[columns[i].id] ?? 0;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnKey]);

  useEffect(() => {
    activeTab.current?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [current?.id]);

  function onSwipe(e) {
    const el = e.currentTarget;
    const id = columns[paneAt(el.scrollLeft, el.clientWidth, columns.length)]?.id;
    if (id && id !== current?.id) {
      memory.stage = id;
      setStage(id);
    }
  }

  function showStage(i) {
    const el = panes.current;
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  }

  return (
    <div className="phone-board">
      <header className="phone-head">
        <h1>Clique</h1>
        <button className={`icon ${searching ? 'on' : ''}`} aria-label="Search titles" aria-expanded={searching} onClick={() => setSearching((s) => !s)}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.8-3.8" />
          </svg>
        </button>
        <button className={`icon ${filtering ? 'on' : ''}`} aria-label={filtersActive ? 'Filter, filters on' : 'Filter'} aria-expanded={filtering} onClick={() => setFiltering((f) => !f)}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
          {filtersActive && <span className="dot accent" />}
        </button>
        <button className="icon" aria-label="New project" onClick={() => setAdding(true)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </header>
      {perspectiveBar}
      {searching && (
        <div className="phone-row">
          <input className="search" type="search" autoFocus aria-label="Search titles" placeholder="Search titles…" value={query} onChange={(e) => onQuery(e.target.value)} />
        </div>
      )}
      {filtering && (
        <div className="phone-row">
          {filterBar}
          <span className="muted small">{shownCount === projects.length ? `${projects.length} projects` : `${shownCount} of ${projects.length} projects`}</span>
        </div>
      )}
      <nav className="stage-strip" aria-label="Stages">
        {columns.map((c, i) => (
          <button key={c.id} ref={c === current ? activeTab : null} className={c === current ? 'active' : ''} aria-current={c === current ? 'true' : undefined} onClick={() => showStage(i)}>
            {c.name} <span className="count">{c.items.length}</span>
            {c.items.some((p) => p.blocked) && <span className="dot" role="img" aria-label="has a blocked project" />}
          </button>
        ))}
      </nav>
      <div className="stage-panes" ref={panes} onScroll={onSwipe}>
        {columns.map((c) => (
          <section key={c.id} className="stage-pane" aria-label={c.name} onScroll={(e) => (memory.tops[c.id] = e.currentTarget.scrollTop)}>
            {c.items.map((p) => (
              <PhoneCard key={p.id} project={p} workspace={workspace} onMove={() => setMovingId(p.id)} />
            ))}
            {c.items.length === 0 && <p className="muted stage-empty">No projects in this stage.</p>}
          </section>
        ))}
      </div>
      {moving && <MoveSheet project={moving} workspace={workspace} columns={columns} projects={projects} onPlace={onPlace} onClose={() => setMovingId(null)} />}
      {adding && (
        <NewProjectSheet
          workspace={workspace}
          defaultStage={current?.id}
          defaultGroup={defaultGroup}
          onCreate={(status, title, group) => {
            setAdding(false);
            onCreate(status, title, group);
          }}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}

function PhoneCard({ project, workspace, onMove }) {
  const { subtasks } = project;
  return (
    <div className={`card phone-card ${project.blocked ? 'blocked' : ''} ${project.maintenance ? 'maintenance' : ''}`}>
      <a className="phone-card-link" href={`#/p/${encodeURIComponent(project.id)}`}>
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
            {project.maintenanceReason && <span>: {project.maintenanceReason}</span>}
          </div>
        )}
        <CardMeta project={project} workspace={workspace} />
        {subtasks.total > 0 && (
          <div className="card-progress">
            <div className="bar">
              <div style={{ width: `${(subtasks.done / subtasks.total) * 100}%` }} />
            </div>
            <span>
              {subtasks.done}/{subtasks.total}
            </span>
          </div>
        )}
      </a>
      <button className="icon phone-card-more" aria-label={`Move ${project.title}`} onClick={onMove}>
        ⋯
      </button>
    </div>
  );
}

// One row per stage with the current one ticked; also used from the project page.
export function StagePicker({ columns, projects, current, onPick }) {
  return (
    <div className="stage-picker">
      {columns.map((c) => (
        <button key={c.id} aria-pressed={c.id === current} className={c.id === current ? 'active' : ''} onClick={() => c.id !== current && onPick(c.id)}>
          <span>{c.name}</span>
          {projects && <span className="muted small">{projects.filter((p) => p.status === c.id).length}</span>}
          <span className="tick" aria-hidden="true">
            {c.id === current && '✓'}
          </span>
        </button>
      ))}
    </div>
  );
}

function MoveSheet({ project, workspace, columns, projects, onPlace, onClose }) {
  // Positions count the cards on screen, so a filter can't make Move up look like it did nothing.
  const siblings = columns.find((c) => c.id === project.status)?.items ?? [];
  const pos = siblings.findIndex((p) => p.id === project.id);
  return (
    <Sheet title={project.title} onClose={onClose}>
      <p className="muted small sheet-label">Move to stage</p>
      <StagePicker columns={workspace.columns} projects={projects} current={project.status} onPick={(status) => onPlace(project.id, status, Infinity)} />
      {pos !== -1 && siblings.length > 1 && (
        <>
          <p className="muted small sheet-label">
            Position in stage: {pos + 1} of {siblings.length}
          </p>
          <div className="sheet-pair">
            <button className="toolbar-btn" disabled={pos === 0} onClick={() => onPlace(project.id, project.status, pos - 1)}>
              Move up
            </button>
            <button className="toolbar-btn" disabled={pos === siblings.length - 1} onClick={() => onPlace(project.id, project.status, pos + 1)}>
              Move down
            </button>
          </div>
        </>
      )}
      <a className="primary sheet-action" href={`#/p/${encodeURIComponent(project.id)}`}>
        Open project
      </a>
    </Sheet>
  );
}

function NewProjectSheet({ workspace, defaultStage, defaultGroup, onCreate, onClose }) {
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState(defaultStage ?? workspace.columns[0]?.id);
  const [group, setGroup] = useState(defaultGroup);
  return (
    <Sheet title="New project" onClose={onClose}>
      <form
        className="sheet-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) onCreate(status, title, group);
        }}
      >
        <label>
          Project name
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} enterKeyHint="done" />
        </label>
        <label>
          Stage
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {workspace.columns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {workspace.groups.length > 0 && (
          <label>
            Group
            <select value={group} onChange={(e) => setGroup(e.target.value)}>
              <option value="">No group</option>
              {workspace.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button className="primary sheet-action" disabled={!title.trim()}>
          Create project
        </button>
      </form>
    </Sheet>
  );
}
