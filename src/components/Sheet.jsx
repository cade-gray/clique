import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// A panel that slides up from the bottom of a phone screen. Closes on the backdrop, the close
// button or Escape, and stays above the on-screen keyboard.
export default function Sheet({ title, onClose, className = '', children }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const sheet = ref.current;
    const previous = document.activeElement;
    // A field inside may have taken focus already (autoFocus); leave it there.
    if (!sheet.contains(previous)) sheet.focus({ preventScroll: true });

    const onKey = (e) => e.key === 'Escape' && closeRef.current();
    document.addEventListener('keydown', onKey);

    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const vv = window.visualViewport;
    const fit = () => sheet.style.setProperty('--keyboard', `${Math.max(0, window.innerHeight - vv.height - vv.offsetTop)}px`);
    if (vv) {
      fit();
      vv.addEventListener('resize', fit);
      vv.addEventListener('scroll', fit);
    }

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      if (vv) {
        vv.removeEventListener('resize', fit);
        vv.removeEventListener('scroll', fit);
      }
      previous?.focus?.({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <div className="sheet-layer">
      <button className="sheet-scrim" tabIndex={-1} aria-label="Close" onClick={onClose} />
      <div ref={ref} className={`sheet ${className}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon sheet-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
