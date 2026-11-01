import { useCallback, useEffect, useRef, useState } from 'react';
import { api, LIVE_STATUS } from '../api.js';
import { navigate } from '../App.jsx';
import { usePhone } from '../usePhone.js';
import DocBody from './DocBody.jsx';
import { repoPath } from './github.js';
import { splitPages, todoOf } from './pages.js';
import { StagePicker } from './PhoneBoard.jsx';
import Sheet from './Sheet.jsx';
import Subtasks from './Subtasks.jsx';
import Updates from './Updates.jsx';
import { CardMeta, PeopleContext, PropertyInput, fitToContent, toPeople } from './props.jsx';

export default function ProjectView({ id, pageId, workspace }) {
  const [project, setProject] = useState(null);
  const [error, setError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const addingDoc = useRef(false);
  const phone = usePhone();

  const load = useCallback(
    () =>
      api.project(id).then(
        (p) => {
          setProject(p);
          setError(null);
        },
        (e) => setError(e),
      ),
    [id],
  );
  useEffect(() => {
    load();
  }, [load]);

  // Metadata edits (title, status, properties, to-dos) save immediately and never touch the body.
  async function patch(fields) {
    setProject((p) => ({
      ...p,
      ...fields,
      properties: fields.properties ? { ...p.properties, ...fields.properties } : p.properties,
    }));
    try {
      const { body: _b, version: _v, ...meta } = await api.updateProject(id, fields);
      setProject((p) => ({ ...p, ...meta }));
      setSaveError(null);
    } catch (e) {
      // Say so and reload, so the page never shows a change the server didn't keep.
      setSaveError(`That change was not saved: ${e.message}`);
      load();
    }
  }

  async function addPage() {
    const title = window.prompt('Page title');
    if (!title?.trim()) return;
    const page = await api.createPage(id, { title });
    await load();
    navigate(`#/p/${encodeURIComponent(id)}/${encodeURIComponent(page.id)}`);
  }

  // To-do notes are an ordinary page named after the to-do, with its id on the to-do. If the second
  // step fails, the page is still there, in the wiki. The guard stops a double click making two.
  async function addTodoDoc(index) {
    if (addingDoc.current) return;
    addingDoc.current = true;
    try {
      const page = await api.createPage(id, { title: project.subtasks[index].text });
      await patch({ subtasks: project.subtasks.map((s, i) => (i === index ? { ...s, doc: page.id } : s)) });
      navigate(`#/p/${encodeURIComponent(id)}/${encodeURIComponent(page.id)}`);
    } catch (e) {
      setSaveError(`The notes were not created: ${e.message}`);
    } finally {
      addingDoc.current = false;
    }
  }

  async function deleteProject() {
    if (!window.confirm(`Delete "${project.title}"? It will be moved to the trash folder on the server.`)) return;
    await api.deleteProject(id);
    navigate('#/');
  }

  if (error) return <div className="banner error">{error.status === 404 ? 'Project not found.' : error.message}</div>;
  if (!project) return <div className="loading">Loading…</div>;

  const base = `#/p/${encodeURIComponent(id)}`;
  const people = peopleFor(project, workspace);
  const { wiki, todoDocs } = splitPages(project.pages, project.subtasks);

  const saveBanner = saveError && (
    <div className="banner error doc-banner">
      {saveError}
      <button onClick={() => setSaveError(null)}>Dismiss</button>
    </div>
  );

  if (phone) {
    return (
      <PeopleContext.Provider value={people}>
        <PhoneProject
          project={project}
          pageId={pageId}
          workspace={workspace}
          base={base}
          banner={saveBanner}
          patch={patch}
          onMeta={(meta) => setProject((p) => ({ ...p, ...meta }))}
          onPagesChanged={load}
          onAddPage={addPage}
          onAddTodoDoc={addTodoDoc}
          onDelete={deleteProject}
        />
      </PeopleContext.Provider>
    );
  }

  return (
    <div className="project">
      <aside className="sidebar">
        <a href="#/" className="back">
          ← Board view
        </a>
        <div className="sidebar-title">{project.title}</div>
        <nav className="pages">
          <a href={base} className={!pageId ? 'active' : ''}>
            📋 Overview
          </a>
          <div className="pages-heading">Wiki</div>
          {wiki.map((p) => (
            <a key={p.id} href={`${base}/${encodeURIComponent(p.id)}`} className={pageId === p.id ? 'active' : ''}>
              📄 {p.title}
            </a>
          ))}
        </nav>
        <button className="add-page" onClick={addPage}>
          + Add page
        </button>
        {todoDocs.length > 0 && (
          <nav className="pages">
            <div className="pages-heading">To-do notes</div>
            {todoDocs.map((p) => (
              <a key={p.id} href={`${base}/${encodeURIComponent(p.id)}`} className={pageId === p.id ? 'active' : ''} title={todoOf(p.id, project.subtasks).text}>
                📝 {p.title}
              </a>
            ))}
          </nav>
        )}
      </aside>

      <div className="doc">
        {saveBanner}
        {pageId ? (
          <PageView key={pageId} projectId={id} pageId={pageId} todo={todoOf(pageId, project.subtasks)} onChanged={load} />
        ) : (
          <>
            <TitleInput value={project.title} onCommit={(title) => patch({ title })} />
            <PeopleContext.Provider value={people}>
              <ProjectProps project={project} workspace={workspace} patch={patch} />

              <Subtasks
                items={project.subtasks}
                pages={project.pages}
                base={base}
                repos={project.repos}
                projectTitle={project.title}
                onChange={(subtasks) => patch({ subtasks })}
                onAddDoc={addTodoDoc}
              />

              <Updates projectId={id} updates={project.updates} onChange={(meta) => setProject((p) => ({ ...p, ...meta }))} />
            </PeopleContext.Provider>

            <DocBody
              docKey={`project:${id}`}
              projectId={id}
              body={project.body}
              version={project.version}
              save={(body, baseVersion) => api.updateProject(id, { body, baseVersion })}
            />

            <div className="danger-zone">
              <button className="danger" onClick={deleteProject}>
                Delete project
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Status, group, flags and the workspace's properties, edited in place.
function ProjectProps({ project, workspace, patch }) {
  return (
    <div className="props">
      <div className="prop-row">
        <label>Status</label>
        <select value={project.status} onChange={(e) => patch({ status: e.target.value })}>
          {workspace.columns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      {(workspace.groups.length > 0 || project.group) && (
        <div className="prop-row">
          <label>Group</label>
          <select value={project.group ?? ''} onChange={(e) => patch({ group: e.target.value || null })}>
            <option value="">No group</option>
            {workspace.groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="prop-row prop-row-url">
        <label>GitHub repos</label>
        <RepoList repos={project.repos} onChange={(repos) => patch({ repos })} />
      </div>
      <div className="prop-row">
        <label>Blocked</label>
        <input
          type="checkbox"
          checked={project.blocked}
          onChange={(e) => patch({ blocked: e.target.checked, ...(e.target.checked ? {} : { blockedReason: '' }) })}
        />
      </div>
      {project.blocked && (
        <div className="prop-row">
          <label>Reason</label>
          <BlockedReason value={project.blockedReason} onCommit={(blockedReason) => patch({ blockedReason })} />
        </div>
      )}
      {project.status === LIVE_STATUS && (
        <div className="prop-row">
          <label>Maintenance</label>
          <input type="checkbox" checked={project.maintenance} onChange={(e) => patch({ maintenance: e.target.checked })} />
        </div>
      )}
      {workspace.properties.map((def) => (
        <div className={`prop-row prop-row-${def.type}`} key={def.key}>
          <label>{def.name}</label>
          <PropertyInput
            def={def}
            value={project.properties[def.key]}
            onChange={(v) => patch({ properties: { [def.key]: v } })}
          />
        </div>
      ))}
      <a className="muted small" href="#/settings">
        Manage properties and groups
      </a>
    </div>
  );
}

// A project on a phone. The first screen answers "how is this going?", and everything else is one
// tab away instead of being stacked below it. A Live project opens on its docs, because by then
// the page is the solution's wiki.
// The server puts each repo in its one form, and refuses anything that isn't a repository.
function RepoList({ repos, onChange }) {
  function add(e) {
    const v = e.target.value.trim();
    if (!v) return;
    e.target.value = '';
    onChange([...repos, v]);
  }

  return (
    <div className="repo-list">
      {repos.map((repo) => (
        <span key={repo} className="repo-item">
          <a href={repo} target="_blank" rel="noreferrer" title="Open on GitHub">
            {repoPath(repo)}
          </a>
          <button className="icon" onClick={() => onChange(repos.filter((r) => r !== repo))} aria-label={`Remove ${repoPath(repo)}`} title="Remove this repo">
            ×
          </button>
        </span>
      ))}
      <input
        placeholder="+ Add a repo"
        aria-label="Add a GitHub repo"
        onBlur={add}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
    </div>
  );
}

function PhoneProject({ project, pageId, workspace, base, banner, patch, onMeta, onPagesChanged, onAddPage, onAddTodoDoc, onDelete }) {
  const id = project.id;
  const [tab, setTab] = useState(pageId || project.status === LIVE_STATUS ? 'docs' : 'todos');
  // The docs stay mounted once opened, so their editor keeps its unsaved text and version
  // while another tab is showing.
  const [docsOpened, setDocsOpened] = useState(tab === 'docs');
  const [pickingStage, setPickingStage] = useState(false);
  const doneCount = project.subtasks.filter((s) => s.done).length;
  const { wiki, todoDocs } = splitPages(project.pages, project.subtasks);
  const tabs = [
    ['todos', project.subtasks.length ? `To-dos ${doneCount}/${project.subtasks.length}` : 'To-dos'],
    ['updates', 'Updates'],
    ['docs', 'Docs'],
    ['details', 'Details'],
  ];

  function open(next) {
    setTab(next);
    if (next === 'docs') setDocsOpened(true);
  }

  // To-dos link to their notes, which live on another tab. The back button can land here too.
  useEffect(() => {
    if (pageId) open('docs');
  }, [pageId]);

  return (
    <div className="phone-project">
      <a href="#/" className="phone-back">
        ‹ Board
      </a>
      <div className="phone-project-top">
        {banner}
        <TitleInput multiline value={project.title} onCommit={(title) => patch({ title })} />
        <div className="phone-project-meta">
          <button className="stage-btn" aria-haspopup="dialog" onClick={() => setPickingStage(true)}>
            {workspace.columns.find((c) => c.id === project.status)?.name ?? project.status} <span aria-hidden="true">▾</span>
          </button>
          <CardMeta project={project} workspace={workspace} />
        </div>
        {project.blocked && (
          <div className="phone-flag blocked">
            <strong>⛔ Blocked</strong>
            {project.blockedReason && <span>: {project.blockedReason}</span>}
          </div>
        )}
        {project.maintenance && (
          <div className="phone-flag maintenance">
            <strong>🔧 In maintenance</strong>
          </div>
        )}
      </div>
      <div className="project-tabs" role="tablist" aria-label="Project sections">
        {tabs.map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => open(key)}>
            {label}
          </button>
        ))}
      </div>
      <div className="project-panel">
        {tab === 'todos' && (
          <Subtasks
            items={project.subtasks}
            pages={project.pages}
            base={base}
            repos={project.repos}
            projectTitle={project.title}
            onChange={(subtasks) => patch({ subtasks })}
            onAddDoc={onAddTodoDoc}
            onOpenDoc={() => open('docs')}
          />
        )}
        {tab === 'updates' && <Updates projectId={id} updates={project.updates} onChange={onMeta} />}
        {tab === 'details' && (
          <>
            <ProjectProps project={project} workspace={workspace} patch={patch} />
            <div className="danger-zone">
              <button className="danger" onClick={onDelete}>
                Delete project
              </button>
            </div>
          </>
        )}
        {docsOpened && (
          <div hidden={tab !== 'docs'}>
            <nav className="page-chips" aria-label="Wiki">
              <span className="page-chips-label">Wiki</span>
              <a href={base} className={!pageId ? 'active' : ''}>
                Overview
              </a>
              {wiki.map((p) => (
                <a key={p.id} href={`${base}/${encodeURIComponent(p.id)}`} className={pageId === p.id ? 'active' : ''}>
                  {p.title}
                </a>
              ))}
              <button aria-label="Add page" onClick={onAddPage}>
                +
              </button>
            </nav>
            {todoDocs.length > 0 && (
              <nav className="page-chips" aria-label="To-do notes">
                <span className="page-chips-label">To-do notes</span>
                {todoDocs.map((p) => (
                  <a key={p.id} href={`${base}/${encodeURIComponent(p.id)}`} className={pageId === p.id ? 'active' : ''}>
                    {p.title}
                  </a>
                ))}
              </nav>
            )}
            <div hidden={Boolean(pageId)}>
              <DocBody
                readFirst
                docKey={`project:${id}`}
                projectId={id}
                body={project.body}
                version={project.version}
                save={(body, baseVersion) => api.updateProject(id, { body, baseVersion })}
              />
            </div>
            {pageId && (
              <PageView
                key={pageId}
                projectId={id}
                pageId={pageId}
                todo={todoOf(pageId, project.subtasks)}
                onChanged={onPagesChanged}
                onOpenTodo={() => open('todos')}
                phone
              />
            )}
          </div>
        )}
      </div>
      {pickingStage && (
        <Sheet title="Move to stage" onClose={() => setPickingStage(false)}>
          <StagePicker
            columns={workspace.columns}
            current={project.status}
            onPick={(status) => {
              patch({ status });
              setPickingStage(false);
            }}
          />
        </Sheet>
      )}
    </div>
  );
}

// Owner suggestions: the project's group first, with everyone else on offer once a name is typed.
// Without a group, everyone in any group (plus names already on the project) is listed.
function peopleFor(project, workspace) {
  const seen = new Set();
  const everyone = [];
  const add = (n) => {
    if (!seen.has(n.toLowerCase())) {
      seen.add(n.toLowerCase());
      everyone.push(n);
    }
  };
  for (const g of workspace.groups) g.members.forEach(add);
  for (const def of workspace.properties) if (def.type === 'people') toPeople(project.properties[def.key]).forEach(add);
  for (const s of project.subtasks) toPeople(s.owners).forEach(add);
  const byName = (a, b) => a.localeCompare(b);
  const group = workspace.groups.find((g) => g.id === project.group);
  if (!group) return { label: '', members: everyone.sort(byName), others: [] };
  const inGroup = new Set(group.members.map((n) => n.toLowerCase()));
  return { label: group.name, members: group.members, others: everyone.filter((n) => !inGroup.has(n.toLowerCase())).sort(byName) };
}

function PageView({ projectId, pageId, todo, onChanged, onOpenTodo, phone = false }) {
  const [page, setPage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.page(projectId, pageId).then(setPage, setError);
  }, [projectId, pageId]);

  async function rename(title) {
    const p = await api.updatePage(projectId, pageId, { title });
    setPage((cur) => ({ ...cur, title: p.title }));
    onChanged();
  }

  async function remove() {
    if (!window.confirm(`Delete page "${page.title}"? It will be moved to the trash folder on the server.`)) return;
    await api.deletePage(projectId, pageId);
    await onChanged();
    navigate(`#/p/${encodeURIComponent(projectId)}`);
  }

  if (error) return <div className="banner error">{error.status === 404 ? 'Page not found.' : error.message}</div>;
  if (!page) return <div className="loading">Loading…</div>;

  return (
    <>
      <TitleInput multiline={phone} value={page.title} onCommit={rename} />
      {todo && (
        <div className="page-todo">
          To-do:{' '}
          <a href={`#/p/${encodeURIComponent(projectId)}`} onClick={onOpenTodo}>
            {todo.text}
          </a>
          {todo.done && <span className="muted"> (done)</span>}
        </div>
      )}
      <DocBody
        readFirst={phone}
        docKey={`page:${projectId}/${pageId}`}
        projectId={projectId}
        body={page.body}
        version={page.version}
        save={(body, baseVersion) => api.updatePage(projectId, pageId, { body, baseVersion })}
      />
      <div className="danger-zone">
        <button className="danger" onClick={remove}>
          Delete page
        </button>
      </div>
    </>
  );
}

function BlockedReason({ value, onCommit }) {
  return (
    <input
      key={value}
      className="blocked-reason"
      defaultValue={value}
      placeholder="Why is this blocked?"
      onBlur={(e) => e.target.value.trim() !== value && onCommit(e.target.value.trim())}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  );
}

// `multiline` wraps a long title, for screens too narrow to show it on one line. It is still one
// line of text, so Enter saves it.
function TitleInput({ value, onCommit, multiline = false }) {
  const Field = multiline ? 'textarea' : 'input';
  return (
    <Field
      key={value}
      className="doc-title"
      defaultValue={value}
      rows={multiline ? 1 : undefined}
      ref={multiline ? fitToContent : undefined}
      onInput={multiline ? (e) => fitToContent(e.currentTarget) : undefined}
      onBlur={(e) => {
        const v = e.target.value.trim();
        if (v && v !== value) onCommit(v);
        else e.target.value = value;
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        e.currentTarget.blur();
      }}
    />
  );
}
