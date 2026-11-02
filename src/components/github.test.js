import assert from 'node:assert/strict';
import test from 'node:test';
import { isIssueNumber, issueLabel, issueLink, issueNumber, newIssueUrl, repoPath } from './github.js';

const repo = 'https://github.com/cade-gray/clique';

test('the new-issue form is filled in from the task', () => {
  const url = new URL(newIssueUrl(repo, { text: 'Fix & ship #1', owners: ['Sam', 'Priya'], projectTitle: 'Clique', url: 'https://clique.local/#/p/clique' }));
  assert.equal(url.origin + url.pathname, `${repo}/issues/new`);
  assert.equal(url.searchParams.get('title'), 'Fix & ship #1');
  assert.equal(url.searchParams.get('body'), 'Task on Clique.\nOwners: Sam, Priya\n\n[Open in Clique](https://clique.local/#/p/clique)');
});

test('the form leaves out owners when the task has none, and says Owner for one', () => {
  const body = (owners) => new URL(newIssueUrl(repo, { text: 'x', owners, projectTitle: 'P', url: 'u' })).searchParams.get('body');
  assert.equal(body(undefined), 'Task on P.\n\n[Open in Clique](u)');
  assert.equal(body(['Sam']), 'Task on P.\nOwner: Sam\n\n[Open in Clique](u)');
});

test('issueLink turns a number or a link in this repository into the issue\'s address', () => {
  const issue = `${repo}/issues/27`;
  for (const input of ['27', '#27', ' 27 ', issue, `${issue}/`, `${issue}#issuecomment-1`, `${issue}?foo=bar`, 'http://github.com/cade-gray/clique/issues/27', 'github.com/cade-gray/clique/issues/27', 'https://GitHub.com/Cade-Gray/Clique/issues/27'])
    assert.equal(issueLink(input, [repo]), issue, input);
});

test('issueLink refuses anything that isn\'t an issue in this repository', () => {
  for (const input of ['', null, undefined, '0', '#0', 'abc', '12a', `${repo}/pull/29`, `${repo}/issues`, `${repo}/issues/new`, 'https://github.com/cade-gray/other/issues/27', 'https://example.com/cade-gray/clique/issues/27', 'javascript:alert(1)'])
    assert.equal(issueLink(input, [repo]), null, String(input));
});

test('with several repositories, a link finds its own and a number uses the chosen one', () => {
  const other = 'https://github.com/cade-gray/site';
  const repos = [repo, other];
  assert.equal(issueLink(`${other}/issues/4`, repos), `${other}/issues/4`);
  assert.equal(issueLink('GitHub.com/CADE-gray/site/issues/4', repos, repo), `${other}/issues/4`);
  assert.equal(issueLink('#4', repos, other), `${other}/issues/4`);
  assert.equal(issueLink('4', repos), `${repo}/issues/4`);
  assert.equal(issueLink('https://github.com/cade-gray/elsewhere/issues/4', repos), null);
});

test('isIssueNumber is true only for what issueLink reads as a number', () => {
  for (const input of ['4', '#4', ' 27 ']) assert.equal(isIssueNumber(input), true, input);
  for (const input of ['', null, '0', '#0', '4a', `${repo}/issues/4`]) assert.equal(isIssueNumber(input), false, String(input));
});

test('repoPath shortens a repository to owner/name', () => {
  assert.equal(repoPath(repo), 'cade-gray/clique');
  assert.equal(repoPath('https://github.acme.bank/it/core.sync'), 'it/core.sync');
});

test('issueLabel names the repository only when the number alone would be unclear', () => {
  const other = 'https://github.com/cade-gray/site';
  assert.equal(issueLabel(`${repo}/issues/12`, [repo]), '#12');
  assert.equal(issueLabel(`${repo.toUpperCase()}/issues/12`, [repo]), '#12');
  assert.equal(issueLabel(`${repo}/issues/12`, [repo, other]), 'clique#12');
  assert.equal(issueLabel(`${other}/issues/12`, [repo]), 'site#12');
  assert.equal(issueLabel(`${repo}/issues/12`, []), 'clique#12');
});

test('issueNumber reads the number from a linked issue', () => {
  assert.equal(issueNumber(`${repo}/issues/27`), '27');
  assert.equal(issueNumber('nope'), '');
});
