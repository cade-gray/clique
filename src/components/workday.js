// What the workday page lists. No React here, so it can be unit tested.

import { GRAVEYARD_STATUS } from '../api.js';

const lower = (s) => String(s).toLowerCase();

// A retired project's leftover to-dos aren't anyone's work.
const inPlay = (projects) => projects.filter((p) => p.status !== GRAVEYARD_STATUS);

// Everyone in a group, plus anyone who owns a to-do. Names are matched ignoring case; the first
// spelling seen is the one shown.
export function workdayPeople(workspace, projects) {
  const seen = new Map();
  const owners = inPlay(projects).flatMap((p) => (p.subtasks.items ?? []).flatMap((t) => t.owners ?? []));
  for (const n of [...workspace.groups.flatMap((g) => g.members), ...owners]) if (!seen.has(lower(n))) seen.set(lower(n), n);
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

// Open to-dos follow the board: column by column, then each project's own order. `potentialBlocker`
// only says the project is blocked; that may have nothing to do with this to-do, and a finished
// to-do can't be held up by it.
export function todosFor(person, projects, workspace) {
  const name = lower(person);
  const column = (p) => workspace.columns.findIndex((c) => c.id === p.status);
  const rows = inPlay(projects)
    .sort((a, b) => column(a) - column(b))
    .flatMap((p) =>
      (p.subtasks.items ?? [])
        .map((t, i) => ({ ...t, key: `${p.id}/${i}`, project: p, potentialBlocker: p.blocked && !t.done }))
        .filter((t) => (t.owners ?? []).some((o) => lower(o) === name)),
    );
  return {
    open: rows.filter((t) => !t.done),
    done: rows.filter((t) => t.done).sort((a, b) => String(b.doneAt ?? '').localeCompare(String(a.doneAt ?? ''))),
  };
}
