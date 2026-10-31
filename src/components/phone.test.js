import assert from 'node:assert/strict';
import test from 'node:test';
import { cardSummary, paneAt, placeInColumn } from './phone.js';

test('placeInColumn moves a card up and down among visible cards', () => {
  const allIds = ['a', 'b', 'c', 'd'];
  const visibleIds = allIds;
  assert.deepEqual(placeInColumn({ allIds, visibleIds, id: 'c', index: 1 }), ['a', 'c', 'b', 'd']);
  assert.deepEqual(placeInColumn({ allIds, visibleIds, id: 'b', index: 2 }), ['a', 'c', 'b', 'd']);
});

test('placeInColumn keeps cards hidden by a filter where they were', () => {
  // b and d are filtered out; moving c above a must not disturb them.
  const allIds = ['a', 'b', 'c', 'd'];
  assert.deepEqual(placeInColumn({ allIds, visibleIds: ['a', 'c'], id: 'c', index: 0 }), ['c', 'a', 'b', 'd']);
  // Past the last visible card it lands just after it, not at the very end.
  assert.deepEqual(placeInColumn({ allIds, visibleIds: ['a', 'c'], id: 'a', index: 1 }), ['b', 'c', 'a', 'd']);
});

test('placeInColumn adds a card from another stage to the end', () => {
  assert.deepEqual(placeInColumn({ allIds: ['a', 'b'], visibleIds: ['a', 'b'], id: 'z', index: Infinity }), ['a', 'b', 'z']);
  assert.deepEqual(placeInColumn({ allIds: [], visibleIds: [], id: 'z', index: Infinity }), ['z']);
  // A stage hidden by a status filter has no visible cards.
  assert.deepEqual(placeInColumn({ allIds: ['a'], visibleIds: [], id: 'z', index: Infinity }), ['a', 'z']);
});

test('cardSummary picks the first filled property of each type', () => {
  const properties = [
    { key: 'risk', type: 'select', options: [] },
    { key: 'priority', type: 'select', options: [{ value: 'High', color: 'red' }] },
    { key: 'owner', type: 'people' },
    { key: 'due', type: 'date' },
  ];
  const project = { properties: { risk: '', priority: 'High', owner: ['Alex', 'Sam'], due: '2026-12-04' } };
  assert.deepEqual(cardSummary(project, properties), { tag: { value: 'High', color: 'red' }, people: ['Alex', 'Sam'], date: '2026-12-04' });
});

test('cardSummary copes with empty properties and a single name stored as text', () => {
  const properties = [{ key: 'owner', type: 'people' }];
  assert.deepEqual(cardSummary({ properties: {} }, properties), { tag: null, people: [], date: null });
  assert.equal(cardSummary({ properties: { owner: 'Alex' } }, properties).people[0], 'Alex');
});

test('paneAt rounds to the nearest pane and stays in range', () => {
  assert.equal(paneAt(0, 390, 5), 0);
  assert.equal(paneAt(780, 390, 5), 2);
  assert.equal(paneAt(600, 390, 5), 2);
  assert.equal(paneAt(5000, 390, 5), 4);
  assert.equal(paneAt(0, 0, 5), 0);
  assert.equal(paneAt(100, 390, 0), 0);
});
