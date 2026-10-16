// Markdown-on-disk storage. Layout under DATA_DIR:
//
//   workspace.yaml              board columns + globally defined properties
//   projects/<id>/index.md      the project: frontmatter (status, properties, subtasks) + overview body
//   projects/<id>/<page>.md     extra pages inside the project
//   .trash/                     deleted projects and pages land here instead of being removed
//
// Everything is plain text so the folder can be opened in Obsidian, diffed, or backed up as-is.

import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import YAML from 'yaml';

export const RESERVED_KEYS = ['title', 'status', 'order', 'subtasks', 'blocked', 'blockedReason', 'created', 'updated'];

const DEFAULT_WORKSPACE = {
  columns: [
    { id: 'backlog', name: 'Backlog' },
    { id: 'in-progress', name: 'In progress' },
    { id: 'done', name: 'Done' },
  ],
  properties: [
    {
      key: 'priority',
      name: 'Priority',
      type: 'select',
      options: [
        { value: 'High', color: 'red' },
        { value: 'Medium', color: 'yellow' },
        { value: 'Low', color: 'gray' },
      ],
    },
    { key: 'owner', name: 'Owners', type: 'people' },
    { key: 'due', name: 'Due', type: 'date' },
  ],
};

// Every project has a status: the "backlog" column if there is one, otherwise the first column.
export function defaultStatus(ws) {
  return (ws.columns.find((c) => c.id === 'backlog') ?? ws.columns[0])?.id ?? null;
}

export class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

// ---------- frontmatter ----------

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

export function parseMarkdown(text) {
  const m = text.match(FM_RE);
  if (!m) return { data: {}, body: text };
  let data = {};
  try {
    data = YAML.parse(m[1]) ?? {};
  } catch {
    // Malformed frontmatter: keep the raw text in the body rather than lose it.
    return { data: {}, body: text };
  }
  if (typeof data !== 'object' || Array.isArray(data)) data = {};
  return { data, body: text.slice(m[0].length).replace(/^\r?\n/, '') };
}

export function stringifyMarkdown(data, body) {
  const clean = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v) && v.length === 0 && k !== 'subtasks') continue;
    clean[k] = v;
  }
  const fm = YAML.stringify(clean, { lineWidth: 0 }).trimEnd();
  return `---\n${fm}\n---\n\n${(body ?? '').replace(/^\n+/, '')}`;
}

// ---------- helpers ----------

export function slugify(s) {
  const slug = String(s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'untitled';
}

const ID_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;
function assertId(id, what = 'id') {
  if (typeof id !== 'string' || !ID_RE.test(id)) throw new HttpError(400, `Invalid ${what}`);
  return id;
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

// Atomic write: temp file + rename, so a crash never leaves half a file behind.
async function writeFileAtomic(file, content) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, content, 'utf8');
  await fs.rename(tmp, file);
}

// Serialise read-modify-write cycles per file within this process.
const locks = new Map();
function withLock(key, fn) {
  const prev = locks.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  const tail = next.catch(() => {});
  locks.set(key, tail);
  tail.then(() => {
    if (locks.get(key) === tail) locks.delete(key);
  });
  return next;
}

const now = () => new Date().toISOString();

// ---------- store ----------

export class Store {
  constructor(dataDir) {
    this.dir = path.resolve(dataDir);
    this.projectsDir = path.join(this.dir, 'projects');
    this.trashDir = path.join(this.dir, '.trash');
    this.workspaceFile = path.join(this.dir, 'workspace.yaml');
  }

  async init() {
    await fs.mkdir(this.projectsDir, { recursive: true });
    if (!(await exists(this.workspaceFile))) {
      await writeFileAtomic(this.workspaceFile, YAML.stringify(DEFAULT_WORKSPACE));
      if ((await fs.readdir(this.projectsDir)).length === 0) await this.seed();
    }
  }

