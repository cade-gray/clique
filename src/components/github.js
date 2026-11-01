// Linking to-dos to GitHub issues. Clique holds no GitHub login: a new issue is written on GitHub
// itself under the person's own account, from a pre-filled form, and its link is pasted back here.

// GitHub's new-issue form with the to-do filled in.
export function newIssueUrl(repo, { text, owners = [], projectTitle, url }) {
  const lines = [`To-do on ${projectTitle}.`];
  if (owners.length) lines.push(`Owner${owners.length > 1 ? 's' : ''}: ${owners.join(', ')}`);
  lines.push('', `[Open in Clique](${url})`);
  return `${repo}/issues/new?title=${encodeURIComponent(text)}&body=${encodeURIComponent(lines.join('\n'))}`;
}

// The issue's address from what was pasted or typed: a number, or a link to an issue in this
// repository. Null for anything else, including a pull request or an issue in another repository.
export function issueLink(input, repo) {
  const text = String(input ?? '').trim();
  const number = /^#?([1-9]\d*)$/.exec(text);
  if (number) return `${repo}/issues/${number[1]}`;
  const link = /^(?:https?:\/\/)?(.+?)\/issues\/([1-9]\d*)(?:[/?#].*)?$/i.exec(text);
  if (!link || `https://${link[1]}`.toLowerCase() !== repo.toLowerCase()) return null;
  return `${repo}/issues/${link[2]}`;
}

export function issueNumber(url) {
  return /\/issues\/(\d+)$/.exec(url)?.[1] ?? '';
}
