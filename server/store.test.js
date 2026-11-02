import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Store, normalizeRepo, parseMarkdown, stringifyMarkdown } from './store.js';

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

test('a task keeps its linked doc through edits, reordering and being checked off', async () => {
  const store = await freshStore();
  const p = await store.createProject({ title: 'Linked docs' });
  const page = await store.createPage(p.id, { title: 'Design' });
  await store.updateProject(p.id, { subtasks: [{ text: 'a', done: false }, { text: 'b', done: false, doc: page.id }] });

  const reordered = [{ text: 'b reworded', done: true, doc: page.id }, { text: 'a', done: false }];
  const got = await store.updateProject(p.id, { subtasks: reordered });
  assert.deepEqual(got.subtasks, reordered);
  assert.equal(got.pages.length, 1);

  const file = await fs.readFile(path.join(store.projectsDir, p.id, 'index.md'), 'utf8');
  assert.match(file, /doc: design\n/);
});

test('deleting a task doc clears the link, and leaves other tasks alone', async () => {
  const store = await freshStore();
  const p = await store.createProject({ title: 'Linked docs' });
  const one = await store.createPage(p.id, { title: 'One' });
  const two = await store.createPage(p.id, { title: 'Two' });
  await store.updateProject(p.id, { subtasks: [{ text: 'a', done: false, doc: one.id }, { text: 'b', done: false, doc: two.id }] });

  await store.deletePage(p.id, one.id);
  assert.deepEqual((await store.getProject(p.id)).subtasks, [{ text: 'a', done: false }, { text: 'b', done: false, doc: two.id }]);

  // A later page that lands on the same id starts out as a wiki page.
  const again = await store.createPage(p.id, { title: 'One' });
  assert.equal(again.id, one.id);
  assert.deepEqual((await store.getProject(p.id)).subtasks[0], { text: 'a', done: false });
});

test('deleting a page with no task does not touch the project', async () => {
  const store = await freshStore();
  const p = await store.createProject({ title: 'Wiki page' });
  const page = await store.createPage(p.id, { title: 'Runbook' });
  const before = await fs.readFile(store.projectFile(p.id), 'utf8');
  await store.deletePage(p.id, page.id);
  assert.equal(await fs.readFile(store.projectFile(p.id), 'utf8'), before);
});

test('removing a task keeps its doc, which becomes an unlinked page', async () => {
  const store = await freshStore();
  const p = await store.createProject({ title: 'Linked docs' });
  const page = await store.createPage(p.id, { title: 'Design' });
  await store.updateProject(p.id, { subtasks: [{ text: 'a', done: false, doc: page.id }] });
  const got = await store.updateProject(p.id, { subtasks: [] });
  assert.deepEqual(got.pages.map((x) => x.id), [page.id]);
});

test('links to pages removed outside the app are ignored, and bad ids are dropped', async () => {
  const store = await freshStore();
  const p = await store.createProject({ title: 'Hand edited' });
  const keep = await store.createPage(p.id, { title: 'Keep' });
  const gone = await store.createPage(p.id, { title: 'Gone' });
  await store.updateProject(p.id, {
    subtasks: [
      { text: 'a', done: false, doc: keep.id },
      { text: 'b', done: false, doc: gone.id },
      { text: 'c', done: false, doc: '../secrets' },
      { text: 'd', done: false, doc: 7 },
    ],
  });
  await fs.rm(store.pageFile(p.id, gone.id));
  assert.deepEqual((await store.getProject(p.id)).subtasks, [
    { text: 'a', done: false, doc: keep.id },
    { text: 'b', done: false },
    { text: 'c', done: false },
    { text: 'd', done: false },
  ]);
});

test('normalizeRepo accepts the ways a repository gets copied, and nothing else', () => {
  const repo = 'https://github.com/cade-gray/clique';
  for (const input of [
    repo,
    `${repo}/`,
    `${repo}.git`,
    `  ${repo}  `,
    `${repo}/issues`,
    `${repo}/tree/main/src`,
    `${repo}?tab=readme`,
    'http://github.com/cade-gray/clique',
    'github.com/cade-gray/clique',
    'GitHub.com/cade-gray/clique',
    'git@github.com:cade-gray/clique.git',
  ])
    assert.equal(normalizeRepo(input), repo, input);
  assert.equal(normalizeRepo('https://github.acme.bank/it/core.sync'), 'https://github.acme.bank/it/core.sync');
  for (const input of ['', null, undefined, 'clique', 'https://github.com/cade-gray', 'cade-gray/clique', 'javascript:alert(1)//x/y/z', 'https://github.com'])
    assert.equal(normalizeRepo(input), null, String(input));
});

