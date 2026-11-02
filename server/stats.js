// Portfolio figures for the stats page.
//
// `computeStats` is a pure function of the project summaries, the workspace and the event
// log, so it can be tested without touching the disk. Two different kinds of number come
// out of it:
//
//   * A snapshot (how many projects sit where, what is blocked, who is carrying what) read
//     straight from the markdown files. Always complete.
//   * History (what was created and what went live, month by month) read from the event
//     log, which only knows what has happened since logging started. Months that ended
//     before then report `delivered: null` — "not recorded" rather than a misleading zero.

import { LIVE_STATUS, GRAVEYARD_STATUS } from './store.js';

const DAY = 86_400_000;

// Worst first: a project shows under the most serious reason it qualifies for.
const REASON_RANK = { blocked: 0, overdue: 1, stale: 2 };

const pad2 = (n) => String(n).padStart(2, '0');
// Local time throughout, to match the date handling in the board's filters: a go-live is
// "overdue" against the viewer's today, not UTC's.
const monthKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
const isoDay = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const isActive = (status) => status !== LIVE_STATUS && status !== GRAVEYARD_STATUS;

function toPeople(v) {
  if (Array.isArray(v)) return v.map((x) => String(x ?? '').trim()).filter(Boolean);
  const s = String(v ?? '').trim();
  return s ? [s] : [];
}

