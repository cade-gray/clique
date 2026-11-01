// Linking to-dos to GitHub issues. Clique holds no GitHub login: a new issue is written on GitHub
// itself under the person's own account, from a pre-filled form, and its link is pasted back here.

// GitHub's new-issue form with the to-do filled in.
export function newIssueUrl(repo, { text, owners = [], projectTitle, url }) {
  const lines = [`To-do on ${projectTitle}.`];
  if (owners.length) lines.push(`Owner${owners.length > 1 ? 's' : ''}: ${owners.join(', ')}`);
  lines.push('', `[Open in Clique](${url})`);
  return `${repo}/issues/new?title=${encodeURIComponent(text)}&body=${encodeURIComponent(lines.join('\n'))}`;
}

// owner/name, the way GitHub writes a repository.
export function repoPath(repo) {
  return repo.replace(/^https?:\/\/[^/]+\//, '');
}

// A bare number says nothing about which repository it's in, so it needs one chosen.
export function isIssueNumber(input) {
  return /^#?[1-9]\d*$/.test(String(input ?? '').trim());
}

// The issue's address from what was pasted or typed: a number in the chosen repository, or a link
// to an issue in any of them. Null for anything else, including a pull request or an issue in a
// repository that isn't one of these.
export function issueLink(input, repos, chosen = repos[0]) {
  const text = String(input ?? '').trim();
  if (isIssueNumber(text)) return `${chosen}/issues/${text.replace('#', '')}`;
  const link = /^(?:https?:\/\/)?(.+?)\/issues\/([1-9]\d*)(?:[/?#].*)?$/i.exec(text);
  const repo = link && repos.find((r) => r.toLowerCase() === `https://${link[1]}`.toLowerCase());
  return repo ? `${repo}/issues/${link[2]}` : null;
}

export function issueNumber(url) {
  return /\/issues\/(\d+)$/.exec(url)?.[1] ?? '';
}

// #12 when the project's one repository is the only place it could be, and name#12 otherwise. That
// includes an issue left linked after its repository was removed from the project.
export function issueLabel(url, repos) {
  const number = `#${issueNumber(url)}`;
  if (repos.length === 1 && url.toLowerCase().startsWith(`${repos[0].toLowerCase()}/`)) return number;
  const name = /\/([^/]+)\/issues\/\d+$/.exec(url)?.[1];
  return name ? `${name}${number}` : number;
}
