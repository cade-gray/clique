import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Store, parseMarkdown, stringifyMarkdown } from './store.js';

async function freshStore() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'clique-'));
  const store = new Store(dir);
  await store.init();
  return store;
}

test('frontmatter round-trips and keeps the body intact', () => {
  const body = '# Hello\n\n```js\nconsole.log(1)\n```\n';
  const text = stringifyMarkdown({ title: 'X', due: '2026-10-15', tags: ['a', 'b'] }, body);
  const { data, body: out } = parseMarkdown(text);
  assert.deepEqual(data, { title: 'X', due: '2026-10-15', tags: ['a', 'b'] });
  assert.equal(out, body);
});

test('malformed frontmatter is preserved as body text', () => {
  const text = '---\n: [oops\n---\nbody';
  assert.deepEqual(parseMarkdown(text), { data: {}, body: text });
});

test('first run seeds a workspace and a sample project', async () => {
  const store = await freshStore();
  const ws = await store.getWorkspace();
  assert.ok(ws.columns.length >= 1);
  const projects = await store.listProjects();
  assert.equal(projects.length, 1);
  assert.equal((await store.getProject(projects[0].id)).pages.length, 1);
});

test('project lifecycle: create, patch properties, subtasks, pages, trash', async () => {
  const store = await freshStore();
  const p = await store.createProject({ title: 'Website Redesign', status: 'backlog' });
  assert.equal(p.id, 'website-redesign');
  const dup = await store.createProject({ title: 'Website Redesign' });
  assert.equal(dup.id, 'website-redesign-2');

  await store.updateProject(p.id, { properties: { priority: 'High', owner: 'Cade' }, subtasks: [{ text: 'a', done: true }, 'b'] });
  await store.updateProject(p.id, { properties: { owner: null } });
  const got = await store.getProject(p.id);
  assert.deepEqual(got.properties, { priority: 'High' });
  assert.deepEqual(got.subtasks, [{ text: 'a', done: true }, { text: 'b', done: false }]);

  const file = await fs.readFile(path.join(store.projectsDir, p.id, 'index.md'), 'utf8');
  assert.match(file, /^---\ntitle: Website Redesign\n/);
  assert.match(file, /priority: High/);

  const page = await store.createPage(p.id, { title: 'Meeting notes' });
  await store.updatePage(p.id, page.id, { body: 'hi' });
  assert.equal((await store.getPage(p.id, page.id)).body, 'hi');
  await store.deletePage(p.id, page.id);
  await store.deleteProject(p.id);
  assert.equal((await store.listProjects()).some((x) => x.id === p.id), false);
  assert.equal((await fs.readdir(store.trashDir)).length, 2);
});

test('body saves detect conflicts, but metadata edits do not cause them', async () => {
  const store = await freshStore();
  const p = await store.createProject({ title: 'Conflicts' });
  const a = await store.updateProject(p.id, { body: 'one', baseVersion: p.version });
  await store.updateProject(p.id, { subtasks: [{ text: 'x', done: false }] });
  const b = await store.updateProject(p.id, { body: 'two', baseVersion: a.version });
  await assert.rejects(store.updateProject(p.id, { body: 'stale', baseVersion: a.version }), (e) => e.status === 409 && e.extra.current.body === 'two');
  assert.equal((await store.getProject(p.id)).body, b.body);
});

test('board reorder moves cards between columns', async () => {
  const store = await freshStore();
  const a = await store.createProject({ title: 'A', status: 'backlog' });
  const b = await store.createProject({ title: 'B', status: 'backlog' });
  await store.reorderColumn('live', [b.id, a.id]);
  const list = (await store.listProjects()).filter((p) => p.status === 'live');
  assert.deepEqual(list.map((p) => p.id), [b.id, a.id]);
  await assert.rejects(store.reorderColumn('nope', [a.id]), (e) => e.status === 400);
  await assert.rejects(store.reorderColumn('live', 'not-a-list'), (e) => e.status === 400);
});

test('ids are validated against path traversal', async () => {
  const store = await freshStore();
  await assert.rejects(store.getProject('../etc'), (e) => e.status === 400);
  await assert.rejects(store.getPage('x', '..%2Fpasswd'), (e) => e.status === 400);
  await assert.rejects(store.saveWorkspace({ columns: [{ id: 'a' }], properties: [{ key: 'status', type: 'text' }] }), (e) => e.status === 400);
});

