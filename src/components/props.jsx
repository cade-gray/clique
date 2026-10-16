// Display and edit helpers for the globally defined properties.

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

export const PEOPLE_LIST_ID = 'people-suggestions';

// Chips plus a text box; Enter or comma adds a name. Suggestions come from a shared <datalist>.
export function PeopleInput({ value, onChange, placeholder = '+ Add person' }) {
  const list = toPeople(value);
  const add = (input) => {
    const names = input.value.split(',').map((n) => n.trim()).filter(Boolean);
    input.value = '';
    const fresh = names.filter((n, i) => !list.some((x) => x.toLowerCase() === n.toLowerCase()) && names.findIndex((m) => m.toLowerCase() === n.toLowerCase()) === i);
    if (fresh.length) onChange([...list, ...fresh]);
  };
  return (
    <div className="multi">
      {list.map((n) => (
        <Tag key={n} onRemove={() => onChange(list.filter((x) => x !== n))}>
          {n}
        </Tag>
      ))}
      <input
        className="people-add"
        list={PEOPLE_LIST_ID}
        placeholder={placeholder}
        onBlur={(e) => add(e.target)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add(e.currentTarget);
          }
        }}
      />
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
