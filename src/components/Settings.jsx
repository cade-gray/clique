import { useState } from 'react';
import { api } from '../api.js';
import { COLORS, TYPE_LABELS, Tag } from './props.jsx';

// Keep in step with RESERVED_KEYS in server/store.js.
const RESERVED = ['title', 'status', 'order', 'group', 'repo', 'repos', 'subtasks', 'blocked', 'blockedReason', 'maintenance', 'updates', 'created', 'updated'];

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

// Items added on this screen get a temporary React key, so their id can follow their name
// while typing without the input being remounted (and losing focus).
let nextTmp = 0;
const keyOf = (item, field) => item.tmp ?? item[field];

// Renames items[i]. Until an item has been saved its id is rebuilt from the name, so fixing
// a typo before saving fixes the id too; after that the id is fixed because projects store it.
function rename(items, i, name, field, savedIds) {
  return items.map((item, j) => {
    if (j !== i) return item;
    if (savedIds.includes(item[field])) return { ...item, name };
    const taken = [...items.filter((_, k) => k !== i).map((x) => x[field]), ...savedIds];
    return { ...item, name, [field]: uniqueKey(slugify(name), taken) };
  });
}

// The temporary key isn't part of the workspace.
const strip = (items) => items.map(({ tmp: _t, ...rest }) => rest);

// Columns, property definitions and groups are shared by every project. Property keys are
// fixed once created (they are the frontmatter keys in each project's markdown file),
// so renaming a property only changes its label. Group ids work the same way.
export default function Settings({ workspace, onSaved }) {
  const [columns, setColumns] = useState(workspace.columns);
  const [properties, setProperties] = useState(workspace.properties);
  const [groups, setGroups] = useState(workspace.groups);
  const [status, setStatus] = useState(null);
  const savedKeys = workspace.properties.map((p) => p.key);
  const savedColumnIds = workspace.columns.map((c) => c.id);
  const savedGroupIds = workspace.groups.map((g) => g.id);
  const dirty =
    JSON.stringify({ columns: strip(columns), properties: strip(properties), groups: strip(groups) }) !==
    JSON.stringify({ columns: workspace.columns, properties: workspace.properties, groups: workspace.groups });

  async function save() {
    setStatus('Saving…');
    try {
      const ws = await api.saveWorkspace({ columns: strip(columns), properties: strip(properties), groups: strip(groups) });
      onSaved(ws);
      setColumns(ws.columns);
      setProperties(ws.properties);
      setGroups(ws.groups);
      setStatus('Saved');
    } catch (e) {
      setStatus(`Error: ${e.message}`);
    }
  }

  const moveCol = (i, d) => {
    const next = [...columns];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setColumns(next);
  };
  const setProp = (i, fields) => setProperties(properties.map((p, j) => (j === i ? { ...p, ...fields } : p)));
  const setGroup = (i, fields) => setGroups(groups.map((g, j) => (j === i ? { ...g, ...fields } : g)));
  // Accepts "Alex, Priya" as two people; names already in the group are skipped.
  const addMembers = (i, input) => {
    const members = [...groups[i].members];
    for (const name of input.split(',').map((n) => n.trim()).filter(Boolean))
      if (!members.some((m) => m.toLowerCase() === name.toLowerCase())) members.push(name);
    setGroup(i, { members });
  };

  return (
    <div className="settings">
      <div className="settings-bar">
        <h2>Configuration</h2>
        <span className="muted">{status}</span>
        <button className="primary" disabled={!dirty} onClick={save}>
          Save changes
        </button>
      </div>

      <section>
        <h3>Groups</h3>
        <p className="muted small">
          Teams of people. Each project can belong to one group, and its members are offered first when choosing owners for the project and its
          tasks. Removing a group leaves its projects without one.
        </p>
        {groups.map((g, i) => (
          <div className="prop-def" key={keyOf(g, 'id')}>
            <div className="settings-row">
              <input value={g.name} onChange={(e) => setGroups(rename(groups, i, e.target.value, 'id', savedGroupIds))} aria-label="Group name" />
              <button className="icon" onClick={() => setGroups(groups.filter((_, j) => j !== i))} title="Remove group">
                ×
              </button>
            </div>
            <div className="options">
              {g.members.map((n) => (
                <Tag key={n} onRemove={() => setGroup(i, { members: g.members.filter((m) => m !== n) })}>
                  {n}
                </Tag>
              ))}
              <AddInput placeholder="+ Person" onAdd={(v) => addMembers(i, v)} />
            </div>
          </div>
        ))}
        <AddInput
          placeholder="+ Add group"
          onAdd={(name) =>
            setGroups([
              ...groups,
              { id: uniqueKey(slugify(name), [...groups.map((g) => g.id), ...savedGroupIds]), name, members: [], tmp: `t${nextTmp++}` },
            ])
          }
        />
      </section>

      <section>
        <h3>Project statuses</h3>
        <p className="muted small">Each status is a column on the board, in this order. Removing a status moves its projects to Backlog (or the first status if there is no Backlog).</p>
        {columns.map((c, i) => (
          <div className="settings-row" key={keyOf(c, 'id')}>
            <input value={c.name} onChange={(e) => setColumns(rename(columns, i, e.target.value, 'id', savedColumnIds))} />
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
          placeholder="+ Add status"
          onAdd={(name) =>
            setColumns([...columns, { id: uniqueKey(slugify(name), [...columns.map((c) => c.id), ...savedColumnIds]), name, tmp: `t${nextTmp++}` }])
          }
        />
      </section>

      <section>
        <h3>Project properties</h3>
        <p className="muted small">Defined once here and available on every project.</p>
        {properties.map((p, i) => (
          <div className="prop-def" key={keyOf(p, 'key')}>
            <div className="settings-row">
              <input value={p.name} onChange={(e) => setProperties(rename(properties, i, e.target.value, 'key', savedKeys))} />
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
              { key: uniqueKey(slugify(name), [...properties.map((p) => p.key), ...savedKeys]), name, type: 'text', tmp: `t${nextTmp++}` },
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
