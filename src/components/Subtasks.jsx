import { useState } from 'react';
import { PeopleInput, Tag, formatDateTime, timeAgo, toPeople } from './props.jsx';

export default function Subtasks({ items, onChange }) {
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
            <input
              key={s.text}
              className="subtask-text"
              defaultValue={s.text}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (!v) remove(i);
                else if (v !== s.text) update(i, { text: v });
              }}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            />
            <PeopleInput
              value={s.owners}
              placeholder="+ Owner"
              onChange={(owners) => update(i, { owners: owners.length ? owners : undefined })}
            />
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
                <span className="subtask-text">{s.text}</span>
                {toPeople(s.owners).map((n) => (
                  <Tag key={n}>{n}</Tag>
                ))}
                {s.doneAt && (
                  <span className="muted small" title={formatDateTime(s.doneAt)}>
                    {timeAgo(s.doneAt)}
                  </span>
                )}
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
