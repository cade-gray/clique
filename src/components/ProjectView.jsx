import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { navigate } from '../App.jsx';
import DocBody from './DocBody.jsx';
import Subtasks from './Subtasks.jsx';
import { PEOPLE_LIST_ID, PropertyInput, toPeople } from './props.jsx';

export default function ProjectView({ id, pageId, workspace }) {
  const [project, setProject] = useState(null);
  const [error, setError] = useState(null);

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

  // Metadata edits (title, status, properties, subtasks) save immediately and never touch the body.
  async function patch(fields) {
    setProject((p) => ({
      ...p,
      ...fields,
      properties: fields.properties ? { ...p.properties, ...fields.properties } : p.properties,
    }));
    const { body: _b, version: _v, ...meta } = await api.updateProject(id, fields);
    setProject((p) => ({ ...p, ...meta }));
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
  const known = new Set();
  for (const def of workspace.properties) if (def.type === 'people') toPeople(project.properties[def.key]).forEach((n) => known.add(n));
  for (const s of project.subtasks) toPeople(s.owners).forEach((n) => known.add(n));

  return (
    <div className="project">
      <aside className="sidebar">
        <a href="#/" className="back">
          ← Board
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
        {pageId ? (
          <PageView key={pageId} projectId={id} pageId={pageId} onChanged={load} />
        ) : (
          <>
            <TitleInput value={project.title} onCommit={(title) => patch({ title })} />
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
              {workspace.properties.map((def) => (
                <div className="prop-row" key={def.key}>
                  <label>{def.name}</label>
                  <PropertyInput
                    def={def}
                    value={project.properties[def.key]}
                    onChange={(v) => patch({ properties: { [def.key]: v } })}
                  />
                </div>
              ))}
              <a className="muted small" href="#/settings">
                Manage properties
              </a>
            </div>

            <datalist id={PEOPLE_LIST_ID}>
              {[...known].map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            <Subtasks items={project.subtasks} onChange={(subtasks) => patch({ subtasks })} />

            <DocBody
              docKey={`project:${id}`}
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
