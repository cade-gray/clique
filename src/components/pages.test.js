import assert from 'node:assert/strict';
import test from 'node:test';
import { docsOf, splitPages, todoOf } from './pages.js';

const pages = [
  { id: 'runbook', title: 'Runbook' },
  { id: 'design', title: 'Design' },
  { id: 'mapping', title: 'Mapping' },
];

test('splitPages keeps unlinked pages in the wiki, including on a project with no to-dos', () => {
  assert.deepEqual(splitPages(pages, []), { wiki: pages, todoDocs: [] });
  const { wiki, todoDocs } = splitPages(pages, [{ text: 'a', docs: ['mapping', 'design'] }, { text: 'b' }]);
  assert.deepEqual(wiki.map((p) => p.id), ['runbook']);
  assert.deepEqual(todoDocs.map((p) => p.id), ['design', 'mapping']);
});

test('todoOf finds the to-do a page belongs to, finished or not', () => {
  const done = { text: 'a', done: true, docs: ['design'] };
  assert.equal(todoOf('design', [{ text: 'b' }, done]), done);
  assert.equal(todoOf('runbook', [{ text: 'b' }, done]), null);
});

test('docsOf lists a to-do\'s pages in the order they were added and skips unknown ids', () => {
  assert.deepEqual(docsOf({ docs: ['mapping', 'nope', 'design'] }, pages).map((p) => p.id), ['mapping', 'design']);
  assert.deepEqual(docsOf({ text: 'no docs' }, pages), []);
});
