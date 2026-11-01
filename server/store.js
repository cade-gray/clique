// Markdown-on-disk storage. Layout under DATA_DIR:
//
//   workspace.yaml              board columns, globally defined properties, and groups of people
//   projects/<id>/index.md      the project: frontmatter (status, properties, to-dos, updates) + overview body
//   projects/<id>/<page>.md     extra pages inside the project
//   projects/<id>/attachments/  images pasted into the project's pages, linked as attachments/<file>
//   events.ndjson               append-only history of creates, status moves and deletes
//   .trash/                    deleted projects and pages land here instead of being removed
//
// Everything is plain text so the folder can be opened in Obsidian, diffed, or backed up as-is.

import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import YAML from 'yaml';
import { EventLog } from './events.js';

// `maintenance` is derived from the open to-dos and never written, but it stays reserved so the
// leftover key in a file saved by an older version doesn't show up as a custom property.
export const RESERVED_KEYS = ['title', 'status', 'order', 'group', 'repo', 'repos', 'subtasks', 'blocked', 'blockedReason', 'maintenance', 'updates', 'created', 'updated'];

// The column for projects that are in production. Only projects here can be in maintenance.
export const LIVE_STATUS = 'live';
// The column for retired projects. Neither of these counts as work in flight.
export const GRAVEYARD_STATUS = 'graveyard';

const DEFAULT_WORKSPACE = {
  columns: [
    { id: 'backlog', name: 'Backlog' },
    { id: 'in-progress', name: 'In progress' },
    { id: 'live', name: 'Live' },
    { id: 'graveyard', name: 'Graveyard' },
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

// Image types accepted as attachments. SVG is left out because it can carry script.
export const IMAGE_TYPES = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/bmp': 'bmp',
};
// A single file name (no folders), so an attachment path can never leave the attachments folder.
const ATTACHMENT_RE = /^\w[\w .-]{0,119}\.(png|jpe?g|gif|webp|avif|bmp)$/i;
// A to-do's linked issue is shown as a link, so only an address of this shape is ever kept.
const ISSUE_RE = /^https:\/\/[\w.-]+\/[\w.-]+\/[\w.-]+\/issues\/[1-9]\d*$/;
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

// On Windows, antivirus, the search indexer, backup agents or an editor holding a file open
// can make a rename fail for a moment with EPERM/EBUSY/EACCES. Retry for a few seconds first.
async function renameWithRetry(from, to) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fs.rename(from, to);
    } catch (e) {
      if (attempt >= 10 || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) throw e;
      await new Promise((r) => setTimeout(r, 50 * attempt));
    }
  }
}

