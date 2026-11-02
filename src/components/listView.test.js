import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_VIEW, savedView } from './listView.js';

test('a browser with nothing saved gets the defaults', () => {
  assert.deepEqual(savedView(null), DEFAULT_VIEW);
});

test('settings saved under the old to-do names carry over', () => {
  const saved = JSON.stringify({ hidden: ['group'], todos: false, doneTodos: false, todoOwners: false });
  assert.deepEqual(savedView(saved), { hidden: ['group'], tasks: false, doneTasks: false, taskOwners: false });
});

test('settings saved under the current names are kept, and missing ones default', () => {
  assert.deepEqual(savedView(JSON.stringify({ tasks: false })), { ...DEFAULT_VIEW, tasks: false });
});
