import { useState } from 'react';
import { PeopleInput } from './props.jsx';

export default function Subtasks({ items, onChange }) {
  const [dragIndex, setDragIndex] = useState(null);
  const done = items.filter((s) => s.done).length;

  const update = (i, fields) => onChange(items.map((s, j) => (j === i ? { ...s, ...fields } : s)));
  const remove = (i) => onChange(items.filter((_, j) => j !== i));
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
        Subtasks{' '}
        {items.length > 0 && (
          <span className="muted small">
            {done}/{items.length}
          </span>
        )}
      </h3>
      <ul>
        {items.map((s, i) => (
          <li
            key={i}
            className={`${s.done ? 'done' : ''} ${dragIndex === i ? 'dragging' : ''}`}
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
            <input type="checkbox" checked={s.done} onChange={(e) => update(i, { done: e.target.checked })} />
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
        placeholder="+ Add a subtask"
        onKeyDown={(e) => {
          const v = e.currentTarget.value.trim();
          if (e.key === 'Enter' && v) {
            onChange([...items, { text: v, done: false }]);
            e.currentTarget.value = '';
          }
        }}
      />
    </section>
  );
}
