// All requests are relative so the app works under an IIS virtual directory.
async function request(method, url, body) {
  const res = await fetch(`api/${url}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
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
  deleteProject: (id) => request('DELETE', `projects/${enc(id)}`),
  reorder: (status, ids) => request('POST', 'board/reorder', { status, ids }),

  page: (id, page) => request('GET', `projects/${enc(id)}/pages/${enc(page)}`),
  createPage: (id, input) => request('POST', `projects/${enc(id)}/pages`, input),
  updatePage: (id, page, patch) => request('PATCH', `projects/${enc(id)}/pages/${enc(page)}`, patch),
  deletePage: (id, page) => request('DELETE', `projects/${enc(id)}/pages/${enc(page)}`),
};
