import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { navigate } from '../App.jsx';
import { Tag, formatDateTime, timeAgo } from './props.jsx';
import ScheduleButton from './ScheduleButton.jsx';
import { AddNotes, IssueLink, TodoDoc, TodoIssue } from './TodoLinks.jsx';
import { findTodo, todosFor, withTodo, workdayPeople } from './workday.js';

const POLL_MS = 30000;
const PERSON_KEY = 'clique-workday-person';

function rememberedPerson() {
  try {
    return localStorage.getItem(PERSON_KEY);
  } catch {
    return null;
  }
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

// One person's to-dos from every project, for planning a day. `person` comes from the link, so a
// page can be bookmarked; a bare link opens on whoever this browser last picked.
export default function WorkdayView({ workspace, person }) {
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState(null);
  const [failed, setFailed] = useState(null);
  const changing = useRef(false);

  const load = useCallback(
    () =>
      api.projects({ subtasks: true }).then(
        (p) => {
          setProjects(p);
          setError(null);
        },
        setError,
      ),
    [],
  );

  useEffect(() => {
    load();
    const t = setInterval(() => document.visibilityState === 'visible' && load(), POLL_MS);
    window.addEventListener('focus', load);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', load);
    };
  }, [load]);

  // To-dos are saved as a whole list and this page's copy can be 30 seconds old, so a change starts
  // from the project as it is now. Saving the copy could undo someone's edit on the project page.
  async function change(todo, apply) {
    if (changing.current) return;
    changing.current = true;
    setFailed(null);
    try {
      const { subtasks } = await api.project(todo.project.id);
      const index = findTodo(subtasks, todo.text);
      if (index < 0) throw new Error('This to-do has changed, or another has the same text. Refresh, or use the project page.');
      await apply(subtasks, index);
    } catch (e) {
      setFailed({ key: todo.key, message: e.message });
    } finally {
      changing.current = false;
      load();
    }
  }

  function setIssue(todo, issue) {
    return change(todo, (subtasks, index) => api.updateProject(todo.project.id, { subtasks: withTodo(subtasks, index, { issue }) }));
  }

  // Notes someone has added since this page last loaded are opened, rather than a second page made.
  function openNotes(todo) {
    const { id } = todo.project;
    return change(todo, async (subtasks, index) => {
      let { doc } = subtasks[index];
      if (!doc) {
        doc = (await api.createPage(id, { title: subtasks[index].text })).id;
        await api.updateProject(id, { subtasks: withTodo(subtasks, index, { doc }) });
      }
      navigate(`#/p/${encodeURIComponent(id)}/${encodeURIComponent(doc)}`);
    });
  }

  function pick(name) {
    try {
      if (name) localStorage.setItem(PERSON_KEY, name);
      else localStorage.removeItem(PERSON_KEY);
    } catch {
      // storage unavailable; the choice just won't be remembered
    }
    navigate(name ? `#/workday/${encodeURIComponent(name)}` : '#/workday');
  }

  if (error && !projects) return <div className="banner error">Could not load the to-dos: {error.message}</div>;
  if (!projects) return <div className="loading">Loading…</div>;

  const people = workdayPeople(workspace, projects);
  const wanted = (person ?? rememberedPerson() ?? '').toLowerCase();
  const current = people.find((n) => n.toLowerCase() === wanted) ?? '';
  const { open, done } = current ? todosFor(current, projects, workspace) : { open: [], done: [] };
  const projectCount = new Set(open.map((t) => t.project.id)).size;

  return (
    <div className="settings workday">
      <h2>Workday</h2>
      <div className="workday-picker">
        <label htmlFor="workday-person">Person</label>
        <select id="workday-person" value={current} onChange={(e) => pick(e.target.value)}>
          <option value="">Choose a person</option>
          {people.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        {current && (
          <span className="muted small">
            {plural(open.length, 'open to-do')} across {plural(projectCount, 'project')}
          </span>
        )}
      </div>

      {!current && <p className="muted">Pick a person to see their to-dos from every project.</p>}
      {current && open.length === 0 && <p className="muted">{current} has no open to-dos.</p>}

      {open.length > 0 && (
        <ul className="workday-list">
          {open.map((t) => (
            <WorkdayTodo key={t.key} todo={t} workspace={workspace} error={failed?.key === t.key ? failed.message : null} onAddNotes={openNotes} onIssue={setIssue} />
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <details className="subtask-history">
          <summary>Done ({done.length})</summary>
          <ul className="workday-list">
            {done.map((t) => (
              <WorkdayTodo key={t.key} todo={t} workspace={workspace} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function WorkdayTodo({ todo, workspace, error, onAddNotes, onIssue }) {
  const { project } = todo;
  const projectLink = `#/p/${encodeURIComponent(project.id)}`;
  const projectUrl = `${window.location.href.split('#')[0]}${projectLink}`;
  return (
    <li className={`workday-todo ${todo.done ? 'done' : ''}`}>
      <div className="workday-text">{todo.text}</div>
      <div className="workday-meta">
        <a href={`#/p/${encodeURIComponent(project.id)}`}>{project.title}</a>
        <span>{workspace.columns.find((c) => c.id === project.status)?.name}</span>
        {todo.doneAt && <span title={formatDateTime(todo.doneAt)}>{timeAgo(todo.doneAt)}</span>}
        {todo.potentialBlocker && <Tag color="orange">Potential blocker</Tag>}
      </div>
      {todo.potentialBlocker && project.blockedReason && <div className="workday-reason">Project blocked: {project.blockedReason}</div>}
      {todo.done ? (
        <div className="workday-actions">
          {todo.doc && <TodoDoc page={{ id: todo.doc, title: todo.text }} base={projectLink} />}
          {todo.issue && <IssueLink url={todo.issue} repos={project.repos} />}
        </div>
      ) : (
        <div className="workday-actions">
          {/* Events and issues link to the to-do's project, which this person can act on, not to this list. */}
          <ScheduleButton text={todo.text} owners={todo.owners} projectTitle={project.title} url={projectUrl} />
          {todo.doc ? <TodoDoc page={{ id: todo.doc, title: todo.text }} base={projectLink} /> : <AddNotes onClick={() => onAddNotes(todo)} />}
          <TodoIssue issue={todo.issue} repos={project.repos} text={todo.text} owners={todo.owners} projectTitle={project.title} url={projectUrl} onChange={(issue) => onIssue(todo, issue)} />
        </div>
      )}
      {error && (
        <div className="workday-error" role="alert">
          {error}
        </div>
      )}
    </li>
  );
}
