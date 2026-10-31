// Small pure helpers behind the phone layout. No React here, so they can be unit tested.

// The column's ids after placing `id` at `index` among the cards on screen. Cards hidden by a search
// or filter keep their place: the card lands just before the visible card now at `index`, or just
// after the last visible one.
export function placeInColumn({ allIds, visibleIds, id, index }) {
  const others = allIds.filter((x) => x !== id);
  const visible = visibleIds.filter((x) => x !== id);
  const pos = visible[index]
    ? others.indexOf(visible[index])
    : visible.length
      ? others.indexOf(visible[visible.length - 1]) + 1
      : others.length;
  others.splice(pos, 0, id);
  return others;
}

const filled = (v) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0);

// What a compact card or row shows from a project's properties. Properties are user-defined, so
// this picks by type: the first filled select (a priority, say), people and date.
export function cardSummary(project, properties) {
  const first = (type) => properties.find((d) => d.type === type && filled(project.properties[d.key]));
  const select = first('select');
  const people = first('people');
  const date = first('date');
  const names = people ? project.properties[people.key] : [];
  return {
    tag: select ? { value: String(project.properties[select.key]), color: select.options?.find((o) => o.value === project.properties[select.key])?.color || 'gray' } : null,
    people: Array.isArray(names) ? names : [String(names)],
    date: date ? project.properties[date.key] : null,
  };
}

// The stage whose pane fills the screen at this horizontal scroll position.
export function paneAt(scrollLeft, paneWidth, count) {
  if (!paneWidth || !count) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(scrollLeft / paneWidth)));
}
