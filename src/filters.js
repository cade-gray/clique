// Board and list filters. A filter is { field, values }: a project passes when it has any of
// the checked values, and it has to pass every filter. A filter with nothing checked is ignored.
//
// Each field knows its options and, through `has(project)`, which of those values a project has,
// so matching and the per-option counts share one definition.

import { isEmpty, toPeople } from './components/props.jsx';

const lower = (s) => String(s).toLowerCase();
const byLabel = (a, b) => a.label.localeCompare(b.label);

function isoDay(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateBucket(v) {
  if (isEmpty(v)) return '';
  const day = String(v).slice(0, 10);
  const today = new Date();
  if (day < isoDay(today)) return 'past';
  const soon = new Date(today);
  soon.setDate(soon.getDate() + 30);
  return day <= isoDay(soon) ? 'soon' : 'later';
}

// Names are matched ignoring case; the first spelling seen is the one shown.
function nameOptions(lists) {
  const seen = new Map();
  for (const n of lists.flat()) if (n && !seen.has(lower(n))) seen.set(lower(n), n);
  return [...seen].map(([value, label]) => ({ value, label })).sort(byLabel);
}

function peopleOn(p, workspace) {
  const names = [...(p.subtasks.owners ?? [])];
  for (const def of workspace.properties) if (def.type === 'people') names.push(...toPeople(p.properties[def.key]));
  return names.map(lower);
}

export function filterFields(workspace, projects) {
  const fields = [
    {
      id: 'status',
      label: 'Status',
      options: workspace.columns.map((c) => ({ value: c.id, label: c.name })),
      has: (p) => [p.status],
    },
  ];
  if (workspace.groups.length)
    fields.push({
      id: 'group',
      label: 'Group',
      options: [...workspace.groups.map((g) => ({ value: g.id, label: g.name })), { value: '', label: 'No group', empty: true }],
      has: (p) => [p.group ?? ''],
    });
  fields.push(
    {
      id: 'person',
      label: 'Person',
      hint: 'Owns the project or one of its to-dos',
      options: nameOptions([
        ...workspace.groups.map((g) => g.members),
        ...projects.map((p) => p.subtasks.owners ?? []),
        ...workspace.properties.filter((d) => d.type === 'people').flatMap((d) => projects.map((p) => toPeople(p.properties[d.key]))),
      ]),
      has: (p) => peopleOn(p, workspace),
    },
    {
      id: 'flags',
      label: 'Flags',
      options: [
        { value: 'blocked', label: 'Blocked' },
        { value: 'maintenance', label: 'In maintenance' },
        { value: 'none', label: 'Neither', empty: true },
      ],
      has: (p) => (p.blocked || p.maintenance ? [p.blocked && 'blocked', p.maintenance && 'maintenance'].filter(Boolean) : ['none']),
    },
  );

  const empty = { value: '', label: 'Empty', empty: true };
  for (const def of workspace.properties) {
    const value = (p) => p.properties[def.key];
    const base = { id: `prop:${def.key}`, label: def.name };
    if (def.type === 'select' || def.type === 'multi_select') {
      // Values left over from a removed option still need to be filterable.
      const known = new Set((def.options ?? []).map((o) => o.value));
      const extra = new Set();
      for (const p of projects) for (const v of [value(p)].flat()) if (!isEmpty(v) && !known.has(v)) extra.add(String(v));
      fields.push({
        ...base,
        options: [
          ...(def.options ?? []).map((o) => ({ value: o.value, label: o.value, color: o.color })),
          ...[...extra].map((v) => ({ value: v, label: v })),
          empty,
        ],
        has: (p) => (isEmpty(value(p)) ? [''] : [value(p)].flat().map(String)),
      });
    } else if (def.type === 'people') {
      fields.push({
        ...base,
        options: [...nameOptions(projects.map((p) => toPeople(value(p)))), empty],
        has: (p) => (isEmpty(value(p)) ? [''] : toPeople(value(p)).map(lower)),
      });
    } else if (def.type === 'checkbox') {
      fields.push({
        ...base,
        options: [
          { value: 'yes', label: 'Checked' },
          { value: 'no', label: 'Not checked' },
        ],
        has: (p) => [value(p) ? 'yes' : 'no'],
      });
    } else if (def.type === 'date') {
      fields.push({
        ...base,
        options: [
          { value: 'past', label: 'Before today' },
          { value: 'soon', label: 'Today to 30 days out' },
          { value: 'later', label: 'More than 30 days out' },
          { value: '', label: 'Not set', empty: true },
        ],
        has: (p) => [dateBucket(value(p))],
      });
    }
    // Text, number and URL properties are covered by the search box.
  }
  return fields;
}

const isActive = (f, fields) => f.values.length > 0 && fields.some((x) => x.id === f.field);

export function activeFilters(filters, fields) {
  return filters.filter((f) => isActive(f, fields));
}

export function matches(p, filters, fields) {
  return activeFilters(filters, fields).every((f) => {
    const has = fields.find((x) => x.id === f.field).has(p);
    return f.values.some((v) => has.includes(v));
  });
}

// "Group: Integrations, Digital banking · Person: Alex", for the printed report.
export function describeFilters(filters, fields) {
  return activeFilters(filters, fields)
    .map((f) => {
      const field = fields.find((x) => x.id === f.field);
      return `${field.label}: ${f.values.map((v) => field.options.find((o) => o.value === v)?.label ?? v).join(', ')}`;
    })
    .join(' · ');
}
