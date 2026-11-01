import assert from 'node:assert/strict';
import test from 'node:test';
import { docOf, splitPages, todoOf } from './pages.js';

const pages = [
  { id: 'runbook', title: 'Runbook' },
  { id: 'design', title: 'Design' },
  { id: 'mapping', title: 'Mapping' },
];

test('splitPages keeps unlinked pages in the wiki, including on a project with no to-dos', () => {
  assert.deepEqual(splitPages(pages, []), { wiki: pages, todoDocs: [] });
  const { wiki, todoDocs } = splitPages(pages, [{ text: 'a', doc: 'mapping' }, { text: 'b', doc: 'design' }, { text: 'c' }]);
  assert.deepEqual(wiki.map((p) => p.id), ['runbook']);
  assert.deepEqual(todoDocs.map((p) => p.id), ['design', 'mapping']);
});

test('todoOf finds the to-do a page belongs to, finished or not', () => {
  const done = { text: 'a', done: true, doc: 'design' };
  assert.equal(todoOf('design', [{ text: 'b' }, done]), done);
  assert.equal(todoOf('runbook', [{ text: 'b' }, done]), null);
});

test('docOf finds a to-do\'s page, and copes with none or an unknown id', () => {
  assert.equal(docOf({ doc: 'mapping' }, pages), pages[2]);
  assert.equal(docOf({ doc: 'nope' }, pages), null);
  assert.equal(docOf({ text: 'no doc' }, pages), null);
});