  // A first-run example so a fresh install shows what a project looks like.
  async seed() {
    const p = await this.createProject({ title: 'Welcome to the tracker', status: 'in-progress' });
    await this.updateProject(p.id, {
      properties: { priority: 'Medium' },
      subtasks: [
        { text: 'Open this project', done: true },
        { text: 'Add a property under "Properties & columns"', done: false },
        { text: 'Drag this card to another column', done: false },
      ],
      body: [
        '## What is this?',
        '',
        'Each card on the board is a folder of **markdown files** on the server. This overview is `index.md`;',
        'pages you add in the sidebar are sibling `.md` files. Properties and subtasks live in the frontmatter.',
        '',
        'Type `/` on an empty line for headings, lists, tables, and code blocks.',
        '',
        '```powershell',
        'Get-ChildItem .\\data\\projects -Recurse -Filter *.md',
        '```',
        '',
        '- [x] Markdown renders as you type',
        '- [ ] Code blocks have a copy button',
        '',
      ].join('\n'),
    });
    await this.createPage(p.id, { title: 'Notes' });
  }

  // ----- workspace -----

  async getWorkspace() {
    const ws = YAML.parse(await fs.readFile(this.workspaceFile, 'utf8')) ?? {};
    return {
      columns: Array.isArray(ws.columns) ? ws.columns : [],
      // `blocked` is built in now; drop an older custom property that used the same key.
      properties: (Array.isArray(ws.properties) ? ws.properties : []).filter((p) => !RESERVED_KEYS.includes(p.key)),
    };
  }

  async saveWorkspace(input) {
    const columns = (input.columns ?? []).map((c) => ({
      id: assertId(c.id, 'column id'),
      name: String(c.name ?? c.id).slice(0, 80),
    }));
    if (columns.length === 0) throw new HttpError(400, 'At least one column is required');
    if (new Set(columns.map((c) => c.id)).size !== columns.length)
      throw new HttpError(400, 'Column ids must be unique');

    const TYPES = ['text', 'number', 'select', 'multi_select', 'people', 'date', 'checkbox', 'url'];
    const properties = (input.properties ?? []).map((p) => {
      const key = assertId(p.key, 'property key');
      if (RESERVED_KEYS.includes(key)) throw new HttpError(400, `"${key}" is a reserved property key`);
      if (!TYPES.includes(p.type)) throw new HttpError(400, `Unknown property type ${p.type}`);
      const out = { key, name: String(p.name ?? key).slice(0, 80), type: p.type };
      if (p.type === 'select' || p.type === 'multi_select') {
        out.options = (p.options ?? [])
          .filter((o) => o && String(o.value ?? '').trim())
          .map((o) => ({ value: String(o.value).trim(), color: o.color || 'gray' }));
      }
      return out;
    });
    if (new Set(properties.map((p) => p.key)).size !== properties.length)
      throw new HttpError(400, 'Property keys must be unique');

    const ws = { columns, properties };
    await withLock(this.workspaceFile, () => writeFileAtomic(this.workspaceFile, YAML.stringify(ws)));
    return ws;
  }

  // ----- projects -----

  projectDir(id) {
    return path.join(this.projectsDir, assertId(id, 'project id'));
  }
  projectFile(id) {
    return path.join(this.projectDir(id), 'index.md');
  }
  pageFile(id, page) {
    assertId(page, 'page id');
    if (page === 'index') throw new HttpError(400, 'Invalid page id');
    return path.join(this.projectDir(id), `${page}.md`);
  }

  // `version` is a hash of the body only, so editing properties or subtasks never
  // makes someone's in-progress body edit look like a conflict.
  async readDoc(file) {
    let text;
    try {
      text = await fs.readFile(file, 'utf8');
    } catch (e) {
      if (e.code === 'ENOENT') throw new HttpError(404, 'Not found');
      throw e;
    }
    const doc = parseMarkdown(text);
    return { ...doc, version: createHash('sha1').update(doc.body).digest('hex').slice(0, 16) };
  }

  async listPages(id) {
    const dir = this.projectDir(id);
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.md') && f !== 'index.md');
    const pages = [];
    for (const f of files) {
      const pid = f.slice(0, -3);
      if (!ID_RE.test(pid)) continue;
      const { data } = parseMarkdown(await fs.readFile(path.join(dir, f), 'utf8'));
      pages.push({ id: pid, title: data.title || pid, order: Number(data.order) || 0 });
    }
    return pages.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  }