test('a project\'s repos are saved in one form, can be cleared, and reject anything else', async () => {
  const store = await freshStore();
  const p = await store.createProject({ title: 'Repo' });
  assert.deepEqual(p.repos, []);

  const clique = 'https://github.com/cade-gray/clique';
  const site = 'https://github.com/cade-gray/site';
  const saved = await store.updateProject(p.id, { repos: ['git@github.com:cade-gray/clique.git', 'github.com/CADE-gray/CLIQUE', ' ', `${site}/tree/main`] });
  assert.deepEqual(saved.repos, [clique, site]);
  assert.deepEqual(saved.properties, {});
  assert.match(await fs.readFile(store.projectFile(p.id), 'utf8'), /^repos:\n {2}- https:\/\/github\.com\/cade-gray\/clique\n {2}- https:\/\/github\.com\/cade-gray\/site$/m);

  await assert.rejects(store.updateProject(p.id, { repos: [clique, 'not a repo'] }), (e) => e.status === 400);
  assert.deepEqual((await store.getProject(p.id)).repos, saved.repos);

  assert.deepEqual((await store.updateProject(p.id, { repos: [] })).repos, []);
  assert.doesNotMatch(await fs.readFile(store.projectFile(p.id), 'utf8'), /^repos:/m);
  assert.deepEqual((await store.listProjects()).find((x) => x.id === p.id).repos, []);
});

test('a project file with the older single repo reads as a list, and is rewritten when its repos change', async () => {
  const store = await freshStore();
  const p = await store.createProject({ title: 'Older' });
  const file = store.projectFile(p.id);
  const clique = 'https://github.com/cade-gray/clique';
  const site = 'https://github.com/cade-gray/site';
  await fs.writeFile(file, (await fs.readFile(file, 'utf8')).replace(/^title:/m, `repo: ${clique}\ntitle:`));

  assert.deepEqual((await store.getProject(p.id)).repos, [clique]);
  assert.deepEqual((await store.updateProject(p.id, { title: 'Renamed' })).repos, [clique]);
  assert.match(await fs.readFile(file, 'utf8'), /^repo: /m);

  assert.deepEqual((await store.updateProject(p.id, { repos: [clique, site] })).repos, [clique, site]);
  assert.doesNotMatch(await fs.readFile(file, 'utf8'), /^repo: /m);
});

test('repos cannot be used as a custom property key', async () => {
  const store = await freshStore();
  const ws = await store.getWorkspace();
  await assert.rejects(store.saveWorkspace({ ...ws, properties: [{ key: 'repos', name: 'Repos', type: 'text' }] }), (e) => e.status === 400);
});

test('repo is a built-in key, so a property can\'t take it', async () => {
  const store = await freshStore();
  const ws = await store.getWorkspace();
  await assert.rejects(store.saveWorkspace({ ...ws, properties: [...ws.properties, { key: 'repo', name: 'Repo', type: 'url' }] }), (e) => e.status === 400);
});

test('a hand-edited repo that isn\'t one reads as no repo', async () => {
  const store = await freshStore();
  const p = await store.createProject({ title: 'Hand edited' });
  const file = store.projectFile(p.id);
  await fs.writeFile(file, (await fs.readFile(file, 'utf8')).replace('title:', 'repo: javascript:alert(1)\ntitle:'));
  assert.deepEqual((await store.getProject(p.id)).repos, []);
});

