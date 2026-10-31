import { useEffect, useRef } from 'react';
import { usePhone } from '../usePhone.js';
import Sheet from './Sheet.jsx';

// A panel under its button that closes on a click elsewhere or Escape. Place it inside a
// position: relative wrapper together with the button that opens it (`anchor`), so clicking
// that button again toggles it instead of closing and reopening it. On a phone there is no room
// beside the button, so the same content opens as a bottom sheet.
export default function Popover({ title, ...props }) {
  const phone = usePhone();
  if (phone) {
    return (
      <Sheet title={title} onClose={props.onClose} className={props.className}>
        {props.children}
      </Sheet>
    );
  }
  return <AnchoredPanel {...props} />;
}

function AnchoredPanel({ anchor, onClose, align = 'left', className = '', children }) {
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
