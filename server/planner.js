// Import from a Microsoft Planner "Export plan to Excel" workbook.
//
// Planner's export has changed between versions, so nothing here depends on a fixed layout:
// the task table is found by its header row, and columns are matched by name. Every task
// becomes one Clique project; the person importing picks a board column for each bucket.

import { HttpError } from './store.js';
import { readXlsx } from './xlsx.js';

// Header names seen in Planner exports (compared lowercased, with spacing collapsed).
const COLUMNS = {
  title: ['task name', 'task title', 'title', 'name'],
  bucket: ['bucket name', 'bucket'],
  progress: ['progress', 'status'],
  priority: ['priority'],
  assignees: ['assigned to', 'assignments', 'assignees'],
  start: ['start date', 'start'],
  due: ['due date', 'due', 'finish date'],
  completedDate: ['completed date'],
  checklist: ['checklist items', 'checklist'],
  checklistDone: ['completed checklist items', 'completed checklist item count'],
  labels: ['labels'],
  description: ['description', 'notes'],
  taskId: ['task id', 'id'],
  createdBy: ['created by'],
  createdDate: ['created date'],
};
const MAX_TASKS = 2000;

const norm = (v) => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const text = (v) => (v === null || v === undefined ? '' : String(v).replace(/\r\n?/g, '\n').trim());
// Planner joins multi-value cells (assignees, labels, checklist items) with semicolons.
const list = (v) => text(v).split(/;|\n/).map((s) => s.trim()).filter(Boolean);

function fieldFor(header) {
  const h = norm(header);
  return Object.keys(COLUMNS).find((f) => COLUMNS[f].includes(h));
}

// The header row is the first one (near the top) that names a title column and at least
// two other known columns. Rows above it hold plan details such as "Plan name".
function findHeader(rows) {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const map = {};
    (rows[i] ?? []).forEach((cell, col) => {
      const f = fieldFor(cell);
      if (f && map[f] === undefined) map[f] = col;
    });
    if (map.title !== undefined && Object.keys(map).length >= 3) return { index: i, map };
  }
  return null;
}

// Excel serial numbers, ISO dates, and M/D/YYYY (or D/M/YYYY when the first part is over 12,
// since Planner writes dates in the exporting user's locale). Returns YYYY-MM-DD or ''.
export function parseDate(v) {
  if (typeof v === 'number' && v > 0) return new Date(Date.UTC(1899, 11, 30) + Math.round(v * 86400000)).toISOString().slice(0, 10);
  const s = text(v);
  let y, m, d;
  let r;
  if ((r = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) [y, m, d] = [r[1], r[2], r[3]].map(Number);
  else if ((r = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\b/))) {
    const [a, b] = [Number(r[1]), Number(r[2])];
    y = Number(r[3]) + (r[3].length === 2 ? 2000 : 0);
    [m, d] = a > 12 ? [b, a] : [a, b];
  } else return '';
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return '';
  return date.toISOString().slice(0, 10);
}

function parseProgress(v) {
  const s = norm(v).replace('%', '');
  if (s === 'completed' || s === '100') return 'Completed';
  if (s === 'in progress' || s === '50') return 'In progress';
  if (s === 'not started' || s === '0') return 'Not started';
  return text(v);
}

// "Completed checklist items" is either a count ("2/5") or the names of the checked items.
// A partial count can't say which items are done, so only a full count marks them all done.
function parseChecklist(itemsCell, doneCell) {
  const items = list(itemsCell);
  const count = text(doneCell).match(/^(\d+)\s*\/\s*(\d+)$/);
  const doneNames = count ? null : new Set(list(doneCell).map((s) => s.toLowerCase()));
  const allDone = count && Number(count[1]) === items.length && items.length > 0;
  return items.map((t) => ({ text: t, done: Boolean(allDone || doneNames?.has(t.toLowerCase())) }));
}

export function parsePlannerWorkbook(buf) {
  let sheets;
  try {
    sheets = readXlsx(buf);
  } catch {
    throw new HttpError(400, "That file isn't an Excel workbook (.xlsx). Use Planner's \"Export plan to Excel\" and upload the file it downloads.");
  }
  for (const sheet of sheets) {
    const header = findHeader(sheet.rows);
    if (!header) continue;
    const { map } = header;
    const cell = (row, f) => (map[f] === undefined ? null : row[map[f]]);
    let planName = sheet.name;
    for (const row of sheet.rows.slice(0, header.index)) if (norm(row?.[0]) === 'plan name' && text(row[1])) planName = text(row[1]);

    const tasks = [];
    for (const row of sheet.rows.slice(header.index + 1)) {
      if (!row) continue;
      const title = text(cell(row, 'title'));
      if (!title) continue;
      if (tasks.length >= MAX_TASKS) throw new HttpError(400, `That plan has more than ${MAX_TASKS} tasks; split it before importing.`);
      tasks.push({
        title: title.slice(0, 200),
        bucket: text(cell(row, 'bucket')),
        progress: parseProgress(cell(row, 'progress')),
        priority: text(cell(row, 'priority')),
        assignees: list(cell(row, 'assignees')),
        startDate: parseDate(cell(row, 'start')),
        dueDate: parseDate(cell(row, 'due')),
        completedDate: parseDate(cell(row, 'completedDate')),
        checklist: parseChecklist(cell(row, 'checklist'), cell(row, 'checklistDone')),
        labels: list(cell(row, 'labels')),
        description: text(cell(row, 'description')),
        taskId: text(cell(row, 'taskId')),
        createdBy: text(cell(row, 'createdBy')),
        createdDate: parseDate(cell(row, 'createdDate')),
      });
    }
    const counts = new Map();
    for (const t of tasks) counts.set(t.bucket, (counts.get(t.bucket) ?? 0) + 1);
    return {
      planName,
      columns: Object.keys(map),
      tasks,
      buckets: [...counts].map(([name, count]) => ({ name, count })),
    };
  }
  throw new HttpError(400, "Couldn't find a Planner task list in that workbook (a header row with a Task Name or Title column).");
}

