import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStats } from './stats.js';

// Local noon, so a test machine in any timezone still lands the event in the month meant.
const at = (y, m, d) => new Date(y, m - 1, d, 12).toISOString();
const NOW = new Date(2026, 9, 18, 12);

const workspace = {
  columns: [
    { id: 'backlog', name: 'Backlog' },
    { id: 'in-progress', name: 'In progress' },
    { id: 'live', name: 'Live' },
    { id: 'graveyard', name: 'Graveyard' },
  ],
  properties: [
    { key: 'owner', name: 'Owners', type: 'people' },
    { key: 'due', name: 'Go-live', type: 'date' },
  ],
  groups: [{ id: 'core', name: 'IT Core', members: ['Ron'] }],
};

const projects = [
  {
    id: 'p-old',
    title: 'Old thing',
    status: 'live',
    group: 'core',
    properties: { owner: ['Ron'] },
    blocked: false,
    maintenance: true,
    subtasks: {
      done: 1,
      total: 2,
      owners: ['Ron'],
      items: [
        { text: 'a', done: true, owners: ['Ron'] },
        { text: 'b', done: false, owners: ['Ron'] },
      ],
    },
    created: at(2026, 3, 10),
    updated: at(2026, 10, 5),
  },
  {
    id: 'p-new',
    title: 'New thing',
    status: 'in-progress',
    group: 'core',
    properties: { owner: ['Ron', 'Ginger'], due: '2026-10-01' },
    blocked: true,
    blockedReason: 'waiting on vendor',
    maintenance: false,
    subtasks: { done: 0, total: 1, owners: ['Ginger'], items: [{ text: 'c', done: false, owners: ['Ginger'] }] },
    created: at(2026, 8, 15),
    updated: at(2026, 10, 12),
  },
  {
    id: 'p-stale',
    title: 'Stale thing',
    status: 'backlog',
    group: null,
    properties: {},
    blocked: false,
    maintenance: false,
    subtasks: { done: 0, total: 0, owners: [], items: [] },
    created: at(2026, 1, 5),
    updated: at(2026, 5, 1),
  },
];

const events = [
  { at: at(2026, 3, 10), type: 'created', project: 'p-old', title: 'Old thing', backfilled: true },
  { at: at(2026, 8, 1), type: 'log-started' },
  { at: at(2026, 8, 15), type: 'created', project: 'p-new', title: 'New thing', to: 'backlog' },
  { at: at(2026, 9, 10), type: 'status', project: 'p-old', title: 'Old thing', from: 'backlog', to: 'live' },
  { at: at(2026, 9, 20), type: 'status', project: 'p-old', title: 'Old thing', from: 'live', to: 'in-progress' },
  { at: at(2026, 10, 5), type: 'status', project: 'p-old', title: 'Old thing', from: 'in-progress', to: 'live' },
  { at: at(2026, 10, 12), type: 'status', project: 'p-new', title: 'New thing', from: 'backlog', to: 'in-progress' },
];

const run = (over = {}) => computeStats({ projects, workspace, events, now: NOW, ...over });

test('snapshot counts come from the project files', () => {
  const s = run();
  assert.deepEqual(s.totals, {
    projects: 3,
    active: 2,
    live: 1,
    graveyard: 0,
    blocked: 1,
    maintenance: 1,
    todos: { done: 1, total: 3 },
  });
  assert.deepEqual(
    s.byStatus.map((x) => [x.id, x.count]),
    [
      ['backlog', 1],
      ['in-progress', 1],
      ['live', 1],
      ['graveyard', 0],
    ],
  );
});

test('groups keep their configured order, and ungrouped projects come last', () => {
  const s = run();
  assert.deepEqual(
    s.byGroup.map((g) => [g.name, g.total, g.active]),
    [
      ['IT Core', 2, 1],
      ['No group', 1, 1],
    ],
  );
  assert.deepEqual(s.byGroup[0].counts, { backlog: 0, 'in-progress': 1, live: 1, graveyard: 0 });
});

