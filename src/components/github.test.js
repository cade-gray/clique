import assert from 'node:assert/strict';
import test from 'node:test';
import { issueLink, issueNumber, newIssueUrl } from './github.js';

const repo = 'https://github.com/cade-gray/clique';

test('the new-issue form is filled in from the to-do', () => {
  const url = new URL(newIssueUrl(repo, { text: 'Fix & ship #1', owners: ['Sam', 'Priya'], projectTitle: 'Clique', url: 'https://clique.local/#/p/clique' }));
  assert.equal(url.origin + url.pathname, `${repo}/issues/new`);
  assert.equal(url.searchParams.get('title'), 'Fix & ship #1');
  assert.equal(url.searchParams.get('body'), 'To-do on Clique.\nOwners: Sam, Priya\n\n[Open in Clique](https://clique.local/#/p/clique)');
});

test('the form leaves out owners when the to-do has none, and says Owner for one', () => {
  const body = (owners) => new URL(newIssueUrl(repo, { text: 'x', owners, projectTitle: 'P', url: 'u' })).searchParams.get('body');
  assert.equal(body(undefined), 'To-do on P.\n\n[Open in Clique](u)');
  assert.equal(body(['Sam']), 'To-do on P.\nOwner: Sam\n\n[Open in Clique](u)');
});

test('issueLink turns a number or a link in this repository into the issue\'s address', () => {
  const issue = `${repo}/issues/27`;
  for (const input of ['27', '#27', ' 27 ', issue, `${issue}/`, `${issue}#issuecomment-1`, `${issue}?foo=bar`, 'http://github.com/cade-gray/clique/issues/27', 'github.com/cade-gray/clique/issues/27', 'https://GitHub.com/Cade-Gray/Clique/issues/27'])
    assert.equal(issueLink(input, repo), issue, input);
});

test('issueLink refuses anything that isn\'t an issue in this repository', () => {
  for (const input of ['', null, undefined, '0', '#0', 'abc', '12a', `${repo}/pull/29`, `${repo}/issues`, `${repo}/issues/new`, 'https://github.com/cade-gray/other/issues/27', 'https://example.com/cade-gray/clique/issues/27', 'javascript:alert(1)'])
    assert.equal(issueLink(input, repo), null, String(input));
});

test('issueNumber reads the number from a linked issue', () => {
  assert.equal(issueNumber(`${repo}/issues/27`), '27');
  assert.equal(issueNumber('nope'), '');
});
