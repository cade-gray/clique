import { useEffect, useRef } from 'react';
import { edgeSpeed, slotAt } from './tasks.js';

// Browsers on phones don't start a native drag from a touch, so the card follows pointer events
// instead. Only a handle starts one (it has touch-action: none), which leaves the rest of the page
// free to scroll. Returns the props for a handle, given which row it belongs to.
export function useTouchDrag({ listRef, onStart, onSlot, onDrop, onCancel }) {
  const drag = useRef(null);
  useEffect(() => () => cancelAnimationFrame(drag.current?.frame), []);

  // Page positions, not screen ones, because the list scrolls under a finger held near the edge.
  const slotFor = (y) => slotAt(drag.current.midpoints, y + window.scrollY);
  const follow = (y) => {
    drag.current.y = y;
    drag.current.card.style.transform = `translateY(${y + window.scrollY - drag.current.startY}px)`;
    onSlot(slotFor(y));
  };
  const scrollNearEdge = () => {
    const speed = edgeSpeed(drag.current.y, window.innerHeight);
    if (speed) {
      window.scrollBy(0, speed);
      follow(drag.current.y);
    }
    drag.current.frame = requestAnimationFrame(scrollNearEdge);
  };
  const stop = () => {
    cancelAnimationFrame(drag.current.frame);
    drag.current.card.style.transform = '';
    drag.current = null;
  };

  return (index) => ({
    onPointerDown(e) {
      e.currentTarget.setPointerCapture(e.pointerId);
      const rows = [...listRef.current.children].map((row) => row.getBoundingClientRect());
      drag.current = {
        card: e.currentTarget.closest('li'),
        startY: e.clientY + window.scrollY,
        y: e.clientY,
        // Measured once: nothing in the list moves during a drag except the card itself.
        midpoints: rows.map((r) => r.top + r.height / 2 + window.scrollY),
      };
      drag.current.frame = requestAnimationFrame(scrollNearEdge);
      onStart(index);
    },
    onPointerMove(e) {
      if (drag.current) follow(e.clientY);
    },
    onPointerUp(e) {
      if (!drag.current) return;
      const slot = slotFor(e.clientY);
      stop();
      onDrop(slot);
    },
    onPointerCancel() {
      if (!drag.current) return;
      stop();
      onCancel();
    },
  });
}