  // A missing or unknown status (e.g. a deleted column) falls back to the default column.
  toSummary(id, data, ws) {
    const subtasks = normalizeSubtasks(data.subtasks);
    const props = {};
    for (const [k, v] of Object.entries(data)) if (!RESERVED_KEYS.includes(k)) props[k] = v;
    return {
      id,
      title: data.title || id,
      status: ws.columns.some((c) => c.id === data.status) ? data.status : defaultStatus(ws),
      order: Number(data.order) || 0,
      properties: props,
      blocked: data.blocked === true,
      blockedReason: data.blocked === true ? String(data.blockedReason ?? '') : '',
      subtasks: { done: subtasks.filter((s) => s.done).length, total: subtasks.length },
      created: data.created ?? null,
      updated: data.updated ?? null,
    };
  }

  async listProjects() {
    const ws = await this.getWorkspace();
    const entries = await fs.readdir(this.projectsDir, { withFileTypes: true });
    const out = [];
    for (const e of entries) {
      if (!e.isDirectory() || !ID_RE.test(e.name)) continue;
      const file = path.join(this.projectsDir, e.name, 'index.md');
      if (!(await exists(file))) continue;
      const { data } = parseMarkdown(await fs.readFile(file, 'utf8'));
      out.push(this.toSummary(e.name, data, ws));
    }
    return out.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  }

  async getProject(id) {
    const doc = await this.readDoc(this.projectFile(id));
    return {
      ...this.toSummary(id, doc.data, await this.getWorkspace()),
      subtasks: normalizeSubtasks(doc.data.subtasks),
      body: doc.body,
      version: doc.version,
      pages: await this.listPages(id),
    };
  }

  async uniqueId(dir, base, suffix = '') {
    let id = base;
    for (let i = 2; await exists(path.join(dir, id + suffix)); i++) id = `${base}-${i}`;
    return id;
  }

  async createProject({ title, status }) {
    title = String(title ?? '').trim() || 'Untitled project';
    const ws = await this.getWorkspace();
    if (!ws.columns.some((c) => c.id === status)) status = defaultStatus(ws);
    const id = await this.uniqueId(this.projectsDir, slugify(title));
    const siblings = (await this.listProjects()).filter((p) => p.status === status);
    const order = siblings.length ? Math.max(...siblings.map((p) => p.order)) + 1 : 0;
    await fs.mkdir(this.projectDir(id));
    const ts = now();
    await writeFileAtomic(
      this.projectFile(id),
      stringifyMarkdown({ title, status, order, created: ts, updated: ts, subtasks: [] }, ''),
    );
    return this.getProject(id);
  }

  // Patch semantics: only the fields present are changed. `properties` merges per key
  // (null/'' clears). `body` with `baseVersion` is rejected with 409 if the file changed
  // underneath, so two people editing the same page don't silently overwrite each other.
  async updateProject(id, patch) {
    const file = this.projectFile(id);
    await withLock(file, async () => {
      const doc = await this.readDoc(file);
      if (patch.body !== undefined && patch.baseVersion && patch.baseVersion !== doc.version) {
        throw new HttpError(409, 'This page was changed by someone else', {
          current: { body: doc.body, version: doc.version },
        });
      }
      const data = { ...doc.data };
      const ws = await this.getWorkspace();
      if (patch.title !== undefined) data.title = String(patch.title).trim() || 'Untitled project';
      if (patch.status !== undefined) {
        if (!ws.columns.some((c) => c.id === patch.status)) throw new HttpError(400, 'Unknown status');
        data.status = patch.status;
      }
      if (patch.order !== undefined) data.order = Number(patch.order) || 0;
      if (patch.blocked !== undefined) {
        if (patch.blocked) data.blocked = true;
        else {
          delete data.blocked;
          delete data.blockedReason;
        }
      }
      if (patch.blockedReason !== undefined) {
        const reason = String(patch.blockedReason).trim().slice(0, 500);
        if (reason && data.blocked === true) data.blockedReason = reason;
        else delete data.blockedReason;
      }
      if (patch.subtasks !== undefined) data.subtasks = normalizeSubtasks(patch.subtasks);
      if (patch.properties) {
        for (const [k, v] of Object.entries(patch.properties)) {
          if (RESERVED_KEYS.includes(k) || !ID_RE.test(k)) continue;
          const val = Array.isArray(v) && ws.properties.find((d) => d.key === k)?.type === 'people' ? normalizePeople(v) : v;
          if (val === null || val === '' || (Array.isArray(val) && val.length === 0)) delete data[k];
          else data[k] = val;
        }
      }
      data.updated = now();
      await writeFileAtomic(file, stringifyMarkdown(data, patch.body ?? doc.body));
    });
    return this.getProject(id);
  }