test('a task keeps a linked issue through edits, and drops anything that isn\'t one', async () => {
  const store = await freshStore();
  const p = await store.createProject({ title: 'Issues' });
  const issue = 'https://github.com/cade-gray/clique/issues/27';
  await store.updateProject(p.id, {
    subtasks: [
      { text: 'a', done: false, issue },
      { text: 'b', done: false, issue: 'javascript:alert(1)' },
      { text: 'c', done: false, issue: 'https://github.com/cade-gray/clique/pull/29' },
      { text: 'd', done: false, issue: 27 },
    ],
  });
  const got = await store.updateProject(p.id, { subtasks: (await store.getProject(p.id)).subtasks.map((s) => ({ ...s, done: true })) });
  assert.deepEqual(got.subtasks.map((s) => s.issue), [issue, undefined, undefined, undefined]);
  assert.match(await fs.readFile(store.projectFile(p.id), 'utf8'), /issue: https:\/\/github\.com\/cade-gray\/clique\/issues\/27/);
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
  // Board summaries carry the task owners for filtering by person.
  assert.deepEqual((await store.listProjects()).find((x) => x.id === p.id).subtasks, { done: 0, total: 2, owners: ['Ann', 'Bo'] });
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
    owners: ['Ann'],
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

test('a live project with open tasks is in maintenance, and says which ones', async () => {
  const store = await freshStore();
  const p = await store.createProject({ title: 'Payments', status: 'live' });
  assert.deepEqual([p.maintenance, p.maintenanceReason], [false, '']);

  // One open task: the task itself is the reason.
  let got = await store.updateProject(p.id, { subtasks: [{ text: 'Refund webhook retries' }], blocked: true });
  assert.deepEqual([got.maintenance, got.maintenanceReason, got.blocked], [true, 'Refund webhook retries', true]);

  // More than one, and the count is the reason instead.
  got = await store.updateProject(p.id, { subtasks: [{ text: 'Refund webhook retries' }, { text: 'Rotate the API key' }] });
  assert.deepEqual([got.maintenance, got.maintenanceReason], [true, '2 tasks open']);

  // A checked-off task doesn't count, so the last one takes the project back out.
  got = await store.updateProject(p.id, { subtasks: [{ text: 'Refund webhook retries', done: true }, { text: 'Rotate the API key' }] });
  assert.deepEqual([got.maintenance, got.maintenanceReason], [true, 'Rotate the API key']);
  got = await store.updateProject(p.id, { subtasks: [{ text: 'Refund webhook retries', done: true }, { text: 'Rotate the API key', done: true }] });
  assert.deepEqual([got.maintenance, got.maintenanceReason], [false, '']);

  // Only Live counts: the same open task elsewhere is just work in progress.
  got = await store.updateProject(p.id, { status: 'in-progress', subtasks: [{ text: 'Rotate the API key' }] });
  assert.deepEqual([got.maintenance, got.maintenanceReason], [false, '']);
  got = await store.updateProject(p.id, { status: 'live' });
  assert.deepEqual([got.maintenance, got.maintenanceReason], [true, 'Rotate the API key']);

  // The flag is never stored, and can't be set by hand.
  got = await store.updateProject(p.id, { maintenance: false });
  assert.equal(got.maintenance, true);
  assert.doesNotMatch(await fs.readFile(store.projectFile(p.id), 'utf8'), /maintenance/);
});

test('a maintenance flag left in an older file is ignored and dropped on the next save', async () => {
  const store = await freshStore();
  const p = await store.createProject({ title: 'Payments', status: 'live' });
  const file = store.projectFile(p.id);
  await fs.writeFile(file, (await fs.readFile(file, 'utf8')).replace(/^status: live$/m, 'status: live\nmaintenance: true'));

  const got = await store.getProject(p.id);
  assert.equal(got.maintenance, false);
  // And it isn't mistaken for one of the workspace's own properties.
  assert.equal('maintenance' in got.properties, false);

  await store.updateProject(p.id, { title: 'Payments' });
  assert.doesNotMatch(await fs.readFile(file, 'utf8'), /maintenance/);
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

test('groups are saved with the workspace and projects can belong to several', async () => {
  const store = await freshStore();
  const ws = await store.getWorkspace();
  assert.deepEqual(ws.groups, []);

  const saved = await store.saveWorkspace({ ...ws, groups: [{ id: 'integrations', name: ' Integrations ', members: ['Alex', ' alex ', 'Priya', ''] }] });
  assert.deepEqual(saved.groups, [{ id: 'integrations', name: 'Integrations', members: ['Alex', 'Priya'] }]);
  // Saving without groups (an older client) keeps the ones already there.
  await store.saveWorkspace({ columns: ws.columns, properties: ws.properties });
  assert.equal((await store.getWorkspace()).groups.length, 1);
  await assert.rejects(store.saveWorkspace({ ...ws, groups: [{ id: 'a' }, { id: 'a' }] }), (e) => e.status === 400);
  await assert.rejects(store.saveWorkspace({ ...ws, groups: [{ id: '../x' }] }), (e) => e.status === 400);

  const p = await store.createProject({ title: 'Grouped', groups: ['integrations'] });
  assert.deepEqual(p.groups, ['integrations']);
  assert.deepEqual((await store.createProject({ title: 'Loose' })).groups, []);
  await assert.rejects(store.createProject({ title: 'Bad', groups: ['nope'] }), (e) => e.status === 400);
  await assert.rejects(store.updateProject(p.id, { groups: ['integrations', 'nope'] }), (e) => e.status === 400);
  assert.deepEqual((await store.updateProject(p.id, { groups: [] })).groups, []);
  await store.updateProject(p.id, { groups: ['integrations'] });

  // Deleting the group leaves the project without one; the stale id in the file is ignored.
  await store.saveWorkspace({ ...ws, groups: [] });
  assert.deepEqual((await store.getProject(p.id)).groups, []);
  assert.deepEqual((await store.listProjects()).find((x) => x.id === p.id).groups, []);
});

test('a project can share several groups, and one saved with a single group still reads', async () => {
  const store = await freshStore();
  const ws = await store.getWorkspace();
  await store.saveWorkspace({
    ...ws,
    groups: [
      { id: 'core', name: 'Core', members: [] },
      { id: 'cards', name: 'Cards', members: [] },
    ],
  });

  const p = await store.createProject({ title: 'Shared', groups: ['cards', 'core', 'cards'] });
  // Listed the way they're configured, however they were picked.
  assert.deepEqual(p.groups, ['core', 'cards']);
  assert.equal('group' in p, false);
  assert.equal('groups' in p.properties, false);

  const legacy = await store.createProject({ title: 'Legacy' });
  const file = store.projectFile(legacy.id);
  await fs.writeFile(file, (await fs.readFile(file, 'utf8')).replace('order:', 'group: core\norder:'));
  assert.deepEqual((await store.getProject(legacy.id)).groups, ['core']);
  assert.equal('group' in (await store.getProject(legacy.id)).properties, false);

  // Changing the groups moves the file to `groups`; editing anything else leaves it be.
  await store.updateProject(legacy.id, { title: 'Still legacy' });
  assert.match(await fs.readFile(file, 'utf8'), /^group: core$/m);
  await store.updateProject(legacy.id, { groups: ['core', 'cards'] });
  const saved = await fs.readFile(file, 'utf8');
  assert.doesNotMatch(saved, /^group:/m);
  assert.deepEqual((await store.getProject(legacy.id)).groups, ['core', 'cards']);

  assert.deepEqual((await store.updateProject(legacy.id, { groups: [] })).groups, []);
  assert.doesNotMatch(await fs.readFile(file, 'utf8'), /^groups?:/m);
});

test('the event log records creates, column moves and deletes', async () => {
  const store = await freshStore();
  const types = async () => (await store.events.read()).map((e) => [e.type, e.project ?? '', e.from ?? '', e.to ?? '']);

  // A fresh data folder has nothing to backfill, so the log opens with just its marker
  // and then the seeded example project.
  assert.deepEqual(await types(), [
    ['log-started', '', '', ''],
    ['created', 'welcome-to-clique', '', 'in-progress'],
  ]);

  const p = await store.createProject({ title: 'Ledger feed', status: 'backlog' });
  await store.updateProject(p.id, { status: 'live' });
  await store.updateProject(p.id, { title: 'Renamed' }); // not a move: no event
  await store.reorderColumn('graveyard', [p.id]); // dragging a card between columns
  await store.reorderColumn('graveyard', [p.id]); // already there: no event
  await store.deleteProject(p.id);

  assert.deepEqual((await types()).slice(2), [
    ['created', 'ledger-feed', '', 'backlog'],
    ['status', 'ledger-feed', 'backlog', 'live'],
    ['status', 'ledger-feed', 'live', 'graveyard'],
    ['deleted', 'ledger-feed', 'graveyard', ''],
  ]);
  // The title at the time of the event is kept, so the log still reads after a rename.
  assert.equal((await store.events.read()).at(-1).title, 'Renamed');
});

test('an existing data folder is backfilled from the project files, inventing nothing', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'clique-'));
  // A folder written by a version from before the log existed.
  await fs.mkdir(path.join(dir, 'projects', 'older'), { recursive: true });
  await fs.writeFile(
    path.join(dir, 'projects', 'older', 'index.md'),
    stringifyMarkdown({ title: 'Older', status: 'live', created: '2026-02-01T00:00:00.000Z' }, ''),
  );
  await fs.writeFile(path.join(dir, 'workspace.yaml'), 'columns:\n  - id: live\n    name: Live\n');

  const store = new Store(dir);
  await store.init();
  const events = await store.events.read();
  assert.deepEqual(
    events.map((e) => [e.type, e.project ?? '', e.backfilled === true]),
    [
      ['created', 'older', true],
      ['log-started', '', false],
    ],
  );
  // Its real creation date is kept; the status moves it made are gone, so none are written.
  assert.equal(events[0].at, '2026-02-01T00:00:00.000Z');
  assert.equal(events[0].to, undefined);

  // Starting again does not backfill a second time.
  await new Store(dir).init();
  assert.equal((await store.events.read()).length, 2);
});

test('an unreadable line in the log is skipped rather than breaking the page', async () => {
  const store = await freshStore();
  await fs.appendFile(store.eventsFile, 'not json\n\n{"type":"nonsense","at":"2026-01-01T00:00:00.000Z"}\n{"type":"status","at":"bad date"}\n');
  const events = await store.events.read();
  assert.equal(events.some((e) => e.type === 'log-started'), true);
  assert.equal(events.some((e) => e.type === 'nonsense'), false);
});
