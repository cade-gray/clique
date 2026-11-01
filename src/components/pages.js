// How a project's pages divide into wiki pages and to-do docs. No React here, so they can be unit tested.

// A page is a to-do doc while a to-do links to it; every other page belongs to the project's wiki.
export function splitPages(pages, subtasks) {
  const linked = new Set(subtasks.flatMap((s) => s.docs ?? []));
  return { wiki: pages.filter((p) => !linked.has(p.id)), todoDocs: pages.filter((p) => linked.has(p.id)) };
}

// The to-do a page was written for, if any.
export function todoOf(pageId, subtasks) {
  return subtasks.find((s) => s.docs?.includes(pageId)) ?? null;
}

// The pages linked to a to-do, in the order they were added.
export function docsOf(todo, pages) {
  return (todo.docs ?? []).flatMap((id) => pages.filter((p) => p.id === id));
}
