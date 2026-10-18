import { useEffect, useRef } from 'react';

// A panel under its button that closes on a click elsewhere or Escape. Place it inside a
// position: relative wrapper together with the button that opens it (`anchor`), so clicking
// that button again toggles it instead of closing and reopening it.
export default function Popover({ anchor, onClose, align = 'left', className = '', children }) {
  const ref = useRef(null);
  useEffect(() => {
    const onDown = (e) => {
      if (!ref.current?.contains(e.target) && !anchor?.current?.contains(e.target)) onClose();
    };
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [anchor, onClose]);
  return (
    <div ref={ref} className={`popover popover-${align} ${className}`}>
      {children}
    </div>
  );
}
