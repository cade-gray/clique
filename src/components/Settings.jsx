import { useState } from 'react';
import { api } from '../api.js';
import { COLORS, TYPE_LABELS, Tag } from './props.jsx';

// Keep in step with RESERVED_KEYS in server/store.js.
const RESERVED = ['title', 'status', 'order', 'subtasks', 'blocked', 'blockedReason', 'maintenance', 'updates', 'created', 'updated'];

function slugify(s) {
  return (
    String(s)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'item'
  );
}

function uniqueKey(base, taken) {
  let k = RESERVED.includes(base) ? `${base}-prop` : base;
  for (let i = 2; taken.includes(k); i++) k = `${base}-${i}`;
  return k;
}

// Columns and property definitions are shared by every project. Property keys are
// fixed once created (they are the frontmatter keys in each project's markdown file),
// so renaming a property only changes its label.
export default function Settings({ workspace, onSaved }) {
  const [columns, setColumns] = useState(workspace.columns);
  const [properties, setProperties] = useState(workspace.properties);
  const [status, setStatus] = useState(null);
  const savedKeys = workspace.properties.map((p) => p.key);
  const dirty =
    JSON.stringify({ columns, properties }) !==
    JSON.stringify({ columns: workspace.columns, properties: workspace.properties });

  async function save() {
    setStatus('Saving…');
    try {
      const ws = await api.saveWorkspace({ columns, properties });
      onSaved(ws);
      setColumns(ws.columns);
      setProperties(ws.properties);
      setStatus('Saved');
    } catch (e) {
      setStatus(`Error: ${e.message}`);
    }
  }

  const setCol = (i, fields) => setColumns(columns.map((c, j) => (j === i ? { ...c, ...fields } : c)));
  const moveCol = (i, d) => {
    const next = [...columns];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setColumns(next);
  };
  const setProp = (i, fields) => setProperties(properties.map((p, j) => (j === i ? { ...p, ...fields } : p)));

  return (
    <div className="settings">
      <div className="settings-bar">
        <h2>Properties &amp; columns</h2>
        <span className="muted">{status}</span>
        <button className="primary" disabled={!dirty} onClick={save}>
          Save changes
        </button>
      </div>

      <section>
        <h3>Board columns</h3>
        <p className="muted small">Each column is a project status. Removing a column moves its projects to Backlog (or the first column if there is no Backlog).</p>
        {columns.map((c, i) => (
          <div className="settings-row" key={c.id}>
            <input value={c.name} onChange={(e) => setCol(i, { name: e.target.value })} />
            <code className="muted small">{c.id}</code>
            <button className="icon" disabled={i === 0} onClick={() => moveCol(i, -1)} title="Move up">
              ↑
            </button>
            <button className="icon" disabled={i === columns.length - 1} onClick={() => moveCol(i, 1)} title="Move down">
              ↓
            </button>
            <button className="icon" disabled={columns.length === 1} onClick={() => setColumns(columns.filter((_, j) => j !== i))} title="Remove">
              ×
            </button>
          </div>
        ))}
        <AddInput
          placeholder="+ Add column"
          onAdd={(name) => setColumns([...columns, { id: uniqueKey(slugify(name), columns.map((c) => c.id)), name }])}
        />
      </section>

      <section>
        <h3>Project properties</h3>
        <p className="muted small">Defined once here and available on every project.</p>
        {properties.map((p, i) => (
          <div className="prop-def" key={p.key}>
            <div className="settings-row">
              <input value={p.name} onChange={(e) => setProp(i, { name: e.target.value })} />
              <select
                value={p.type}
                onChange={(e) => {
                  const type = e.target.value;
                  const hasOptions = type === 'select' || type === 'multi_select';
                  setProp(i, { type, options: hasOptions ? p.options ?? [] : undefined });
                }}
              >
                {Object.entries(TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <code className="muted small" title="Frontmatter key in each project file">
                {p.key}
              </code>
              <button className="icon" onClick={() => setProperties(properties.filter((_, j) => j !== i))} title="Remove property">
                ×
              </button>
            </div>
            {(p.type === 'select' || p.type === 'multi_select') && (
              <div className="options">
                {(p.options ?? []).map((o, oi) => (
                  <span key={o.value} className="option-edit">
                    <Tag color={o.color}>{o.value}</Tag>
                    <select
                      value={o.color}
                      onChange={(e) =>
                        setProp(i, { options: p.options.map((x, xi) => (xi === oi ? { ...x, color: e.target.value } : x)) })
                      }
                    >
                      {COLORS.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                    <button className="icon" onClick={() => setProp(i, { options: p.options.filter((_, xi) => xi !== oi) })}>
                      ×
                    </button>
                  </span>
                ))}
                <AddInput
                  placeholder="+ Option"
                  onAdd={(value) =>
                    !(p.options ?? []).some((o) => o.value === value) &&
                    setProp(i, { options: [...(p.options ?? []), { value, color: COLORS[(p.options?.length ?? 0) % COLORS.length] }] })
                  }
                />
              </div>
            )}
          </div>
        ))}
        <AddInput
          placeholder="+ Add property"
          onAdd={(name) =>
            setProperties([
              ...properties,
              { key: uniqueKey(slugify(name), [...properties.map((p) => p.key), ...savedKeys]), name, type: 'text' },
            ])
          }
        />
      </section>
    </div>
  );
}

function AddInput({ placeholder, onAdd }) {
  return (
    <input
      className="add-input"
      placeholder={placeholder}
      onKeyDown={(e) => {
        const v = e.currentTarget.value.trim();
        if (e.key === 'Enter' && v) {
          onAdd(v);
          e.currentTarget.value = '';
        }
      }}
    />
  );
}
