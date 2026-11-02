// What the list shows (and so what CSV and print include). No React here, so it can be unit tested.
export const DEFAULT_VIEW = { hidden: [], tasks: true, doneTasks: true, taskOwners: true };

// Settings saved before to-dos became tasks, so that nobody's choices reset.
const OLD_KEYS = { todos: 'tasks', doneTodos: 'doneTasks', todoOwners: 'taskOwners' };

// `json` is what this browser saved, or null if it has saved nothing.
export function savedView(json) {
  const view = { ...DEFAULT_VIEW };
  for (const [key, value] of Object.entries(JSON.parse(json) ?? {})) view[OLD_KEYS[key] ?? key] = value;
  return view;
}
