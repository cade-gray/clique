import { useRef, useState } from 'react';
import Popover from './Popover.jsx';
import { downloadIcs, formatSlot, icsFilename, icsText, outlookUrl, subtaskEvent } from './calendar.js';
import { PeopleInput, Tag, fitToContent, formatDateTime, timeAgo, toPeople } from './props.jsx';

export default function Subtasks({ items, projectTitle, onChange }) {
  const [dragIndex, setDragIndex] = useState(null);

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
  const move = (from, to) => {
    if (from === to) return;
    const next = [...items];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    onChange(next);
  };

  return (
    <section className="subtasks">
      <h3>
        To-dos{' '}
        {items.length > 0 && (
          <span className="muted small">
            {history.length}/{items.length}
          </span>
        )}
      </h3>
      <ul>
        {open.map(({ s, i }) => (
          <li
            key={i}
            className={dragIndex === i ? 'dragging' : ''}
            onDragOver={(e) => dragIndex !== null && e.preventDefault()}
            onDrop={() => {
              if (dragIndex !== null) move(dragIndex, i);
              setDragIndex(null);
            }}
          >
            <span
              className="handle"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                setDragIndex(i);
              }}
              onDragEnd={() => setDragIndex(null)}
              title="Drag to reorder"
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
                <ScheduleBlock text={s.text} owners={s.owners} projectTitle={projectTitle} />
              </div>
            </div>
            <button className="icon" onClick={() => remove(i)} title="Delete subtask">
              ×
            </button>
          </li>
        ))}
      </ul>
      <input
        className="subtask-new"
        placeholder="+ Add a to-do"
        onKeyDown={(e) => {
          const v = e.currentTarget.value.trim();
          if (e.key === 'Enter' && v) {
            onChange([...items, { text: v, done: false }]);
            e.currentTarget.value = '';
          }
        }}
      />
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

// Books time to work on a to-do. Clique hands the event to a calendar and keeps nothing: there is
// no way for it to know whether the block was kept, moved or deleted afterwards.
function ScheduleBlock({ text, owners, projectTitle }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef(null);
  return (
    <span className="schedule">
      <button
        ref={anchor}
        className="schedule-btn"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        title="Block time to work on this"
      >
        📅 Schedule
      </button>
      {open && (
        <ScheduleMenu
          anchor={anchor}
          event={subtaskEvent({ text, owners: toPeople(owners), projectTitle, url: window.location.href })}
          filename={icsFilename(text)}
          onClose={() => setOpen(false)}
        />
      )}
    </span>
  );
}

function ScheduleMenu({ anchor, event, filename, onClose }) {
  return (
    <Popover anchor={anchor} onClose={onClose} className="schedule-menu">
      <div className="popover-label">Block time to work on this</div>
      <span className="popover-hint popover-note">
        {formatSlot(event.start, event.end)} — move it to a free slot once your calendar is open.
      </span>
      <a className="popover-item" href={outlookUrl(event)} target="_blank" rel="noreferrer" onClick={onClose}>
        Outlook on the web <span className="muted">↗</span>
      </a>
      <button
        className="popover-item"
        onClick={() => {
          downloadIcs(filename, icsText(event));
          onClose();
        }}
      >
        Download .ics file
      </button>
    </Popover>
  );
}
