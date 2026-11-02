// How a project's pages divide into wiki pages and task notes. No React here, so they can be unit tested.

// A page is task notes while a task links to it; every other page belongs to the project's wiki.
export function splitPages(pages, subtasks) {
  const linked = new Set(subtasks.map((s) => s.doc));
  return { wiki: pages.filter((p) => !linked.has(p.id)), taskDocs: pages.filter((p) => linked.has(p.id)) };
}

// The task a page was written for, if any.
export function taskOf(pageId, subtasks) {
  return subtasks.find((s) => s.doc === pageId) ?? null;
}

// The page linked to a task, if any.
export function docOf(task, pages) {
  return pages.find((p) => p.id === task.doc) ?? null;
}