test('projects and subtasks can have multiple owners', async () => {
  const store = await freshStore();
  const p = await store.createProject({ title: 'Owners' });
  await store.updateProject(p.id, {
    properties: { owner: ['Cade', ' Sam ', 'cade', ''] },
    subtasks: [{ text: 'a', owners: ['Ann', 'Bo', 'ann'] }, { text: 'b', owners: [] }],
  });
  const got = await store.getProject(p.id);
  assert.deepEqual(got.properties.owner, ['Cade', 'Sam']);
  assert.deepEqual(got.subtasks, [{ text: 'a', done: false, owners: ['Ann', 'Bo'] }, { text: 'b', done: false }]);
  await store.updateProject(p.id, { properties: { owner: [] } });
  assert.equal((await store.getProject(p.id)).properties.owner, undefined);
});

test('status always resolves to a real column, defaulting to backlog', async () => {
  const store = await freshStore();
  const p = await store.createProject({ title: 'No status given', status: 'nope' });
  assert.equal(p.status, 'backlog');
  await assert.rejects(store.updateProject(p.id, { status: 'nope' }), (e) => e.status === 400);
  await store.updateProject(p.id, { status: 'live' });
  const ws = await store.getWorkspace();
  await store.saveWorkspace({ ...ws, columns: ws.columns.filter((c) => c.id !== 'live') });
  assert.equal((await store.getProject(p.id)).status, 'backlog');
  assert.equal((await store.listProjects())[0].status, 'backlog');
});

test('blocked flag carries an optional reason that clears when unblocked', async () => {
  const store = await freshStore();
  const p = await store.createProject({ title: 'Stuck' });
  assert.equal(p.blocked, false);
  await store.updateProject(p.id, { blockedReason: 'ignored while not blocked' });
  assert.equal((await store.getProject(p.id)).blockedReason, '');
  await store.updateProject(p.id, { blocked: true });
  await store.updateProject(p.id, { blockedReason: '  Waiting on design ' });
  let got = await store.getProject(p.id);
  assert.deepEqual([got.blocked, got.blockedReason], [true, 'Waiting on design']);
  assert.equal((await store.listProjects())[0].blockedReason, 'Waiting on design');
  await store.updateProject(p.id, { blocked: false });
  got = await store.getProject(p.id);
  assert.deepEqual([got.blocked, got.blockedReason], [false, '']);
  const file = await fs.readFile(path.join(store.projectsDir, p.id, 'index.md'), 'utf8');
  assert.doesNotMatch(file, /blocked/);
});

test('listProjects can include full subtasks', async () => {
  const store = await freshStore();
  const p = await store.createProject({ title: 'With subtasks' });
  await store.updateProject(p.id, { subtasks: [{ text: 'a', done: true, owners: ['Ann'] }, 'b'] });
  const plain = (await store.listProjects()).find((x) => x.id === p.id);
  assert.equal(plain.subtasks.items, undefined);
  const full = (await store.listProjects({ withSubtasks: true })).find((x) => x.id === p.id);
  assert.deepEqual(full.subtasks, {
    done: 1,
    total: 2,
    items: [{ text: 'a', done: true, owners: ['Ann'] }, { text: 'b', done: false }],
  });
});

test('status updates append, show as latest, and can be deleted', async () => {
  const store = await freshStore();
  const p = await store.createProject({ title: 'Updates' });
  assert.equal(p.latestUpdate, null);
  await assert.rejects(store.addUpdate(p.id, { text: '   ' }), (e) => e.status === 400);
  await store.addUpdate(p.id, { text: 'Kicked off', author: ' Ann ' });
  const got = await store.addUpdate(p.id, { text: 'Vendor call went well' });
  assert.equal(got.updates.length, 2);
  assert.equal(got.updates[0].author, 'Ann');
  assert.equal(got.updates[1].author, undefined);
  const summary = (await store.listProjects()).find((x) => x.id === p.id);
  assert.equal(summary.latestUpdate.text, 'Vendor call went well');
  assert.equal(summary.updateCount, 2);
  // Property/body edits never disturb the timeline.
  await store.updateProject(p.id, { properties: { priority: 'High' }, body: 'hi' });
  assert.equal((await store.getProject(p.id)).updates.length, 2);
  await store.deleteUpdate(p.id, got.updates[1].id);
  assert.equal((await store.getProject(p.id)).latestUpdate.text, 'Kicked off');
  await assert.rejects(store.deleteUpdate(p.id, 'nope'), (e) => e.status === 404);
  // Posting at the same time keeps every entry.
  await Promise.all(['a', 'b', 'c'].map((t) => store.addUpdate(p.id, { text: t })));
  assert.equal((await store.getProject(p.id)).updates.length, 4);
});

