import { useState } from 'react';
import { api, LIVE_STATUS } from '../api.js';

const SKIP = '';

// Import from a Microsoft Planner "Export plan to Excel" workbook. Uploading only previews
// the file; nothing is created until "Import" is pressed with a column chosen for each bucket.
export default function ImportView({ workspace }) {
  const [preview, setPreview] = useState(null);
  const [buckets, setBuckets] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const defaultColumn = (workspace.columns.find((c) => c.id === 'backlog') ?? workspace.columns[0])?.id ?? SKIP;

  async function choose(file) {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setPreview(null);
    try {
      const p = await api.previewPlanner(file);
      setPreview(p);
      // A bucket named like a column goes there; a bucket whose tasks are all completed goes to Live;
      // everything else starts in Backlog.
      const byName = Object.fromEntries(workspace.columns.map((c) => [c.name.trim().toLowerCase(), c.id]));
      const live = workspace.columns.find((c) => c.id === LIVE_STATUS)?.id;
      const allCompleted = (name) => p.tasks.filter((t) => t.bucket === name).every((t) => t.progress === 'Completed');
      setBuckets(
        Object.fromEntries(
          p.buckets.map((b) => [b.name, byName[b.name.trim().toLowerCase()] ?? (live && allCompleted(b.name) ? live : defaultColumn)]),
        ),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    setBusy(true);
    setError(null);
    try {
      setResult(await api.importPlanner(preview.tasks, buckets));
      setPreview(null);
    } catch (e) {
      setError(`Import failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  const count = preview ? preview.tasks.filter((t) => buckets[t.bucket]).length : 0;
  const columnName = (id) => workspace.columns.find((c) => c.id === id)?.name;

  return (
    <div className="settings import">
      <div className="settings-bar">
        <h2>Import from Microsoft Planner</h2>
        {preview && (
          <button className="primary" disabled={busy || count === 0} onClick={runImport}>
            {busy ? 'Importing…' : `Import ${count} project${count === 1 ? '' : 's'}`}
          </button>
        )}
      </div>

      {error && <div className="banner error import-banner">{error}</div>}
      {result && (
        <div className="banner import-banner import-done">
          Imported {result.created.length} project{result.created.length === 1 ? '' : 's'}
          {result.skipped > 0 && ` (${result.skipped} left out)`}. <a href="#/">Open the board</a>
        </div>
      )}

      {!preview && (
        <section>
          <h3>1. Export the plan from Planner</h3>
          <ol className="steps">
            <li>Open the plan in Planner (in Teams or at planner.cloud.microsoft).</li>
            <li>
              Select <strong>…</strong> next to the plan name at the top, then <strong>Export plan to Excel</strong>.
            </li>
            <li>The workbook (.xlsx) downloads to your Downloads folder. Don't edit it first.</li>
          </ol>
          <h3>2. Choose the file</h3>
          <p className="muted small">Nothing is saved yet: you'll see what's in the plan and pick a board column for each bucket first.</p>
          <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={busy} onChange={(e) => choose(e.target.files[0])} />
          {busy && <span className="muted"> Reading…</span>}
        </section>
      )}

      {preview && (
        <>
          <section>
            <h3>
              {preview.planName}: {preview.tasks.length} task{preview.tasks.length === 1 ? '' : 's'}
            </h3>
            <p className="muted small">
              Each task becomes a project. Choose a column for each bucket, or leave a bucket out.{' '}
              <button className="link" onClick={() => setPreview(null)}>
                Choose a different file
              </button>
            </p>
            {preview.buckets.map((b) => (
              <div className="settings-row" key={b.name}>
                <span className="bucket-name">
                  {b.name || <em className="muted">No bucket</em>} <span className="muted">({b.count})</span>
                </span>
                <span className="muted">→</span>
                <select value={buckets[b.name] ?? SKIP} onChange={(e) => setBuckets({ ...buckets, [b.name]: e.target.value })}>
                  {workspace.columns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                  <option value={SKIP}>Don't import</option>
                </select>
              </div>
            ))}
          </section>

          <section>
            <h3>What goes where</h3>
            <ul className="mapping small">
              <li>Task name → project title; description → the project's page</li>
              <li>Checklist → to-dos</li>
              <li>{mapLine('Assigned to', preview.targets.assignees)}</li>
              <li>{mapLine('Due date', preview.targets.due)}</li>
              <li>{mapLine('Priority', preview.targets.priority)}</li>
              <li>Bucket, progress, labels, start date and Planner task ID → an "Imported from Microsoft Planner" note on the page</li>
            </ul>
          </section>

          <div className="list-scroll">
            <table className="list">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Bucket → column</th>
                  <th>Assigned to</th>
                  <th>Due</th>
                  <th>Checklist</th>
                </tr>
              </thead>
              <tbody>
                {preview.tasks.map((t, i) => (
                  <tr key={i} className={buckets[t.bucket] ? '' : 'skipped'}>
                    <td>{t.title}</td>
                    <td className="muted">
                      {t.bucket || 'No bucket'} → {columnName(buckets[t.bucket]) ?? "won't import"}
                    </td>
                    <td>{t.assignees.join(', ')}</td>
                    <td>{t.dueDate}</td>
                    <td>{t.checklist.length ? `${t.checklist.filter((c) => c.done).length}/${t.checklist.length}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function mapLine(field, target) {
  return target ? `${field} → ${target}` : `${field} → the note on the page (no matching property)`;
}
