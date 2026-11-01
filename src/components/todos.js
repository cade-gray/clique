// Dragging to-dos into a new order. No React here, so it can be unit tested. A "slot" is a place
// between the open to-dos on screen: 0 is above the first, and the number of to-dos is below the last.

import { placeInColumn } from './phone.js';

// The slot for a pointer at `y`, given the vertical midpoint of each to-do, top to bottom.
export function slotAt(midpoints, y) {
  const i = midpoints.findIndex((m) => y < m);
  return i < 0 ? midpoints.length : i;
}

// The slots on either side of a to-do are where it already is.
export function movesNowhere(from, slot) {
  return slot === from || slot === from + 1;
}

// How far to scroll this frame for a finger at `y` on a screen `height` tall: nothing until it is
// near an edge, then faster the closer it gets. A finger can't reach what's off screen otherwise.
const EDGE = 80;
const TOP_SPEED = 12;
export function edgeSpeed(y, height) {
  const into = y < EDGE ? y - EDGE : y > height - EDGE ? y - (height - EDGE) : 0;
  return Math.round(Math.max(-1, Math.min(1, into / EDGE)) * TOP_SPEED);
}

// The whole list after moving the open to-do at position `from` to `slot`. Checked-off to-dos are
// in the list but not on screen, and keep their place among the others.
export function moveToSlot(items, open, from, slot) {
  // The slots below the to-do being moved each shift up one once it has left.
  return placeInColumn({ allIds: items, visibleIds: open, id: open[from], index: slot > from ? slot - 1 : slot });
}