test('subtasks keep a completion time only while checked off', async () => {
  const store = await freshStore();
  const p = await store.createProject({ title: 'History' });
  const at = '2026-10-01T12:00:00.000Z';
  await store.updateProject(p.id, {
    subtasks: [{ text: 'a', done: true, doneAt: at }, { text: 'b', done: false, doneAt: at }, { text: 'c', done: true, doneAt: 'garbage' }],
  });
  assert.deepEqual((await store.getProject(p.id)).subtasks, [
    { text: 'a', done: true, doneAt: at },
    { text: 'b', done: false },
    { text: 'c', done: true },
  ]);
});

test('attachments are saved under the project with unique names and stay out of the page list', async () => {
  const store = await freshStore();
  const p = await store.createProject({ title: 'Screenshots' });
  const data = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  const a = await store.saveAttachment(p.id, { name: 'image.png', type: 'image/png', data });
  const b = await store.saveAttachment(p.id, { name: 'image.png', type: 'image/png', data });
  assert.match(a.path, /^attachments\/image-[0-9a-f]{8}\.png$/);
  assert.notEqual(a.path, b.path);
  const file = store.attachmentFile(p.id, a.path.slice('attachments/'.length));
  assert.deepEqual(await fs.readFile(file), data);
  assert.equal((await store.getProject(p.id)).pages.length, 0);

  await assert.rejects(store.saveAttachment(p.id, { name: 'x.svg', type: 'image/svg+xml', data }), (e) => e.status === 415);
  await assert.rejects(store.saveAttachment(p.id, { name: 'x.png', type: 'image/png', data: Buffer.alloc(0) }), (e) => e.status === 400);
  await assert.rejects(store.saveAttachment('missing', { name: 'x.png', type: 'image/png', data }), (e) => e.status === 404);
  assert.throws(() => store.attachmentFile(p.id, '../index.md'), (e) => e.status === 400);
  assert.throws(() => store.attachmentFile(p.id, 'notes.md'), (e) => e.status === 400);
});

test('maintenance only shows for live projects and can combine with blocked', async () => {
  const store = await freshStore();
  const p = await store.createProject({ title: 'Payments', status: 'live' });
  assert.equal(p.maintenance, false);
  let got = await store.updateProject(p.id, { maintenance: true, blocked: true });
  assert.deepEqual([got.maintenance, got.blocked], [true, true]);
  // Leaving Live hides the flag; coming back shows it again.
  got = await store.updateProject(p.id, { status: 'graveyard' });
  assert.equal(got.maintenance, false);
  got = await store.updateProject(p.id, { status: 'live' });
  assert.equal(got.maintenance, true);
  got = await store.updateProject(p.id, { maintenance: false });
  assert.equal(got.maintenance, false);
  assert.doesNotMatch(await fs.readFile(store.projectFile(p.id), 'utf8'), /maintenance/);
});

test('a workspace with a done column is migrated to live + graveyard on start', async () => {
  const store = await freshStore();
  const ws = await store.getWorkspace();
  await store.saveWorkspace({
    ...ws,
    columns: [{ id: 'backlog', name: 'Backlog' }, { id: 'done', name: 'Shipped' }, { id: 'archive', name: 'Archive' }],
  });
  const p = await store.createProject({ title: 'Old', status: 'done' });
  await store.init();
  assert.deepEqual((await store.getWorkspace()).columns.map((c) => c.id), ['backlog', 'live', 'graveyard', 'archive']);
  assert.equal((await store.getProject(p.id)).status, 'live');
  // Running again changes nothing, and a "done" column added later is left alone.
  await store.saveWorkspace({ ...(await store.getWorkspace()), columns: [...(await store.getWorkspace()).columns, { id: 'done', name: 'Done' }] });
  await store.init();
  assert.equal((await store.getWorkspace()).columns.filter((c) => c.id === 'done').length, 1);
});
