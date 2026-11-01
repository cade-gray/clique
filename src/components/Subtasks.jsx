import { useLayoutEffect, useRef, useState } from 'react';
import { usePhone } from '../usePhone.js';
import Popover from './Popover.jsx';
import { issueLink, issueNumber, newIssueUrl } from './github.js';
import { docOf } from './pages.js';
import { PeopleInput, Tag, fitToContent, formatDateTime, timeAgo, toPeople } from './props.jsx';
import ScheduleButton from './ScheduleButton.jsx';
import { moveToSlot, movesNowhere, slotAt } from './todos.js';
import { useTouchDrag } from './useTouchDrag.js';

export default function Subtasks({ items, pages, base, repo, projectTitle, onChange, onAddDoc, onOpenDoc }) {
  const [dragIndex, setDragIndex] = useState(null);
  const [slot, setSlot] = useState(null);
  const listRef = useRef(null);
  const phone = usePhone();

  // Keep each item's index in the full list so edits and reordering target the right entry.
  const entries = items.map((s, i) => ({ s, i }));
  const open = entries.filter((e) => !e.s.done);
  // Checked-off to-dos move to History, most recently completed first.
  const history = entries
    .filter((e) => e.s.done)
    .sort((a, b) => String(b.s.doneAt ?? '').localeCompare(String(a.s.doneAt ?? '')));

  const update = (i, fields) => onChange(items.map((s, j) => (j === i ? { ...s, ...fields } : s)));
  const remove = (i) => onChange(items.filter((_, j) => j !== i));
  const setDone = (i, done) => update(i, { done, doneAt: done ? new Date().toISOString() : undefined });

  // Where a drop would land. Nothing shows for a drop that wouldn't move the to-do.
  const from = open.findIndex((e) => e.i === dragIndex);
  const target = slot === null || movesNowhere(from, slot) ? null : slot;

  const endDrag = () => {
    setDragIndex(null);
    setSlot(null);
  };
  const finishDrag = (at) => {
    if (at !== null && !movesNowhere(from, at)) onChange(moveToSlot(items, open.map((o) => o.s), from, at));
    endDrag();
  };
  const touchHandle = useTouchDrag({ listRef, onStart: setDragIndex, onSlot: setSlot, onDrop: finishDrag, onCancel: endDrag });

  // Worked out from the rows, not the element under the pointer, so that the gaps between to-dos
  // and the space around the list work as well as the to-dos themselves.
  const dragOver = (e) => {
    if (dragIndex === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rows = [...listRef.current.children].map((row) => row.getBoundingClientRect());
    setSlot(slotAt(rows.map((r) => r.top + r.height / 2), e.clientY));
  };
  const drop = (e) => {
    if (dragIndex === null) return;
    e.preventDefault();
    finishDrag(slot);
  };

  return (
    <section
      className="subtasks"
      onDragOver={dragOver}
      onDrop={drop}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setSlot(null);
      }}
    >
      <h3>
        To-dos{' '}
        {items.length > 0 && (
          <span className="muted small">
            {history.length}/{items.length}
          </span>
        )}
      </h3>
      <ul ref={listRef}>
        {open.map(({ s, i }, n) => (
          <li
            key={i}
            className={[dragIndex === i && 'dragging', target === n && 'drop-before', target === n + 1 && n === open.length - 1 && 'drop-after'].filter(Boolean).join(' ')}
          >
            <span
              className="handle"
              title="Drag to reorder"
              {...(phone
                ? touchHandle(i)
                : {
                    draggable: true,
                    onDragStart: (e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', s.text);
                      // The whole card follows the pointer, held where it was picked up, not just the handle.
                      const card = e.currentTarget.closest('li');
                      const box = card.getBoundingClientRect();
                      e.dataTransfer.setDragImage(card, e.clientX - box.left, e.clientY - box.top);
                      setDragIndex(i);
                    },
                    onDragEnd: endDrag,
                  })}
            >
              ⋮⋮
            </span>
            <input type="checkbox" checked={false} onChange={() => setDone(i, true)} />
            <div className="subtask-main">
              {/* A to-do is one line of text: Enter saves it rather than adding a line break. */}
              <textarea
                key={s.text}
                className="subtask-text"
                rows={1}
                defaultValue={s.text}
                ref={fitToContent}
                onInput={(e) => fitToContent(e.currentTarget)}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (!v) remove(i);
                  else if (v !== s.text) update(i, { text: v });
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.currentTarget.blur();
                  }
                }}
              />
              <div className="subtask-meta">
                <PeopleInput
                  value={s.owners}
                  placeholder="+ Owner"
                  onChange={(owners) => update(i, { owners: owners.length ? owners : undefined })}
                />
              </div>
              <div className="subtask-actions">
                <ScheduleButton text={s.text} owners={s.owners} projectTitle={projectTitle} />
                {s.doc ? (
                  <TodoDoc page={docOf(s, pages)} base={base} onOpen={onOpenDoc} />
                ) : (
                  <button className="add-doc" onClick={() => onAddDoc(i)} title="Write notes for this to-do">
                    📝 Add notes
                  </button>
                )}
                {s.issue ? (
                  <span className="subtask-issue">
                    <IssueLink url={s.issue} />
                    <button className="icon" onClick={() => update(i, { issue: undefined })} aria-label={`Unlink issue #${issueNumber(s.issue)}`} title="Unlink this issue">
                      ×
                    </button>
                  </span>
                ) : (
                  repo && <IssueBlock repo={repo} text={s.text} owners={s.owners} projectTitle={projectTitle} onLink={(issue) => update(i, { issue })} />
                )}
              </div>
            </div>
            <button className="icon" onClick={() => remove(i)} title="Delete subtask">
              ×
            </button>
          </li>
        ))}
      </ul>
      <NewTodo onAdd={(text) => onChange([...items, { text, done: false }])} />
      {history.length > 0 && (
        <details className="subtask-history">
          <summary>History ({history.length})</summary>
          <ul>
            {history.map(({ s, i }) => (
              <li key={i} className="done">
                <input
                  type="checkbox"
                  checked
                  onChange={() => setDone(i, false)}
                  title="Uncheck to move back to to-dos"
                />
                <div className="subtask-main">
                  <span className="subtask-text">{s.text}</span>
                  <div className="subtask-meta">
                    {toPeople(s.owners).map((n) => (
                      <Tag key={n}>{n}</Tag>
                    ))}
                    {s.doneAt && (
                      <span className="muted small" title={formatDateTime(s.doneAt)}>
                        {timeAgo(s.doneAt)}
                      </span>
                    )}
                  </div>
                  <TodoDoc page={docOf(s, pages)} base={base} onOpen={onOpenDoc} />
                  {s.issue && <IssueLink url={s.issue} />}
                </div>
                <button className="icon" onClick={() => remove(i)} title="Delete subtask">
                  ×
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

// The page is named after the to-do, so the title would only repeat the line above it.
// A to-do is one line of text that may wrap, so pasted line breaks become spaces and Enter adds it.
// Text left in the box stays there on blur: a stray tap should not create a to-do.
function NewTodo({ onAdd }) {
  const [text, setText] = useState('');
  const box = useRef(null);
  useLayoutEffect(() => fitToContent(box.current), [text]);

  function add() {
    const v = text.trim();
    if (!v) return;
    onAdd(v);
    setText('');
    box.current.focus();
  }

  return (
    <div className="subtask-new">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
        <path d="M8 3v10M3 8h10" />
      </svg>
      <textarea
        ref={box}
        rows={1}
        value={text}
        placeholder="Add a to-do"
        aria-label="Add a to-do"
        enterKeyHint="done"
        onChange={(e) => setText(e.target.value.replace(/\s*\n\s*/g, ' '))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add();
          }
        }}
      />
      <button className="primary" disabled={!text.trim()} onClick={add}>
        Add
      </button>
    </div>
  );
}

function TodoDoc({ page, base, onOpen }) {
  if (!page) return null;
  return (
    <a className="subtask-doc" href={`${base}/${encodeURIComponent(page.id)}`} title={page.title} aria-label={`Notes: ${page.title}`} onClick={onOpen}>
      📝 Notes
    </a>
  );
}

function IssueLink({ url }) {
  return (
    <a className="subtask-issue-link" href={url} target="_blank" rel="noreferrer" title="Open on GitHub">
      🔗 #{issueNumber(url)}
    </a>
  );
}

function IssueBlock({ repo, text, owners, projectTitle, onLink }) {
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
          repo={repo}
          newIssue={newIssueUrl(repo, { text, owners: toPeople(owners), projectTitle, url: window.location.href })}
          onLink={onLink}
          onClose={() => setOpen(false)}
        />
      )}
    </span>
  );
}

// Stays open when the form opens in its own tab, ready for the new issue's link on the way back.
function IssueMenu({ anchor, repo, newIssue, onLink, onClose }) {
  const [value, setValue] = useState('');
  const [invalid, setInvalid] = useState(false);

  function submit(e) {
    e.preventDefault();
    const url = issueLink(value, repo);
    if (!url) return setInvalid(true);
    onLink(url);
    onClose();
  }

  return (
    <Popover title="GitHub issue" anchor={anchor} onClose={onClose} className="schedule-menu issue-menu">
      <div className="popover-label">GitHub issue</div>
      <a className="popover-item" href={newIssue} target="_blank" rel="noreferrer">
        Create on GitHub <span className="muted">↗</span>
      </a>
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
      </form>
      <span className="popover-hint popover-note">{invalid ? 'That isn’t an issue in this project’s repo.' : 'After creating it, paste its link here.'}</span>
    </Popover>
  );
}