// Planner's priorities are Urgent / Important / Medium / Low; use the closest option the workspace has.
const PRIORITY_FALLBACKS = { urgent: ['urgent', 'critical', 'high'], important: ['important', 'high'], medium: ['medium', 'normal'], low: ['low'] };
function matchOption(value, options = []) {
  const v = norm(value);
  for (const want of PRIORITY_FALLBACKS[v] ?? [v]) {
    const opt = options.find((o) => norm(o.value) === want);
    if (opt) return opt.value;
  }
  return null;
}

// Which workspace properties imported fields land in (null when the workspace has no fitting property).
export function plannerTargets(ws) {
  const find = (key, type) => ws.properties.find((p) => p.key === key && p.type === type) ?? ws.properties.find((p) => p.type === type) ?? null;
  return {
    assignees: find('owner', 'people'),
    due: find('due', 'date'),
    priority: ws.properties.find((p) => p.key === 'priority' && p.type === 'select') ?? null,
  };
}

// The project body: the task's description, then whatever Planner had that has no Clique field.
function bodyFor(t, targets) {
  const description = t.description
    .split('\n')
    .map((l) => l.trimEnd())
    .filter(Boolean)
    .join('\n\n');
  const details = [];
  if (t.bucket) details.push(`- Bucket: ${t.bucket}`);
  if (t.progress) details.push(`- Progress: ${t.progress}${t.completedDate ? ` (${t.completedDate})` : ''}`);
  if (t.labels.length) details.push(`- Labels: ${t.labels.join(', ')}`);
  if (t.startDate) details.push(`- Start date: ${t.startDate}`);
  if (t.dueDate && !targets.due) details.push(`- Due date: ${t.dueDate}`);
  if (t.assignees.length && !targets.assignees) details.push(`- Assigned to: ${t.assignees.join(', ')}`);
  if (t.priority && !targets.priority) details.push(`- Priority: ${t.priority}`);
  if (t.createdBy || t.createdDate) details.push(`- Created: ${[t.createdBy, t.createdDate].filter(Boolean).join(', ')}`);
  if (t.taskId) details.push(`- Planner task ID: \`${t.taskId}\``);
  const footer = details.length ? `**Imported from Microsoft Planner**\n\n${details.join('\n')}\n` : '';
  return [description, footer].filter(Boolean).join('\n\n');
}

// `statusByBucket` maps each bucket name to a column id, or '' / missing to leave that bucket out.
export async function importPlannerTasks(store, tasks, statusByBucket) {
  if (!Array.isArray(tasks) || tasks.length > MAX_TASKS) throw new HttpError(400, 'Nothing to import');
  if (!statusByBucket || typeof statusByBucket !== 'object') throw new HttpError(400, 'Choose a column for each bucket');
  const ws = await store.getWorkspace();
  for (const status of Object.values(statusByBucket))
    if (status && !ws.columns.some((c) => c.id === status)) throw new HttpError(400, `Unknown column "${status}"`);
  const targets = plannerTargets(ws);

  const created = [];
  let skipped = 0;
  for (const t of tasks) {
    const status = statusByBucket[t?.bucket ?? ''];
    if (!status || !t?.title) {
      skipped++;
      continue;
    }
    const task = {
      ...t,
      assignees: Array.isArray(t.assignees) ? t.assignees.map(String) : [],
      labels: Array.isArray(t.labels) ? t.labels.map(String) : [],
      checklist: Array.isArray(t.checklist) ? t.checklist : [],
      description: text(t.description),
    };
    const properties = {};
    if (targets.assignees && task.assignees.length) properties[targets.assignees.key] = task.assignees;
    if (targets.due && task.dueDate) properties[targets.due.key] = String(task.dueDate);
    const priority = targets.priority && matchOption(task.priority, targets.priority.options);
    if (priority) properties[targets.priority.key] = priority;

    const p = await store.createProject({ title: task.title, status });
    await store.updateProject(p.id, {
      properties,
      subtasks: task.checklist.map((c) => ({ text: c.text, done: c.done, ...(c.done ? { doneAt: task.completedDate || undefined } : {}) })),
      body: bodyFor(task, targets),
    });
    created.push({ id: p.id, title: p.title });
  }
  return { created, skipped };
}
