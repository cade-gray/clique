import assert from 'node:assert/strict';
import test from 'node:test';
import { docOf, splitPages, taskOf } from './pages.js';

const pages = [
  { id: 'runbook', title: 'Runbook' },
  { id: 'design', title: 'Design' },
  { id: 'mapping', title: 'Mapping' },
];

test('splitPages keeps unlinked pages in the wiki, including on a project with no tasks', () => {
  assert.deepEqual(splitPages(pages, []), { wiki: pages, taskDocs: [] });
  const { wiki, taskDocs } = splitPages(pages, [{ text: 'a', doc: 'mapping' }, { text: 'b', doc: 'design' }, { text: 'c' }]);
  assert.deepEqual(wiki.map((p) => p.id), ['runbook']);
  assert.deepEqual(taskDocs.map((p) => p.id), ['design', 'mapping']);
});

test('taskOf finds the task a page belongs to, finished or not', () => {
  const done = { text: 'a', done: true, doc: 'design' };
  assert.equal(taskOf('design', [{ text: 'b' }, done]), done);
  assert.equal(taskOf('runbook', [{ text: 'b' }, done]), null);
});

test('docOf finds a task\'s page, and copes with none or an unknown id', () => {
  assert.equal(docOf({ doc: 'mapping' }, pages), pages[2]);
  assert.equal(docOf({ doc: 'nope' }, pages), null);
  assert.equal(docOf({ text: 'no doc' }, pages), null);
});
