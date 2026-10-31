// Display and edit helpers for the globally defined properties.

import { createContext, useContext, useState } from 'react';
import { cardSummary } from './phone.js';

export const COLORS = ['gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'];

export const TYPE_LABELS = {
  text: 'Text',
  number: 'Number',
  select: 'Select',
  multi_select: 'Multi-select',
  people: 'People',
  date: 'Date',
  checkbox: 'Checkbox',
  url: 'URL',
};

function optionColor(def, value) {
  return def.options?.find((o) => o.value === value)?.color || 'gray';
}

export function Tag({ color = 'gray', children, onRemove }) {
  return (
    <span className={`tag tag-${color}`}>
      {children}
      {onRemove && (
        <button type="button" className="tag-x" onClick={onRemove} aria-label="Remove">
          ×
        </button>
      )}
    </span>
  );
}

// A people value is a list of names; older files may hold a single string.
export function toPeople(v) {
  return Array.isArray(v) ? v : isEmpty(v) ? [] : [String(v)];
}

// Who to offer when picking people. `members` (the project's group, or everyone when the project
// has no group) are listed as soon as the box is focused; `others` only once something is typed.
export const PeopleContext = createContext({ label: '', members: [], others: [] });

// Chips plus a text box with a dropdown of suggestions. Enter or comma adds what's typed,
// so names outside the list are still allowed.
export function PeopleInput({ value, onChange, placeholder = '+ Add person' }) {
  const list = toPeople(value);
  const { label, members, others } = useContext(PeopleContext);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const q = text.trim().toLowerCase();
  const taken = new Set(list.map((n) => n.toLowerCase()));
  const fits = (n) => !taken.has(n.toLowerCase()) && (!q || n.toLowerCase().includes(q));
  const memberItems = members.filter(fits);
  const otherItems = q ? others.filter(fits) : [];
  const known = [...members, ...others].some((n) => n.toLowerCase() === q) || taken.has(q);
  const items = [...memberItems, ...otherItems, ...(q && !known ? [text.trim()] : [])];
  const show = open && items.length > 0;

  const addNames = (names) => {
    const fresh = names.filter(
      (n, i) => !taken.has(n.toLowerCase()) && names.findIndex((m) => m.toLowerCase() === n.toLowerCase()) === i,
    );
    if (fresh.length) onChange([...list, ...fresh]);
    setText('');
    setActive(-1);
  };
  const addTyped = () => addNames(text.split(',').map((n) => n.trim()).filter(Boolean));

  const option = (n, i, extra = '') => (
    <li
      key={`${extra}${n}`}
      role="option"
      aria-selected={i === active}
      className={i === active ? 'active' : ''}
      // mousedown, so the click lands before the box loses focus
      onMouseDown={(e) => {
        e.preventDefault();
        addNames([n]);
      }}
      onMouseEnter={() => setActive(i)}
    >
      {extra ? `Add "${n}"` : n}
    </li>
  );

  return (
    <div className="multi">
      {list.map((n) => (
        <Tag key={n} onRemove={() => onChange(list.filter((x) => x !== n))}>
          {n}
        </Tag>
      ))}
      <span className="people-picker">
        <input
          className="people-add"
          placeholder={placeholder}
          value={text}
          role="combobox"
          aria-expanded={show}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setActive(e.target.value.trim() ? 0 : -1);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onBlur={() => {
            setOpen(false);
            addTyped();
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              setOpen(true);
              if (items.length) setActive((a) => (e.key === 'ArrowDown' ? (a + 1) % items.length : a <= 0 ? items.length - 1 : a - 1));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              if (show && items[active] !== undefined) addNames([items[active]]);
              else addTyped();
            } else if (e.key === ',') {
              e.preventDefault();
              addTyped();
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
        />
        {show && (
          <ul className="people-menu" role="listbox">
            {memberItems.length > 0 && label && <li className="people-menu-label">{label}</li>}
            {memberItems.map((n, i) => option(n, i))}
            {otherItems.length > 0 && <li className="people-menu-label">Others</li>}
            {otherItems.map((n, i) => option(n, memberItems.length + i))}
            {items.length > memberItems.length + otherItems.length && option(text.trim(), items.length - 1, '+')}
          </ul>
        )}
      </span>
    </div>
  );
}

export function isEmpty(v) {
  return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
}

// Compact read-only rendering used on board cards.
// `showLabel` false drops the property name from the value (for layouts that label it separately).
export function PropertyValue({ def, value, showLabel = true }) {
  if (isEmpty(value)) return null;
  switch (def.type) {
    case 'select':
      return <Tag color={optionColor(def, value)}>{String(value)}</Tag>;
    case 'multi_select':
      return (Array.isArray(value) ? value : [value]).map((v) => (
        <Tag key={v} color={optionColor(def, v)}>
          {String(v)}
        </Tag>
      ));
    case 'people':
      return toPeople(value).map((n) => <Tag key={n}>{n}</Tag>);
    case 'checkbox':
      return value ? <span className="prop-inline">✓{showLabel && ` ${def.name}`}</span> : null;
    case 'date':
      return <span className="prop-inline">📅 {formatDate(value)}</span>;
    case 'url':
      return <span className="prop-inline">🔗{showLabel && ` ${def.name}`}</span>;
    default:
      return (
        <span className="prop-inline">
          {showLabel && <span className="muted">{def.name}: </span>}
          {String(value)}
        </span>
      );
  }
}

// The one line of properties on a compact phone card or row.
export function CardMeta({ project, workspace }) {
  const { tag, people, date } = cardSummary(project, workspace.properties);
  const text = [people.join(', '), date && formatDate(date)].filter(Boolean).join(' · ');
  if (!tag && !text) return null;
  return (
    <div className="card-meta">
      {tag && <Tag color={tag.color}>{tag.value}</Tag>}
      {text && <span>{text}</span>}
    </div>
  );
}

export function formatDate(v) {
  const d = new Date(`${String(v).slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(v) {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

// "5 min ago", "3 days ago", or the date once it is older than a month.
export function timeAgo(v) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} day${s >= 86400 * 2 ? 's' : ''} ago`;
  return formatDate(v);
}

// Inline editor used on the project page.
export function PropertyInput({ def, value, onChange }) {
  switch (def.type) {
    case 'select':
      return (
        <select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
          <option value="">Empty</option>
          {(def.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.value}
            </option>
          ))}
          {!isEmpty(value) && !def.options?.some((o) => o.value === value) && <option value={value}>{value}</option>}
        </select>
      );
    case 'multi_select': {
      const list = Array.isArray(value) ? value : isEmpty(value) ? [] : [value];
      const remaining = (def.options ?? []).filter((o) => !list.includes(o.value));
      return (
        <div className="multi">
          {list.map((v) => (
            <Tag key={v} color={optionColor(def, v)} onRemove={() => onChange(list.filter((x) => x !== v))}>
              {v}
            </Tag>
          ))}
          {remaining.length > 0 && (
            <select value="" onChange={(e) => e.target.value && onChange([...list, e.target.value])}>
              <option value="">+ Add</option>
              {remaining.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.value}
                </option>
              ))}
            </select>
          )}
        </div>
      );
    }
    case 'people':
      return <PeopleInput value={value} onChange={(v) => onChange(v.length ? v : null)} />;
    case 'checkbox':
      return <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked || null)} />;
    case 'date':
      return (
        <input type="date" value={isEmpty(value) ? '' : String(value).slice(0, 10)} onChange={(e) => onChange(e.target.value || null)} />
      );
    case 'text':
      return <BufferedTextarea value={value} placeholder="Empty" onCommit={(v) => onChange(v || null)} />;
    case 'number':
      return <BufferedInput type="number" value={value} onCommit={(v) => onChange(v === '' ? null : Number(v))} />;
    case 'url':
      return (
        <div className="url-input">
          <BufferedInput type="url" value={value} placeholder="https://" onCommit={(v) => onChange(v || null)} />
          {!isEmpty(value) && /^https?:\/\//i.test(value) && (
            <a href={value} target="_blank" rel="noreferrer" title="Open link">
              ↗
            </a>
          )}
        </div>
      );
    default:
      return <BufferedInput value={value} placeholder="Empty" onCommit={(v) => onChange(v || null)} />;
  }
}

// Grow a textarea to fit what it holds, so nothing is hidden behind a scrollbar.
export function fitToContent(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

// Long text (the Summary, say) wraps in a box tall enough to read at a glance.
function BufferedTextarea({ value, onCommit, ...rest }) {
  const initial = isEmpty(value) ? '' : String(value);
  return (
    <textarea
      key={initial}
      className="prop-textarea"
      defaultValue={initial}
      ref={fitToContent}
      onInput={(e) => fitToContent(e.currentTarget)}
      {...rest}
      onBlur={(e) => e.target.value !== initial && onCommit(e.target.value.trim())}
    />
  );
}

// Text-like inputs save on blur / Enter instead of every keystroke.
function BufferedInput({ value, onCommit, ...rest }) {
  const initial = isEmpty(value) ? '' : String(value);
  return (
    <input
      key={initial}
      defaultValue={initial}
      {...rest}
      onBlur={(e) => e.target.value !== initial && onCommit(e.target.value.trim())}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  );
}