// Atomic write: temp file + rename, so a crash never leaves half a file behind.
async function writeFileAtomic(file, content) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, content, 'utf8');
  try {
    await renameWithRetry(tmp, file);
  } catch (e) {
    await fs.rm(tmp, { force: true });
    throw e;
  }
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
    this.eventsFile = path.join(this.dir, 'events.ndjson');
    this.events = new EventLog(this.eventsFile);
  }

  async init() {
    await fs.mkdir(this.projectsDir, { recursive: true });
    const fresh = !(await exists(this.workspaceFile));
    if (fresh) await writeFileAtomic(this.workspaceFile, YAML.stringify(DEFAULT_WORKSPACE));
    await this.migrateDoneToLive();
    // Before seeding, so the example project is recorded like any other new project.
    await this.startEventLog();
    if (fresh && (await fs.readdir(this.projectsDir)).length === 0) await this.seed();
  }

  // The history only exists from the first time a version with the event log runs. Projects
  // that already exist get a `created` event from their own frontmatter timestamp, which is
  // real recorded data; the status moves they made before now were never written down and
  // cannot be recovered, so nothing is invented for them. The `log-started` marker is what
  // lets the stats page say which period its delivery figures actually cover.
  async startEventLog() {
    const existing = await this.events.read();
    if (existing.some((e) => e.type === 'log-started')) return;
    const backfill = (await this.listProjects())
      .filter((p) => p.created)
      .map((p) => ({ at: p.created, type: 'created', project: p.id, title: p.title, backfilled: true }))
      .sort((a, b) => a.at.localeCompare(b.at));
    await this.events.appendAll([...backfill, { at: now(), type: 'log-started' }]);
  }

  // Workspaces from before 1.1 have a "done" column. It becomes "Live", with a "Graveyard"
  // column after it. Projects move first, so if this stops halfway it simply runs again next start.
  async migrateDoneToLive() {
    const ws = await this.getWorkspace();
    const i = ws.columns.findIndex((c) => c.id === 'done');
    if (i < 0 || ws.columns.some((c) => c.id === LIVE_STATUS)) return;
    for (const e of await fs.readdir(this.projectsDir, { withFileTypes: true })) {
      if (!e.isDirectory() || !ID_RE.test(e.name)) continue;
      const file = path.join(this.projectsDir, e.name, 'index.md');
      if (!(await exists(file))) continue;
      await withLock(file, async () => {
        const doc = await this.readDoc(file);
        if (doc.data.status === 'done') await writeFileAtomic(file, stringifyMarkdown({ ...doc.data, status: LIVE_STATUS }, doc.body));
      });
    }
    const columns = [...ws.columns];
    columns[i] = { id: LIVE_STATUS, name: 'Live' };
    if (!columns.some((c) => c.id === 'graveyard')) columns.splice(i + 1, 0, { id: 'graveyard', name: 'Graveyard' });
    await this.saveWorkspace({ ...ws, columns });
  }

  // A first-run example so a fresh install shows what a project looks like.
  async seed() {
    const p = await this.createProject({ title: 'Welcome to Clique', status: 'in-progress' });
    await this.updateProject(p.id, {
      properties: { priority: 'Medium' },
      subtasks: [
        { text: 'Open this project', done: true },
        { text: 'Add a property under "Configuration"', done: false },
        { text: 'Drag this card to another column', done: false },
      ],
      body: [
        '## What is this?',
        '',
        'Each card on the board is a folder of **markdown files** on the server. This overview is `index.md`;',
        'pages you add in the sidebar are sibling `.md` files. Properties and to-dos live in the frontmatter.',
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
      groups: normalizeGroups(ws.groups),
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

    // A client that doesn't know about groups leaves them as they are.
    const groups = (input.groups ?? (await this.getWorkspace()).groups).map((g) => ({
      id: assertId(g.id, 'group id'),
      name: String(g.name ?? g.id).trim().slice(0, 80) || g.id,
      members: normalizePeople(g.members),
    }));
    if (new Set(groups.map((g) => g.id)).size !== groups.length) throw new HttpError(400, 'Group ids must be unique');

    const ws = { columns, properties, groups };
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

  // `version` is a hash of the body only, so editing properties or to-dos never
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
    const updates = normalizeUpdates(data.updates);
    const props = {};
    for (const [k, v] of Object.entries(data)) if (!RESERVED_KEYS.includes(k)) props[k] = v;
    const status = ws.columns.some((c) => c.id === data.status) ? data.status : defaultStatus(ws);
    // A live project with work still open on it is in maintenance: nobody sets the flag by hand,
    // so it goes away by itself when the last to-do is checked off.
    const open = subtasks.filter((s) => !s.done);
    const maintenance = status === LIVE_STATUS && open.length > 0;
    return {
      id,
      title: data.title || id,
      status,
      // A group that has since been deleted reads as no group.
      group: ws.groups.some((g) => g.id === data.group) ? data.group : null,
      repos: projectRepos(data),
      order: Number(data.order) || 0,
      properties: props,
      latestUpdate: updates.length ? updates[updates.length - 1] : null,
      updateCount: updates.length,
      blocked: data.blocked === true,
      blockedReason: data.blocked === true ? String(data.blockedReason ?? '') : '',
      maintenance,
      // The one open to-do is the reason; past that, the count is, because a list of them
      // wouldn't fit on a card.
      maintenanceReason: !maintenance ? '' : open.length === 1 ? open[0].text : `${open.length} to-dos open`,
      // Everyone who owns a to-do, so views can filter by person without loading every to-do.
      subtasks: { done: subtasks.filter((s) => s.done).length, total: subtasks.length, owners: normalizePeople(subtasks.flatMap((s) => s.owners ?? [])) },
      created: data.created ?? null,
      updated: data.updated ?? null,
    };
  }

  // `withSubtasks` adds the full to-do list to each summary (used by the list view and exports).
  async listProjects({ withSubtasks = false } = {}) {
    const ws = await this.getWorkspace();
    const entries = await fs.readdir(this.projectsDir, { withFileTypes: true });
    const out = [];
    for (const e of entries) {
      if (!e.isDirectory() || !ID_RE.test(e.name)) continue;
      const file = path.join(this.projectsDir, e.name, 'index.md');
      if (!(await exists(file))) continue;
      const { data } = parseMarkdown(await fs.readFile(file, 'utf8'));
      const summary = this.toSummary(e.name, data, ws);
      if (withSubtasks) summary.subtasks.items = normalizeSubtasks(data.subtasks);
      out.push(summary);
    }
    return out.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  }

  async getProject(id) {
    const doc = await this.readDoc(this.projectFile(id));
    const pages = await this.listPages(id);
    return {
      ...this.toSummary(id, doc.data, await this.getWorkspace()),
      subtasks: withoutMissingDocs(normalizeSubtasks(doc.data.subtasks), pages),
      updates: normalizeUpdates(doc.data.updates),
      body: doc.body,
      version: doc.version,
      pages,
    };
  }

  async uniqueId(dir, base, suffix = '') {
    let id = base;
    for (let i = 2; await exists(path.join(dir, id + suffix)); i++) id = `${base}-${i}`;
    return id;
  }

  async createProject({ title, status, group }) {
    title = String(title ?? '').trim() || 'Untitled project';
    const ws = await this.getWorkspace();
    if (!ws.columns.some((c) => c.id === status)) status = defaultStatus(ws);
    if (group && !ws.groups.some((g) => g.id === group)) throw new HttpError(400, 'Unknown group');
    const id = await this.uniqueId(this.projectsDir, slugify(title));
    const siblings = (await this.listProjects()).filter((p) => p.status === status);
    const order = siblings.length ? Math.max(...siblings.map((p) => p.order)) + 1 : 0;
    await fs.mkdir(this.projectDir(id));
    const ts = now();
    await writeFileAtomic(
      this.projectFile(id),
      stringifyMarkdown({ title, status, ...(group ? { group } : {}), order, created: ts, updated: ts, subtasks: [] }, ''),
    );
    await this.events.append({ at: ts, type: 'created', project: id, title, to: status });
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
      const statusBefore = doc.data.status ?? null;
      const ws = await this.getWorkspace();
      if (patch.title !== undefined) data.title = String(patch.title).trim() || 'Untitled project';
      if (patch.status !== undefined) {
        if (!ws.columns.some((c) => c.id === patch.status)) throw new HttpError(400, 'Unknown status');
        data.status = patch.status;
      }
      if (patch.order !== undefined) data.order = Number(patch.order) || 0;
      if (patch.group !== undefined) {
        if (!patch.group) delete data.group;
        else if (!ws.groups.some((g) => g.id === patch.group)) throw new HttpError(400, 'Unknown group');
        else data.group = patch.group;
      }
      if (patch.repos !== undefined) {
        const entered = (Array.isArray(patch.repos) ? patch.repos : [patch.repos]).filter((r) => String(r ?? '').trim());
        const repos = entered.map(normalizeRepo);
        if (repos.includes(null)) throw new HttpError(400, 'Enter a GitHub repository link, like https://github.com/owner/repo');
        // A project saved before it could have several keeps its one repo in `repo` until now.
        delete data.repo;
        if (repos.length) data.repos = uniqueRepos(repos);
        else delete data.repos;
      }
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
      // Maintenance is worked out from the to-dos now, so a file written by an older version
      // loses its stale flag the next time the project is saved.
      delete data.maintenance;
      data.updated = now();
      await writeFileAtomic(file, stringifyMarkdown(data, patch.body ?? doc.body));
      if (data.status !== statusBefore)
        await this.events.append({ at: data.updated, type: 'status', project: id, title: data.title ?? id, from: statusBefore, to: data.status });
    });
    return this.getProject(id);
  }

  // ----- status updates (a comment-style timeline on each project) -----
  // Appended under the file lock so two people posting at once never lose an entry.

  async addUpdate(id, { text, author }) {
    text = String(text ?? '').trim().slice(0, 2000);
    if (!text) throw new HttpError(400, 'An update needs some text');
    const file = this.projectFile(id);
    await withLock(file, async () => {
      const doc = await this.readDoc(file);
      const entry = { id: randomUUID().slice(0, 8), text, at: now() };
      const name = String(author ?? '').trim().slice(0, 80);
      if (name) entry.author = name;
      const data = { ...doc.data, updates: [...normalizeUpdates(doc.data.updates), entry], updated: now() };
      await writeFileAtomic(file, stringifyMarkdown(data, doc.body));
    });
    return this.getProject(id);
  }

  async deleteUpdate(id, updateId) {
    const file = this.projectFile(id);
    await withLock(file, async () => {
      const doc = await this.readDoc(file);
      const updates = normalizeUpdates(doc.data.updates);
      if (!updates.some((u) => u.id === updateId)) throw new HttpError(404, 'Update not found');
      const data = { ...doc.data, updates: updates.filter((u) => u.id !== updateId), updated: now() };
      await writeFileAtomic(file, stringifyMarkdown(data, doc.body));
    });
    return this.getProject(id);
  }

  // Set column + order for a whole column at once (used by board drag and drop).
  async reorderColumn(status, ids) {
    const ws = await this.getWorkspace();
    if (!ws.columns.some((c) => c.id === status)) throw new HttpError(400, 'Unknown status');
    if (!Array.isArray(ids)) throw new HttpError(400, 'ids must be a list');
    for (const [i, id] of ids.entries()) {
      const file = this.projectFile(id);
      await withLock(file, async () => {
        const doc = await this.readDoc(file);
        if (doc.data.status === status && Number(doc.data.order) === i) return;
        const statusBefore = doc.data.status ?? null;
        await writeFileAtomic(file, stringifyMarkdown({ ...doc.data, status, order: i }, doc.body));
        // Dragging a card between columns comes through here rather than updateProject.
        if (status !== statusBefore)
          await this.events.append({ at: now(), type: 'status', project: id, title: doc.data.title ?? id, from: statusBefore, to: status });
      });
    }
  }

  async moveToTrash(src, name) {
    await fs.mkdir(this.trashDir, { recursive: true });
    const stamp = now().replace(/[:.]/g, '-');
    await renameWithRetry(src, path.join(this.trashDir, `${stamp}-${name}`));
  }

  async deleteProject(id) {
    const dir = this.projectDir(id);
    if (!(await exists(dir))) throw new HttpError(404, 'Not found');
    // Read the title and column before the folder moves, so the log still says what went.
    const doc = await this.readDoc(this.projectFile(id)).catch(() => ({ data: {} }));
    await this.moveToTrash(dir, id);
    await this.events.append({ at: now(), type: 'deleted', project: id, title: doc.data.title ?? id, from: doc.data.status ?? null });
  }

  // ----- attachments -----
  // Stored next to the markdown and linked by a relative path, so the folder still
  // shows the images when opened in Obsidian or any other markdown viewer.

  attachmentFile(id, file) {
    if (typeof file !== 'string' || !ATTACHMENT_RE.test(file)) throw new HttpError(400, 'Invalid attachment name');
    return path.join(this.projectDir(id), 'attachments', file);
  }

  async saveAttachment(id, { name, type, data }) {
    const ext = IMAGE_TYPES[type];
    if (!ext) throw new HttpError(415, 'Only PNG, JPEG, GIF, WebP, AVIF and BMP images can be attached');
    if (!Buffer.isBuffer(data) || data.length === 0) throw new HttpError(400, 'The image is empty');
    const dir = this.projectDir(id);
    if (!(await exists(dir))) throw new HttpError(404, 'Project not found');
    await fs.mkdir(path.join(dir, 'attachments'), { recursive: true });
    // The random suffix keeps two pastes of "image.png" from overwriting each other.
    const base = slugify(path.parse(String(name ?? '')).name).slice(0, 40);
    const file = `${base === 'untitled' ? 'image' : base}-${randomUUID().slice(0, 8)}.${ext}`;
    await writeFileAtomic(this.attachmentFile(id, file), data);
    return { path: `attachments/${file}` };
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
    // Clear the link too, so a new page that reuses this id doesn't inherit the to-do.
    const projectFile = this.projectFile(id);
    await withLock(projectFile, async () => {
      const doc = await this.readDoc(projectFile);
      const subtasks = normalizeSubtasks(doc.data.subtasks);
      if (!subtasks.some((s) => s.doc === page)) return;
      const unlinked = withoutMissingDocs(subtasks, await this.listPages(id));
      await writeFileAtomic(projectFile, stringifyMarkdown({ ...doc.data, subtasks: unlinked, updated: now() }, doc.body));
    });
  }
}

