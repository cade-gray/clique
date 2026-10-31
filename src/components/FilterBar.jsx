import { useMemo, useRef, useState } from 'react';
import { matches } from '../filters.js';
import Popover from './Popover.jsx';

// "+ Filter" picks a field (Group, Person, Priority…); each filter then shows as a chip whose
// menu has a checkbox per value, with how many projects each would show.
export default function FilterBar({ fields, projects, filters, onChange }) {
  const [open, setOpen] = useState(null); // 'add', or the index of the chip whose menu is open
  const addRef = useRef(null);

  const used = new Set(filters.map((f) => f.field));
  const available = fields.filter((f) => !used.has(f.id));
  const shown = filters.map((f, i) => ({ f, i, field: fields.find((x) => x.id === f.field) })).filter((x) => x.field);
  const anyActive = shown.some((x) => x.f.values.length);

  // A chip closed with nothing checked would filter nothing, so it goes away.
  const close = () => {
    if (typeof open === 'number' && filters[open] && filters[open].values.length === 0) onChange(filters.filter((_, j) => j !== open));
    setOpen(null);
  };

  return (
    <div className="filter-bar">
      {shown.map(({ f, i, field }) => (
        <FilterChip
          key={f.field}
          filter={f}
          field={field}
          // Counts ignore this chip's own selection, so they say what checking a value would add.
          base={projects.filter((p) =>
            matches(
              p,
              filters.filter((_, j) => j !== i),
              fields,
            ),
          )}
          open={open === i}
          onToggle={() => (open === i ? close() : setOpen(i))}
          onClose={close}
          onValues={(values) => onChange(filters.map((x, j) => (j === i ? { ...x, values } : x)))}
          onRemove={() => {
            setOpen(null);
            onChange(filters.filter((_, j) => j !== i));
          }}
        />
      ))}
      {available.length > 0 && (
        <span className="filter-anchor">
          <button ref={addRef} className="filter-add" onClick={() => (open === 'add' ? setOpen(null) : setOpen('add'))}>
            + Filter
          </button>
          {open === 'add' && (
            <Popover title="Filter by" anchor={addRef} onClose={() => setOpen(null)} className="filter-menu">
              <div className="popover-label">Filter by</div>
              {available.map((field) => (
                <button
                  key={field.id}
                  className="popover-item"
                  onClick={() => {
                    onChange([...filters, { field: field.id, values: [] }]);
                    setOpen(filters.length);
                  }}
                >
                  <span>
                    {field.label}
                    {field.hint && <span className="popover-hint">{field.hint}</span>}
                  </span>
                </button>
              ))}
            </Popover>
          )}
        </span>
      )}
      {anyActive && (
        <button className="link filter-clear" onClick={() => onChange([])}>
          Clear filters
        </button>
      )}
    </div>
  );
}

function FilterChip({ filter, field, base, open, onToggle, onClose, onValues, onRemove }) {
  const [search, setSearch] = useState('');
  const chipRef = useRef(null);
  const labelOf = (v) => field.options.find((o) => o.value === v)?.label ?? v;
  const counts = useMemo(() => {
    const c = new Map();
    for (const p of base) for (const v of new Set(field.has(p))) c.set(v, (c.get(v) ?? 0) + 1);
    return c;
  }, [base, field]);

  const q = search.trim().toLowerCase();
  const options = field.options.filter((o) => !q || o.label.toLowerCase().includes(q));
  const toggle = (v) => onValues(filter.values.includes(v) ? filter.values.filter((x) => x !== v) : [...filter.values, v]);

  const summary =
    filter.values.length === 0
      ? 'choose…'
      : filter.values.length <= 2
        ? filter.values.map(labelOf).join(', ')
        : `${labelOf(filter.values[0])} +${filter.values.length - 1}`;

  return (
    <span className="filter-anchor">
      <span ref={chipRef} className={`filter-chip ${filter.values.length ? 'active' : ''}`}>
        <button className="filter-chip-main" onClick={onToggle} title={filter.values.map(labelOf).join(', ')}>
          {field.label}: <strong>{summary}</strong> <span className="caret">▾</span>
        </button>
        <button className="filter-chip-x" onClick={onRemove} aria-label={`Remove ${field.label} filter`} title="Remove filter">
          ×
        </button>
      </span>
      {open && (
        <Popover title={field.label} anchor={chipRef} onClose={onClose} className="filter-menu">
          <div className="popover-label">{field.label}</div>
          {field.hint && <div className="popover-hint popover-note">{field.hint}</div>}
          {field.options.length > 8 && (
            <input className="filter-search" autoFocus placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
          )}
          <div className="filter-options">
            {options.map((o) => (
              <label key={o.value} className={`popover-item check ${o.empty ? 'muted' : ''}`}>
                <input type="checkbox" checked={filter.values.includes(o.value)} onChange={() => toggle(o.value)} />
                {o.color ? <span className={`tag tag-${o.color}`}>{o.label}</span> : <span>{o.label}</span>}
                <span className="count">{counts.get(o.value) ?? 0}</span>
              </label>
            ))}
            {options.length === 0 && <div className="muted small popover-empty">No matches</div>}
          </div>
          <div className="popover-foot muted small">
            {filter.values.length > 1 ? 'Showing projects with any of these' : 'Check one or more'}
            {filter.values.length > 0 && (
              <button className="link" onClick={() => onValues([])}>
                Uncheck all
              </button>
            )}
          </div>
        </Popover>
      )}
    </span>
  );
}
