import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { taskChanges } from './events.js';
import { Store } from './store.js';

const task = (text, done = false) => ({ text, done });
const changed = (before, after) => taskChanges(before, after).map((t) => [t.text, t.done]);

test('taskChanges finds tasks checked off and unchecked', () => {
  assert.deepEqual(changed([task('a'), task('b', true)], [task('a', true), task('b')]), [['a', true], ['b', false]]);
});

test('taskChanges ignores tasks added, removed, reordered or reworded', () => {
  const before = [task('a'), task('b', true), task('c')];
  assert.deepEqual(changed(before, [...before, task('new')]), []);
  assert.deepEqual(changed(before, before.slice(1)), []);
  assert.deepEqual(changed(before, [...before].reverse()), []);
  assert.deepEqual(changed(before, [task('a, reworded'), task('b', true), task('c')]), []);
});

test('taskChanges counts one change when one of two identical tasks is checked off', () => {
  const after = [task('same'), task('same', true)];
  assert.deepEqual(changed([task('same'), task('same')], after), [['same', true]]);
  assert.deepEqual(changed([task('same'), task('same')], [...after].reverse()), [['same', true]]);
});

async function project() {
  const store = new Store(await fs.mkdtemp(path.join(os.tmpdir(), 'clique-')));
  await store.init();
  const { id } = await store.createProject({ title: 'Ledger feed' });
  const taskEvents = async () => (await store.events.read()).filter((e) => e.type === 'task');
  return { store, id, taskEvents };
}

test('checking a task off and back is logged with its project, text and owners', async () => {
  const { store, id, taskEvents } = await project();
  await store.updateProject(id, { subtasks: [{ text: 'Map fields', done: false, owners: ['Sam', 'Priya'] }, { text: 'Test', done: false }] });
  assert.deepEqual(await taskEvents(), [], 'adding tasks is not finishing them');

  await store.updateProject(id, { subtasks: [{ text: 'Map fields', done: true, owners: ['Sam', 'Priya'] }, { text: 'Test', done: false }] });
  await store.updateProject(id, { subtasks: [{ text: 'Map fields', done: false, owners: ['Sam', 'Priya'] }, { text: 'Test', done: false }] });

  const events = await taskEvents();
  assert.deepEqual(events.map(({ at, ...e }) => e), [
    { type: 'task', project: id, title: 'Ledger feed', text: 'Map fields', done: true, owners: ['Sam', 'Priya'] },
    { type: 'task', project: id, title: 'Ledger feed', text: 'Map fields', done: false, owners: ['Sam', 'Priya'] },
  ]);
  assert.equal(events.every((e) => !Number.isNaN(new Date(e.at).getTime())), true);
});

test('a task with no owners is logged with an empty list', async () => {
  const { store, id, taskEvents } = await project();
  await store.updateProject(id, { subtasks: [{ text: 'Test', done: false }] });
  await store.updateProject(id, { subtasks: [{ text: 'Test', done: true }] });
  assert.deepEqual((await taskEvents())[0].owners, []);
});

test('saves that leave the tasks alone log nothing, and neither does a failed save', async () => {
  const { store, id, taskEvents } = await project();
  await store.updateProject(id, { subtasks: [{ text: 'Test', done: true }] });
  await store.updateProject(id, { title: 'Renamed' });
  await store.updateProject(id, { subtasks: [{ text: 'Test', done: true, issue: 'https://github.com/acme/site/issues/1' }] });
  await assert.rejects(store.updateProject(id, { status: 'nowhere', subtasks: [{ text: 'Test', done: false }] }));
  assert.deepEqual(await taskEvents(), []);
});

test('a new project imported with finished tasks logs none of them', async () => {
  const { store, id, taskEvents } = await project();
  await store.updateProject(id, { subtasks: [{ text: 'Already done', done: true }] });
  assert.deepEqual(await taskEvents(), []);
});

test('a task event survives a read back from the file', async () => {
  const { store, id } = await project();
  await store.updateProject(id, { subtasks: [{ text: 'Test', done: false }] });
  await store.updateProject(id, { subtasks: [{ text: 'Test', done: true }] });
  const line = (await fs.readFile(store.eventsFile, 'utf8')).trim().split('\n').at(-1);
  assert.equal(JSON.parse(line).type, 'task');
  assert.equal((await store.events.read()).at(-1).text, 'Test');
});