function median(sorted) {
  if (!sorted.length) return null;
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function computeStats({ projects, workspace, events, now = new Date(), monthsBack = 12, staleDays = 30 }) {
  const columnName = new Map(workspace.columns.map((c) => [c.id, c.name]));
  const nameOf = (status) => columnName.get(status) ?? status ?? '—';

  // ----- snapshot -----

  const tasks = projects.reduce(
    (acc, p) => ({ done: acc.done + (p.subtasks?.done ?? 0), total: acc.total + (p.subtasks?.total ?? 0) }),
    { done: 0, total: 0 },
  );
  const totals = {
    projects: projects.length,
    active: projects.filter((p) => isActive(p.status)).length,
    live: projects.filter((p) => p.status === LIVE_STATUS).length,
    graveyard: projects.filter((p) => p.status === GRAVEYARD_STATUS).length,
    blocked: projects.filter((p) => p.blocked).length,
    maintenance: projects.filter((p) => p.maintenance).length,
    tasks,
  };

  const byStatus = workspace.columns.map((c) => ({
    id: c.id,
    name: c.name,
    count: projects.filter((p) => p.status === c.id).length,
  }));

  // Groups in the order they are configured, with ungrouped projects last and only when
  // there are any.
  const byGroup = [...workspace.groups.map((g) => ({ id: g.id, name: g.name })), { id: null, name: 'No group' }]
    .map((g) => {
      const mine = projects.filter((p) => (p.group ?? null) === g.id);
      return {
        id: g.id,
        name: g.name,
        total: mine.length,
        active: mine.filter((p) => isActive(p.status)).length,
        counts: Object.fromEntries(workspace.columns.map((c) => [c.id, mine.filter((p) => p.status === c.id).length])),
      };
    })
    .filter((g) => g.id !== null || g.total > 0);

  // ----- history -----

  const startedAt = events.find((e) => e.type === 'log-started')?.at ?? null;
  const startedMs = startedAt ? new Date(startedAt).getTime() : null;

  // Events arrive oldest first, so the first hit for a project is the earliest one.
  const createdAt = new Map();
  const firstLive = new Map();
  for (const e of events) {
    if (e.type === 'created' && !createdAt.has(e.project)) createdAt.set(e.project, e.at);
    // Moving a project out of Live and back again is not a second delivery.
    if (e.type === 'status' && e.to === LIVE_STATUS && !firstLive.has(e.project)) firstLive.set(e.project, e.at);
  }

  const months = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    months.push({
      month: monthKey(start),
      from: start.getTime(),
      to: end.getTime(),
      created: 0,
      // Nothing was being recorded yet, which is not the same as nothing having happened.
      delivered: startedMs === null || end.getTime() <= startedMs ? null : 0,
      // The month logging began in only counts from the day it began.
      partial: startedMs !== null && start.getTime() < startedMs && end.getTime() > startedMs,
    });
  }
  const bucketOf = (at) => {
    const ms = new Date(at).getTime();
    return months.find((m) => ms >= m.from && ms < m.to);
  };
  for (const at of createdAt.values()) {
    const m = bucketOf(at);
    if (m) m.created += 1;
  }
  for (const at of firstLive.values()) {
    const m = bucketOf(at);
    if (m && m.delivered !== null) m.delivered += 1;
  }

  const cycleDays = [];
  for (const [id, liveAt] of firstLive) {
    const created = createdAt.get(id);
    if (!created) continue;
    const days = (new Date(liveAt).getTime() - new Date(created).getTime()) / DAY;
    if (days >= 0) cycleDays.push(days);
  }
  cycleDays.sort((a, b) => a - b);
  const since90 = now.getTime() - 90 * DAY;

  const delivery = {
    total: firstLive.size,
    last90: [...firstLive.values()].filter((at) => new Date(at).getTime() >= since90).length,
    medianDays: cycleDays.length ? Math.round(median(cycleDays)) : null,
    averageDays: cycleDays.length ? Math.round(cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length) : null,
    sample: cycleDays.length,
  };

  // ----- what needs attention -----

  const targetProperty = workspace.properties.find((p) => p.type === 'date') ?? null;
  const today = isoDay(now);
  const staleBefore = now.getTime() - staleDays * DAY;

  const attention = [];
  for (const p of projects) {
    if (p.status === GRAVEYARD_STATUS) continue;
    const reasons = [];
    if (p.blocked) reasons.push({ kind: 'blocked', detail: p.blockedReason || '' });
    if (isActive(p.status)) {
      const due = targetProperty ? p.properties?.[targetProperty.key] : null;
      const day = due ? String(due).slice(0, 10) : '';
      if (day && day < today) reasons.push({ kind: 'overdue', detail: day });
      const updated = p.updated ? new Date(p.updated).getTime() : null;
      if (updated !== null && updated < staleBefore) reasons.push({ kind: 'stale', detail: p.updated });
    }
    if (!reasons.length) continue;
    reasons.sort((a, b) => REASON_RANK[a.kind] - REASON_RANK[b.kind]);
    attention.push({
      id: p.id,
      title: p.title,
      status: p.status,
      statusName: nameOf(p.status),
      group: p.group ?? null,
      groupName: p.group ? (workspace.groups.find((g) => g.id === p.group)?.name ?? p.group) : '',
      reasons,
    });
  }
  attention.sort((a, b) => REASON_RANK[a.reasons[0].kind] - REASON_RANK[b.reasons[0].kind] || a.title.localeCompare(b.title));

  // ----- who is carrying what -----

  const peopleProps = workspace.properties.filter((p) => p.type === 'people');
  // Names are free text, so match ignoring case and keep the first spelling seen, the way
  // the board's person filter does.
  const people = new Map();
  const person = (name) => {
    const key = name.toLowerCase();
    if (!people.has(key)) people.set(key, { name, groups: [], active: 0, live: 0, openTasks: 0, doneTasks: 0 });
    return people.get(key);
  };
  for (const g of workspace.groups) for (const m of g.members) person(m).groups.push(g.name);
  for (const p of projects) {
    // Someone named in two different people properties on one project still owns one project.
    const owners = new Map();
    for (const def of peopleProps) for (const name of toPeople(p.properties?.[def.key])) owners.set(name.toLowerCase(), name);
    for (const name of owners.values()) {
      const rec = person(name);
      if (isActive(p.status)) rec.active += 1;
      else if (p.status === LIVE_STATUS) rec.live += 1;
    }
    if (p.status === GRAVEYARD_STATUS) continue;
    for (const t of p.subtasks?.items ?? []) {
      for (const name of t.owners ?? []) {
        const rec = person(name);
        if (t.done) rec.doneTasks += 1;
        else rec.openTasks += 1;
      }
    }
  }
  const peopleRows = [...people.values()].sort(
    (a, b) => b.active - a.active || b.openTasks - a.openTasks || a.name.localeCompare(b.name),
  );

  // ----- recent activity -----

  const latest = (list) =>
    list
      .slice(-25)
      .reverse()
      .map((e) => ({
        at: e.at,
        type: e.type,
        project: e.project,
        title: e.title ?? e.project,
        from: e.from ?? null,
        to: e.to ?? null,
        fromName: e.from ? nameOf(e.from) : null,
        toName: e.to ? nameOf(e.to) : null,
        backfilled: e.backfilled === true,
        // Projects that have since been deleted must not be linked to.
        exists: projects.some((p) => p.id === e.project),
        ...(e.type === 'task' ? { text: e.text ?? '', done: e.done === true } : {}),
      }));

  // Two lists rather than one filtered on the page: a busy day of checked-off tasks would
  // otherwise use up the 25 rows and leave the project activity with none.
  const activity = events.filter((e) => e.type !== 'log-started');
  const recent = latest(activity.filter((e) => e.type !== 'task'));
  const recentWithTasks = latest(activity);

  return {
    generatedAt: new Date(now).toISOString(),
    history: { startedAt, staleDays },
    totals,
    byStatus,
    byGroup,
    months: months.map(({ from: _f, to: _t, ...m }) => m),
    delivery,
    targetProperty: targetProperty ? { key: targetProperty.key, name: targetProperty.name } : null,
    attention,
    people: peopleRows,
    recent,
    recentWithTasks,
  };
}