  // Set column + order for a whole column at once (used by board drag and drop).
  async reorderColumn(status, ids) {
    for (const [i, id] of ids.entries()) {
      const file = this.projectFile(id);
      await withLock(file, async () => {
        const doc = await this.readDoc(file);
        if (doc.data.status === status && Number(doc.data.order) === i) return;
        await writeFileAtomic(file, stringifyMarkdown({ ...doc.data, status, order: i }, doc.body));
      });
    }
  }

  async moveToTrash(src, name) {
    await fs.mkdir(this.trashDir, { recursive: true });
    const stamp = now().replace(/[:.]/g, '-');
    await fs.rename(src, path.join(this.trashDir, `${stamp}-${name}`));
  }

  async deleteProject(id) {
    const dir = this.projectDir(id);
    if (!(await exists(dir))) throw new HttpError(404, 'Not found');
    await this.moveToTrash(dir, id);
  }

  // ----- pages -----

  async getPage(id, page) {
    const doc = await this.readDoc(this.pageFile(id, page));
    return { id: page, projectId: id, title: doc.data.title || page, body: doc.body, version: doc.version };
  }

  async createPage(id, { title }) {
    title = String(title ?? '').trim() || 'Untitled page';
    const dir = this.projectDir(id);
    if (!(await exists(dir))) throw new HttpError(404, 'Project not found');
    let base = slugify(title);
    if (base === 'index') base = 'index-page';
    const page = await this.uniqueId(dir, base, '.md');
    const pages = await this.listPages(id);
    const order = pages.length ? Math.max(...pages.map((p) => p.order)) + 1 : 0;
    const ts = now();
    await writeFileAtomic(this.pageFile(id, page), stringifyMarkdown({ title, order, created: ts, updated: ts }, ''));
    return this.getPage(id, page);
  }

  async updatePage(id, page, patch) {
    const file = this.pageFile(id, page);
    await withLock(file, async () => {
      const doc = await this.readDoc(file);
      if (patch.body !== undefined && patch.baseVersion && patch.baseVersion !== doc.version) {
        throw new HttpError(409, 'This page was changed by someone else', {
          current: { body: doc.body, version: doc.version },
        });
      }
      const data = { ...doc.data };
      if (patch.title !== undefined) data.title = String(patch.title).trim() || 'Untitled page';
      data.updated = now();
      await writeFileAtomic(file, stringifyMarkdown(data, patch.body ?? doc.body));
    });
    return this.getPage(id, page);
  }

  async deletePage(id, page) {
    const file = this.pageFile(id, page);
    if (!(await exists(file))) throw new HttpError(404, 'Not found');
    await this.moveToTrash(file, `${id}--${page}.md`);
  }
}

function normalizeSubtasks(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((s) => (typeof s === 'string' ? { text: s, done: false } : s))
    .filter((s) => s && typeof s === 'object')
    .map((s) => {
      const out = { text: String(s.text ?? '').slice(0, 500), done: Boolean(s.done) };
      const owners = normalizePeople(s.owners);
      if (owners.length) out.owners = owners;
      return out;
    });
}

// Owners are free-text names; trim, drop blanks and case-insensitive duplicates.
export function normalizePeople(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const n of list) {
    const name = String(n ?? '').trim().slice(0, 80);
    if (name && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      out.push(name);
    }
  }
  return out;
}