function normalizeSubtasks(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((s) => (typeof s === 'string' ? { text: s, done: false } : s))
    .filter((s) => s && typeof s === 'object')
    .map((s) => {
      const out = { text: String(s.text ?? '').slice(0, 500), done: Boolean(s.done) };
      // When it was checked off, kept only while it stays checked off (feeds the history section).
      const doneAt = out.done && s.doneAt ? new Date(s.doneAt) : null;
      if (doneAt && !Number.isNaN(doneAt.getTime())) out.doneAt = doneAt.toISOString();
      const owners = normalizePeople(s.owners);
      if (owners.length) out.owners = owners;
      // The id of the project's page written for this to-do. The link lives on the to-do, so it
      // follows the to-do through rewording and reordering, and a page with no to-do is a wiki page.
      if (typeof s.doc === 'string' && ID_RE.test(s.doc)) out.doc = s.doc;
      if (typeof s.issue === 'string' && ISSUE_RE.test(s.issue)) out.issue = s.issue;
      return out;
    });
}

// A linked page can go missing if its file is deleted by hand outside the app.
function withoutMissingDocs(subtasks, pages) {
  return subtasks.map(({ doc, ...s }) => (pages.some((p) => p.id === doc) ? { ...s, doc } : s));
}

// A project's repositories in one form, including the single `repo` of an older file.
function projectRepos(data) {
  const listed = Array.isArray(data.repos) ? data.repos : [];
  return uniqueRepos([...listed, data.repo].map(normalizeRepo).filter(Boolean));
}

