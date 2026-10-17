// All requests are relative so the app works under an IIS virtual directory.
// A File/Blob body is sent as-is with its own type; anything else is sent as JSON.
async function request(method, url, body) {
  const raw = body instanceof Blob;
  const res = await fetch(`api/${url}`, {
    method,
    headers: body ? { 'Content-Type': raw ? body.type : 'application/json' } : undefined,
    body: body ? (raw ? body : JSON.stringify(body)) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || res.statusText);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

const enc = encodeURIComponent;

export const api = {
  workspace: () => request('GET', 'workspace'),
  saveWorkspace: (ws) => request('PUT', 'workspace', ws),

  projects: ({ subtasks = false } = {}) => request('GET', subtasks ? 'projects?include=subtasks' : 'projects'),
  project: (id) => request('GET', `projects/${enc(id)}`),
  createProject: (input) => request('POST', 'projects', input),
  updateProject: (id, patch) => request('PATCH', `projects/${enc(id)}`, patch),
  addUpdate: (id, input) => request('POST', `projects/${enc(id)}/updates`, input),
  deleteUpdate: (id, uid) => request('DELETE', `projects/${enc(id)}/updates/${enc(uid)}`),
  deleteProject: (id) => request('DELETE', `projects/${enc(id)}`),
  reorder: (status, ids) => request('POST', 'board/reorder', { status, ids }),

  page: (id, page) => request('GET', `projects/${enc(id)}/pages/${enc(page)}`),
  createPage: (id, input) => request('POST', `projects/${enc(id)}/pages`, input),
  updatePage: (id, page, patch) => request('PATCH', `projects/${enc(id)}/pages/${enc(page)}`, patch),
  deletePage: (id, page) => request('DELETE', `projects/${enc(id)}/pages/${enc(page)}`),

  // Resolves to the path to put in the markdown, e.g. "attachments/image-1a2b3c4d.png".
  uploadAttachment: (id, file) =>
    request('POST', `projects/${enc(id)}/attachments?name=${enc(file.name ?? '')}`, file).then((r) => r.path),
};

// Markdown links attachments relative to the project folder; the browser loads them through the API.
export function attachmentUrl(projectId, src) {
  const m = /^(?:\.\/)?attachments\/([^/?#]+)$/.exec(src ?? '');
  return m ? `api/projects/${enc(projectId)}/attachments/${m[1]}` : src;
}
