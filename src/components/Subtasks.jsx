import { useLayoutEffect, useRef, useState } from 'react';
import { usePhone } from '../usePhone.js';
import { docOf } from './pages.js';
import { AddNotes, IssueLink, TaskDoc, TaskIssue } from './TaskLinks.jsx';
import { PeopleInput, Tag, fitToContent, formatDateTime, timeAgo, toPeople } from './props.jsx';
import ScheduleButton from './ScheduleButton.jsx';
import { moveToSlot, movesNowhere, slotAt } from './tasks.js';
import { useTouchDrag } from './useTouchDrag.js';

export default function Subtasks({ items, pages, base, repos, projectTitle, onChange, onAddDoc, onOpenDoc }) {
  const [dragIndex, setDragIndex] = useState(null);
  const [slot, setSlot] = useState(null);
  const listRef = useRef(null);
  const phone = usePhone();

  // Keep each item's index in the full list so edits and reordering target the right entry.
  const entries = items.map((s, i) => ({ s, i }));
  const open = entries.filter((e) => !e.s.done);
  // Checked-off tasks move to History, most recently completed first.
  const history = entries
    .filter((e) => e.s.done)
    .sort((a, b) => String(b.s.doneAt ?? '').localeCompare(String(a.s.doneAt ?? '')));

  const update = (i, fields) => onChange(items.map((s, j) => (j === i ? { ...s, ...fields } : s)));
  const remove = (i) => onChange(items.filter((_, j) => j !== i));
  const setDone = (i, done) => update(i, { done, doneAt: done ? new Date().toISOString() : undefined });

  // Where a drop would land. Nothing shows for a drop that wouldn't move the task.
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

  // Worked out from the rows, not the element under the pointer, so that the gaps between tasks
  // and the space around the list work as well as the tasks themselves.
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
        Tasks{' '}
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
              {/* A task is one line of text: Enter saves it rather than adding a line break. */}
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
                  <TaskDoc page={docOf(s, pages)} base={base} onOpen={onOpenDoc} />
                ) : (
                  <AddNotes onClick={() => onAddDoc(i)} />
                )}
                <TaskIssue issue={s.issue} repos={repos} text={s.text} owners={s.owners} projectTitle={projectTitle} onChange={(issue) => update(i, { issue })} />
              </div>
            </div>
            <button className="icon" onClick={() => remove(i)} title="Delete subtask">
              ×
            </button>
          </li>
        ))}
      </ul>
      <NewTask onAdd={(text) => onChange([...items, { text, done: false }])} />
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
                  title="Uncheck to move back to tasks"
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
                  <TaskDoc page={docOf(s, pages)} base={base} onOpen={onOpenDoc} />
                  {s.issue && <IssueLink url={s.issue} repos={repos} />}
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

// A task is one line of text that may wrap, so pasted line breaks become spaces and Enter adds it.
// Text left in the box stays there on blur: a stray tap should not create a task.
function NewTask({ onAdd }) {
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
        placeholder="Add a task"
        aria-label="Add a task"
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
