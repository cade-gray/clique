import assert from 'node:assert/strict';
import test from 'node:test';
import { findTodo, todosFor, withTodo, workdayPeople } from './workday.js';

const workspace = {
  columns: [{ id: 'backlog' }, { id: 'in-progress' }, { id: 'live' }, { id: 'graveyard' }],
  groups: [{ id: 'core', name: 'Core', members: ['Priya', 'Sam'] }],
};

const project = (id, status, items, extra = {}) => ({ id, title: id, status, blocked: false, blockedReason: '', subtasks: { items }, ...extra });

test('workdayPeople lists group members and to-do owners once each, ignoring case', () => {
  const projects = [project('a', 'backlog', [{ text: 'x', owners: ['Mason', 'sam'] }, { text: 'no owner' }])];
  assert.deepEqual(workdayPeople(workspace, projects), ['Mason', 'Priya', 'Sam']);
});

test('workdayPeople leaves out people whose only to-dos are on retired projects', () => {
  const projects = [project('old', 'graveyard', [{ text: 'x', owners: ['Jordan'] }])];
  assert.deepEqual(workdayPeople(workspace, projects), ['Priya', 'Sam']);
});

test('todosFor collects a person\'s to-dos across projects in board order, ignoring case', () => {
  const projects = [
    project('live', 'live', [{ text: 'live todo', owners: ['Sam'] }]),
    project('first', 'backlog', [{ text: 'mine', owners: ['SAM', 'Priya'] }, { text: 'theirs', owners: ['Priya'] }, { text: 'nobody' }]),
    project('second', 'in-progress', [{ text: 'also mine', owners: ['sam'] }]),
    project('third', 'backlog', [{ text: 'mine too', owners: ['Sam'] }]),
  ];
  const { open, done } = todosFor('Sam', projects, workspace);
  assert.deepEqual(open.map((t) => [t.project.id, t.text]), [
    ['first', 'mine'],
    ['third', 'mine too'],
    ['second', 'also mine'],
    ['live', 'live todo'],
  ]);
  assert.deepEqual(done, []);
});

test('todosFor keeps each row distinct when a project has identical to-dos', () => {
  const projects = [project('a', 'backlog', [{ text: 'same', owners: ['Sam'] }, { text: 'same', owners: ['Sam'] }])];
  const [first, second] = todosFor('Sam', projects, workspace).open;
  assert.notEqual(first.key, second.key);
});

test('todosFor leaves out retired projects and does not reorder the list it was given', () => {
  const projects = [project('b', 'live', []), project('old', 'graveyard', [{ text: 'x', owners: ['Sam'] }]), project('a', 'backlog', [])];
  assert.deepEqual(todosFor('Sam', projects, workspace).open, []);
  assert.deepEqual(projects.map((p) => p.id), ['b', 'old', 'a']);
});

test('finished to-dos are split out, most recent first', () => {
  const items = [
    { text: 'older', done: true, doneAt: '2026-10-01T10:00:00.000Z', owners: ['Sam'] },
    { text: 'open', done: false, owners: ['Sam'] },
    { text: 'newer', done: true, doneAt: '2026-10-20T10:00:00.000Z', owners: ['Sam'] },
    { text: 'no date', done: true, owners: ['Sam'] },
  ];
  const { open, done } = todosFor('Sam', [project('a', 'backlog', items)], workspace);
  assert.deepEqual(open.map((t) => t.text), ['open']);
  assert.deepEqual(done.map((t) => t.text), ['newer', 'older', 'no date']);
});

test('a blocked project marks its open to-dos as potentially blocked, and nothing else', () => {
  const projects = [
    project('stuck', 'backlog', [{ text: 'open', owners: ['Sam'] }, { text: 'finished', done: true, owners: ['Sam'] }], { blocked: true, blockedReason: 'Waiting on vendor' }),
    project('fine', 'backlog', [{ text: 'clear', owners: ['Sam'] }]),
  ];
  const { open, done } = todosFor('Sam', projects, workspace);
  assert.deepEqual(open.map((t) => [t.text, t.potentialBlocker]), [['open', true], ['clear', false]]);
  assert.equal(open[0].project.blockedReason, 'Waiting on vendor');
  assert.equal(done[0].potentialBlocker, false);
  // The to-do itself is not marked blocked; only the label says anything about it.
  assert.equal('blocked' in open[0], false);
});

test('findTodo follows a to-do that moved, and refuses one it can\'t be sure of', () => {
  const items = [{ text: 'a' }, { text: 'b' }, { text: 'b' }, { text: 'c' }];
  assert.equal(findTodo(items, 'a'), 0);
  assert.equal(findTodo(items, 'c'), 3);
  assert.equal(findTodo(items, 'gone'), -1);
  assert.equal(findTodo(items, 'b'), -1);
});

test('withTodo changes one to-do and keeps everything else on the list', () => {
  const items = [{ text: 'a', owners: ['Sam'], doc: 'notes' }, { text: 'b', done: true, doneAt: 'then' }];
  const changed = withTodo(items, 0, { issue: 'x' });
  assert.deepEqual(changed, [{ text: 'a', owners: ['Sam'], doc: 'notes', issue: 'x' }, items[1]]);
  assert.deepEqual(JSON.parse(JSON.stringify(withTodo(changed, 0, { issue: undefined }))), items);
});
