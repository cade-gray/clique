import { useContext, useState } from 'react';
import { api } from '../api.js';
import { PeopleContext, formatDateTime, timeAgo } from './props.jsx';

const AUTHOR_KEY = 'clique-author';
const AUTHOR_LIST_ID = 'update-author-suggestions';

function savedAuthor() {
  try {
    return localStorage.getItem(AUTHOR_KEY) ?? '';
  } catch {
    return '';
  }
}

// Comment-style status updates, newest first. The latest one also shows on board cards and in the list view.
export default function Updates({ projectId, updates, onChange }) {
  const [text, setText] = useState('');
  const [author, setAuthor] = useState(savedAuthor);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const people = useContext(PeopleContext);

  async function post() {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { body: _b, version: _v, ...meta } = await api.addUpdate(projectId, { text: body, author: author.trim() });
      setText('');
      try {
        localStorage.setItem(AUTHOR_KEY, author.trim());
      } catch {
        // storage unavailable; the name just won't be remembered
      }
      onChange(meta);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(u) {
    if (!window.confirm('Delete this update?')) return;
    const { body: _b, version: _v, ...meta } = await api.deleteUpdate(projectId, u.id);
    onChange(meta);
  }

  return (
    <section className="updates">
      <h3>
        Updates{' '}
        {updates.length > 0 && <span className="muted small">{updates.length}</span>}
      </h3>
      <div className="update-form">
        <textarea
          rows={2}
          value={text}
          placeholder="Post a status update…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && post()}
        />
        <div className="update-form-row">
          <input
            className="update-author"
            list={AUTHOR_LIST_ID}
            value={author}
            placeholder="Your name"
            onChange={(e) => setAuthor(e.target.value)}
          />
          <datalist id={AUTHOR_LIST_ID}>
            {[...people.members, ...people.others].map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <span className="muted small">Ctrl/⌘ + Enter to post</span>
          <button className="primary" onClick={post} disabled={!text.trim() || busy}>
            Post update
          </button>
        </div>
        {error && <div className="small update-error">{error}</div>}
      </div>
      <ul className="update-list">
        {[...updates].reverse().map((u) => (
          <li key={u.id}>
            <div className="update-meta">
              <strong>{u.author || 'Update'}</strong>
              <span className="muted small" title={formatDateTime(u.at)}>
                {timeAgo(u.at)}
              </span>
              <button className="icon" onClick={() => remove(u)} title="Delete update">
                ×
              </button>
            </div>
            <div className="update-text">{u.text}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
