import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';

// The editor bundle is large, so load it only when a page is opened.
const MarkdownEditor = lazy(() => import('./MarkdownEditor.jsx'));

const SAVE_DELAY_MS = 700;

// Markdown body with debounced autosave and conflict handling.
// `save(body, baseVersion)` must resolve to the saved doc ({ version }) or reject with
// err.status === 409 and err.data.current = { body, version } when someone else saved first.
export default function DocBody({ docKey, body, version, save }) {
  const [editorKey, setEditorKey] = useState(0);
  const [content, setContent] = useState(body);
  const [status, setStatus] = useState('saved'); // saved | pending | saving | error | conflict
  const [conflict, setConflict] = useState(null);
  const versionRef = useRef(version);
  const pending = useRef(null);
  const timer = useRef(null);
  const saveRef = useRef(save);
  saveRef.current = save;

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const text = pending.current;
    if (text == null) return;
    pending.current = null;
    setStatus('saving');
    try {
      const doc = await saveRef.current(text, versionRef.current);
      versionRef.current = doc.version;
      setStatus(pending.current == null ? 'saved' : 'pending');
    } catch (err) {
      if (err.status === 409) {
        setConflict({ mine: text, theirs: err.data.current });
        setStatus('conflict');
      } else {
        pending.current ??= text;
        setStatus('error');
      }
    }
  }, []);

  // Save whatever is pending when leaving the page or closing the tab.
  useEffect(() => {
    const onUnload = () => flush();
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      flush();
    };
  }, [flush]);

  function onChange(markdown) {
    if (conflict) return;
    pending.current = markdown;
    setStatus('pending');
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY_MS);
  }

  function useTheirs() {
    versionRef.current = conflict.theirs.version;
    setContent(conflict.theirs.body);
    setConflict(null);
    setStatus('saved');
    setEditorKey((k) => k + 1);
  }

  function keepMine() {
    versionRef.current = conflict.theirs.version;
    pending.current = conflict.mine;
    setConflict(null);
    flush();
  }

  return (
    <div className="doc-body">
      <SaveStatus status={status} onRetry={flush} />
      {conflict && (
        <div className="banner warn">
          Someone else saved this page while you were editing.
          <button onClick={useTheirs}>Load their version</button>
          <button onClick={keepMine}>Overwrite with mine</button>
        </div>
      )}
      <Suspense fallback={<div className="loading">Loading editor…</div>}>
        <MarkdownEditor key={`${docKey}:${editorKey}`} value={content} onChange={onChange} />
      </Suspense>
    </div>
  );
}

function SaveStatus({ status, onRetry }) {
  const text = {
    saved: 'Saved',
    pending: 'Editing…',
    saving: 'Saving…',
    error: 'Save failed',
    conflict: 'Not saved',
  }[status];
  return (
    <div className={`save-status ${status}`}>
      {text}
      {status === 'error' && (
        <button className="link" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
