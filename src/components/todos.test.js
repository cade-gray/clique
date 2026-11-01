import assert from 'node:assert/strict';
import test from 'node:test';
import { edgeSpeed, moveToSlot, movesNowhere, slotAt } from './todos.js';

test('slotAt picks the gap nearest the pointer, using each to-do\'s midpoint', () => {
  const midpoints = [100, 200, 300];
  assert.equal(slotAt(midpoints, 0), 0);
  assert.equal(slotAt(midpoints, 99), 0);
  assert.equal(slotAt(midpoints, 100), 1);
  assert.equal(slotAt(midpoints, 250), 2);
  assert.equal(slotAt(midpoints, 299), 2);
  assert.equal(slotAt(midpoints, 300), 3);
  assert.equal(slotAt(midpoints, 9999), 3);
  assert.equal(slotAt([], 50), 0);
});

test('movesNowhere covers the slots on either side of the to-do and no others', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map((slot) => movesNowhere(1, slot)), [false, true, true, false, false]);
});

test('edgeSpeed scrolls only near the edges, faster the closer the finger gets', () => {
  assert.equal(edgeSpeed(400, 800), 0);
  assert.equal(edgeSpeed(80, 800), 0);
  assert.equal(edgeSpeed(720, 800), 0);
  assert.equal(edgeSpeed(40, 800), -6);
  assert.equal(edgeSpeed(760, 800), 6);
  assert.equal(edgeSpeed(0, 800), -12);
  assert.equal(edgeSpeed(800, 800), 12);
  // A captured pointer can report positions past the screen.
  assert.equal(edgeSpeed(-50, 800), -12);
  assert.equal(edgeSpeed(900, 800), 12);
});

const names = (list) => list.map((t) => t.text);
const todo = (text, done = false) => ({ text, done });

test('moveToSlot moves a to-do up and down, and to either end', () => {
  const items = ['a', 'b', 'c', 'd'].map((t) => todo(t));
  const move = (from, slot) => names(moveToSlot(items, items, from, slot));
  assert.deepEqual(move(2, 0), ['c', 'a', 'b', 'd']);
  assert.deepEqual(move(2, 1), ['a', 'c', 'b', 'd']);
  assert.deepEqual(move(0, 2), ['b', 'a', 'c', 'd']);
  assert.deepEqual(move(0, 3), ['b', 'c', 'a', 'd']);
  assert.deepEqual(move(0, 4), ['b', 'c', 'd', 'a']);
  assert.deepEqual(names(items), ['a', 'b', 'c', 'd']);
});

test('moveToSlot leaves the list as it was for a move to where the to-do already is', () => {
  const items = ['a', 'b', 'c'].map((t) => todo(t));
  assert.deepEqual(names(moveToSlot(items, items, 1, 1)), ['a', 'b', 'c']);
  assert.deepEqual(names(moveToSlot(items, items, 1, 2)), ['a', 'b', 'c']);
});

test('moveToSlot keeps checked-off to-dos in place around the open ones', () => {
  const items = [todo('done 1', true), todo('a'), todo('done 2', true), todo('b'), todo('c'), todo('done 3', true)];
  const open = items.filter((t) => !t.done);
  // Above the first open to-do lands just before it, after the finished one at the top.
  assert.deepEqual(names(moveToSlot(items, open, 2, 0)), ['done 1', 'c', 'a', 'done 2', 'b', 'done 3']);
  // Below the last open to-do lands just after it, before the finished one at the bottom.
  assert.deepEqual(names(moveToSlot(items, open, 0, 3)), ['done 1', 'done 2', 'b', 'c', 'a', 'done 3']);
});

test('moveToSlot keeps the same to-do objects, with their owners and linked doc', () => {
  const a = { text: 'a', done: false, owners: ['Sam'], doc: 'design' };
  const b = todo('b');
  const moved = moveToSlot([a, b], [a, b], 0, 2);
  assert.equal(moved[1], a);
  assert.equal(moved.length, 2);
});
