import { useEffect, useRef } from 'react';

// One button per group, shown above the board, list and stats. Without groups there's nothing to pick.
export default function Perspectives({ groups, value, onChange }) {
  const active = useRef(null);

  // On a phone the row scrolls sideways, and the current perspective shouldn't start out of sight.
  useEffect(() => {
    active.current?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [value]);

  if (!groups.length) return null;
  return (
    <div className="perspectives" role="group" aria-label="Perspective">
      {[{ id: '', name: 'All groups' }, ...groups].map((g) => (
        <button key={g.id} ref={g.id === value ? active : null} className={g.id === value ? 'active' : ''} aria-pressed={g.id === value} onClick={() => onChange(g.id)}>
          {g.name}
        </button>
      ))}
    </div>
  );
}