// GitHub ignores case in a repository's address, so these are the same repository.
function uniqueRepos(repos) {
  return repos.filter((repo, i) => repos.findIndex((r) => r.toLowerCase() === repo.toLowerCase()) === i);
}

// A repository in one form, however it was copied: a browser link (even from deeper in the repo)
// or a clone address. The host is left open for GitHub Enterprise. Null if it isn't a repository.
export function normalizeRepo(value) {
  const text = String(value ?? '').trim().replace(/^git@([^:]+):/, '$1/');
  const m = /^(?:https?:\/\/)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/?#].*)?$/i.exec(text);
  return m ? `https://${m[1].toLowerCase()}/${m[2]}/${m[3]}` : null;
}

// Hand-edited groups that can't be used (bad id, duplicate) are skipped rather than failing every request.
function normalizeGroups(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const g of list) {
    if (!g || typeof g !== 'object' || typeof g.id !== 'string' || !ID_RE.test(g.id) || seen.has(g.id)) continue;
    seen.add(g.id);
    out.push({ id: g.id, name: String(g.name ?? g.id).trim().slice(0, 80) || g.id, members: normalizePeople(g.members) });
  }
  return out;
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

// Oldest first, as stored. Entries written by hand without an id get a stable one from their content.
export function normalizeUpdates(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((u) => (typeof u === 'string' ? { text: u } : u))
    .filter((u) => u && typeof u === 'object' && String(u.text ?? '').trim())
    .map((u) => {
      const d = u.at ? new Date(u.at) : null;
      const at = d && !Number.isNaN(d.getTime()) ? d.toISOString() : null;
      const out = {
        id: String(u.id ?? createHash('sha1').update(`${u.at}|${u.text}`).digest('hex').slice(0, 8)),
        text: String(u.text).trim().slice(0, 2000),
        at,
      };
      if (u.author) out.author = String(u.author).slice(0, 80);
      return out;
    })
    .sort((a, b) => String(a.at ?? '').localeCompare(String(b.at ?? '')));
}