test('months before the log started report delivered as not-recorded, not zero', () => {
  const s = run();
  assert.equal(s.months.length, 12);
  assert.equal(s.history.startedAt, at(2026, 8, 1));

  const month = (key) => s.months.find((m) => m.month === key);
  assert.equal(month('2026-07').delivered, null, 'July ended before logging began');
  assert.equal(month('2026-08').delivered, 0, 'August was partly recorded, and nothing went live');
  assert.equal(month('2026-08').partial, true);
  assert.equal(month('2026-09').delivered, 1);
  assert.equal(month('2026-09').partial, false);

  // Creation dates are real even for projects backfilled from their frontmatter.
  assert.equal(month('2026-03').created, 1);
  assert.equal(month('2026-08').created, 1);
});

test('a project returning to Live is not counted as a second delivery', () => {
  const s = run();
  assert.equal(s.delivery.total, 1);
  assert.equal(s.months.find((m) => m.month === '2026-10').delivered, 0);
});

test('cycle time measures creation to the first go-live', () => {
  const s = run();
  assert.equal(s.delivery.sample, 1);
  assert.equal(s.delivery.medianDays, 184);
  assert.equal(s.delivery.averageDays, 184);
  assert.equal(s.delivery.last90, 1);
});

test('attention lists the worst reason first and skips retired projects', () => {
  const s = run();
  assert.deepEqual(
    s.attention.map((a) => [a.id, a.reasons.map((r) => r.kind)]),
    [
      ['p-new', ['blocked', 'overdue']],
      ['p-stale', ['stale']],
    ],
  );
  assert.equal(s.attention[0].reasons[0].detail, 'waiting on vendor');
  assert.equal(s.attention[0].reasons[1].detail, '2026-10-01');
  assert.equal(s.targetProperty.name, 'Go-live');
});

test('a live project is never stale or overdue, but can still be blocked', () => {
  const live = { ...projects[0], blocked: true, blockedReason: 'vendor patch', updated: at(2025, 1, 1) };
  const s = computeStats({ projects: [live], workspace, events, now: NOW });
  assert.deepEqual(s.attention.map((a) => a.reasons.map((r) => r.kind)), [['blocked']]);
});

test('people are counted once per project and carry their group', () => {
  const s = run();
  const by = Object.fromEntries(s.people.map((p) => [p.name, p]));
  assert.deepEqual(by.Ron, { name: 'Ron', groups: ['IT Core'], active: 1, live: 1, openTodos: 1, doneTodos: 1 });
  assert.deepEqual(by.Ginger, { name: 'Ginger', groups: [], active: 1, live: 0, openTodos: 1, doneTodos: 0 });
});

test('recent activity is newest first and flags projects that no longer exist', () => {
  const s = run();
  assert.equal(s.recent.length, 6, 'the log-started marker is not activity');
  assert.deepEqual(s.recent[0], {
    at: at(2026, 10, 12),
    type: 'status',
    project: 'p-new',
    title: 'New thing',
    from: 'backlog',
    to: 'in-progress',
    fromName: 'Backlog',
    toName: 'In progress',
    backfilled: false,
    exists: true,
  });
  const gone = computeStats({ projects: [], workspace, events, now: NOW });
  assert.equal(gone.recent.every((r) => r.exists === false), true);
});

test('an empty log reports no history rather than zeroes', () => {
  const s = computeStats({ projects, workspace, events: [], now: NOW });
  assert.equal(s.history.startedAt, null);
  assert.equal(s.months.every((m) => m.delivered === null), true);
  assert.deepEqual(s.delivery, { total: 0, last90: 0, medianDays: null, averageDays: null, sample: 0 });
  // The snapshot still works without any history at all.
  assert.equal(s.totals.projects, 3);
});

test('a workspace with no date property simply has nothing overdue', () => {
  const ws = { ...workspace, properties: [workspace.properties[0]] };
  const s = computeStats({ projects, workspace: ws, events, now: NOW });
  assert.equal(s.targetProperty, null);
  assert.equal(s.attention.some((a) => a.reasons.some((r) => r.kind === 'overdue')), false);
});
