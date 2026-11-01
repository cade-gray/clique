// How a project's pages divide into wiki pages and to-do notes. No React here, so they can be unit tested.

// A page is to-do notes while a to-do links to it; every other page belongs to the project's wiki.
export function splitPages(pages, subtasks) {
  const linked = new Set(subtasks.map((s) => s.doc));
  return { wiki: pages.filter((p) => !linked.has(p.id)), todoDocs: pages.filter((p) => linked.has(p.id)) };
}

// The to-do a page was written for, if any.
export function todoOf(pageId, subtasks) {
  return subtasks.find((s) => s.doc === pageId) ?? null;
}

// The page linked to a to-do, if any.
export function docOf(todo, pages) {
  return pages.find((p) => p.id === todo.doc) ?? null;
}
