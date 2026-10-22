import { useCallback, useEffect, useState } from 'react';
import { api, LIVE_STATUS } from '../api.js';
import { navigate } from '../App.jsx';
import DocBody from './DocBody.jsx';
import Subtasks from './Subtasks.jsx';
import Updates from './Updates.jsx';
import { PeopleContext, PropertyInput, toPeople } from './props.jsx';

export default function ProjectView({ id, pageId, workspace }) {
  const [project, setProject] = useState(null);
  const [error, setError] = useState(null);
  const [saveError, setSaveError] = useState(null);

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

  async function deleteProject() {
    if (!window.confirm(`Delete "${project.title}"? It will be moved to the trash folder on the server.`)) return;
    await api.deleteProject(id);
    navigate('#/');
  }

  if (error) return <div className="banner error">{error.status === 404 ? 'Project not found.' : error.message}</div>;
  if (!project) return <div className="loading">Loading…</div>;

  const base = `#/p/${encodeURIComponent(id)}`;
  const people = peopleFor(project, workspace);

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
          {project.pages.map((p) => (
            <a key={p.id} href={`${base}/${encodeURIComponent(p.id)}`} className={pageId === p.id ? 'active' : ''}>
              📄 {p.title}
            </a>
          ))}
        </nav>
        <button className="add-page" onClick={addPage}>
          + Add page
        </button>
      </aside>

      <div className="doc">
        {saveError && (
          <div className="banner error doc-banner">
            {saveError}
            <button onClick={() => setSaveError(null)}>Dismiss</button>
          </div>
        )}
        {pageId ? (
          <PageView key={pageId} projectId={id} pageId={pageId} onChanged={load} />
        ) : (
          <>
            <TitleInput value={project.title} onCommit={(title) => patch({ title })} />
            <PeopleContext.Provider value={people}>
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

              <Subtasks items={project.subtasks} onChange={(subtasks) => patch({ subtasks })} />

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

function PageView({ projectId, pageId, onChanged }) {
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
      <TitleInput value={page.title} onCommit={rename} />
      <DocBody
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

function TitleInput({ value, onCommit }) {
  return (
    <input
      key={value}
      className="doc-title"
      defaultValue={value}
      onBlur={(e) => {
        const v = e.target.value.trim();
        if (v && v !== value) onCommit(v);
        else e.target.value = value;
      }}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  );
}
