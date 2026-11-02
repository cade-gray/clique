import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currentPerspective, groupNames, inPerspective } from './perspective.js';

const groups = [
  { id: 'core', name: 'IT Core', members: [] },
  { id: 'cards', name: 'IT Cards', members: [] },
];

test('a perspective whose group is gone falls back to the whole board', () => {
  assert.equal(currentPerspective('core', groups), 'core');
  assert.equal(currentPerspective('deleted', groups), '');
  assert.equal(currentPerspective(null, groups), '');
});

test('a project shows in the perspective of each of its groups', () => {
  const shared = { groups: ['core', 'cards'] };
  assert.equal(inPerspective(shared, 'core'), true);
  assert.equal(inPerspective(shared, 'cards'), true);
  assert.equal(inPerspective({ groups: ['core'] }, 'cards'), false);
});

test('the whole board includes projects without a group', () => {
  assert.equal(inPerspective({ groups: [] }, ''), true);
  assert.equal(inPerspective({ groups: [] }, 'core'), false);
});

test('group names follow the configured order', () => {
  assert.deepEqual(groupNames({ groups: ['cards', 'core'] }, groups), ['IT Core', 'IT Cards']);
  assert.deepEqual(groupNames({ groups: [] }, groups), []);
});
