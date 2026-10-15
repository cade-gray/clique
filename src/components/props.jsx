// Display and edit helpers for the globally defined properties.

export const COLORS = ['gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'];

export const TYPE_LABELS = {
  text: 'Text',
  number: 'Number',
  select: 'Select',
  multi_select: 'Multi-select',
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

export function isEmpty(v) {
  return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
}

// Compact read-only rendering used on board cards.
export function PropertyValue({ def, value }) {
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
    case 'checkbox':
      return value ? <span className="prop-inline">✓ {def.name}</span> : null;
    case 'date':
      return <span className="prop-inline">📅 {formatDate(value)}</span>;
    case 'url':
      return <span className="prop-inline">🔗 {def.name}</span>;
    default:
      return (
        <span className="prop-inline">
          <span className="muted">{def.name}:</span> {String(value)}
        </span>
      );
  }
}

export function formatDate(v) {
  const d = new Date(`${String(v).slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
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
