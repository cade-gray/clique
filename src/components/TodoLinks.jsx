// The notes and GitHub issue controls on a to-do, shared by the project page and the workday page.

import { useRef, useState } from 'react';
import Popover from './Popover.jsx';
import { isIssueNumber, issueLabel, issueLink, newIssueUrl, repoPath } from './github.js';
import { toPeople } from './props.jsx';

export function AddNotes({ onClick }) {
  return (
    <button className="add-doc" onClick={onClick} title="Write notes for this task">
      📝 Add notes
    </button>
  );
}

// `url` is the address the new issue links back to. `onChange` gets the issue's address, or nothing to unlink it.
export function TodoIssue({ issue, repos, text, owners, projectTitle, url = window.location.href, onChange }) {
  if (!issue) return repos.length > 0 && <IssueBlock repos={repos} text={text} owners={owners} projectTitle={projectTitle} url={url} onLink={onChange} />;
  return (
    <span className="subtask-issue">
      <IssueLink url={issue} repos={repos} />
      <button className="icon" onClick={() => onChange(undefined)} aria-label={`Unlink issue ${issueLabel(issue, repos)}`} title="Unlink this issue">
        ×
      </button>
    </span>
  );
}

// The page is named after the to-do, so the title would only repeat the line above it.
export function TodoDoc({ page, base, onOpen }) {
  if (!page) return null;
  return (
    <a className="subtask-doc" href={`${base}/${encodeURIComponent(page.id)}`} title={page.title} aria-label={`Notes: ${page.title}`} onClick={onOpen}>
      📝 Notes
    </a>
  );
}

export function IssueLink({ url, repos }) {
  return (
    <a className="subtask-issue-link" href={url} target="_blank" rel="noreferrer" title="Open on GitHub">
      🔗 {issueLabel(url, repos)}
    </a>
  );
}

function IssueBlock({ repos, text, owners, projectTitle, url, onLink }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef(null);
  return (
    <span className="schedule">
      <button ref={anchor} className="schedule-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)} title="Create or link a GitHub issue">
        🔗 Issue
      </button>
      {open && (
        <IssueMenu
          anchor={anchor}
          repos={repos}
          newIssue={(repo) => newIssueUrl(repo, { text, owners: toPeople(owners), projectTitle, url })}
          onLink={onLink}
          onClose={() => setOpen(false)}
        />
      )}
    </span>
  );
}

// Stays open when the form opens in its own tab, ready for the new issue's link on the way back.
function IssueMenu({ anchor, repos, newIssue, onLink, onClose }) {
  const [value, setValue] = useState('');
  const [chosen, setChosen] = useState(repos[0]);
  const [invalid, setInvalid] = useState(false);

  function submit(e) {
    e.preventDefault();
    const url = issueLink(value, repos, chosen);
    if (!url) return setInvalid(true);
    onLink(url);
    onClose();
  }

  return (
    <Popover title="GitHub issue" anchor={anchor} onClose={onClose} className="schedule-menu issue-menu">
      <div className="popover-label">GitHub issue</div>
      {repos.map((repo) => (
        <a key={repo} className="popover-item" href={newIssue(repo)} target="_blank" rel="noreferrer">
          {repos.length > 1 ? `Create in ${repoPath(repo)}` : 'Create on GitHub'} <span className="muted">↗</span>
        </a>
      ))}
      <form className="issue-form" onSubmit={submit}>
        <input
          value={value}
          placeholder="Issue link or number"
          aria-label="Issue link or number"
          aria-invalid={invalid}
          onChange={(e) => {
            setValue(e.target.value);
            setInvalid(false);
          }}
        />
        <button type="submit" className="toolbar-btn" disabled={!value.trim()}>
          Link
        </button>
        {repos.length > 1 && isIssueNumber(value) && (
          <select value={chosen} aria-label="Repo for this issue number" onChange={(e) => setChosen(e.target.value)}>
            {repos.map((repo) => (
              <option key={repo} value={repo}>
                {repoPath(repo)}
              </option>
            ))}
          </select>
        )}
      </form>
      <span className="popover-hint popover-note">{invalid ? `That isn’t an issue in this project’s ${repos.length > 1 ? 'repos' : 'repo'}.` : 'After creating it, paste its link here.'}</span>
    </Popover>
  );
}
