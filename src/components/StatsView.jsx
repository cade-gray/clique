import { useEffect, useMemo, useState } from 'react';
import { api, LIVE_STATUS } from '../api.js';
import { formatDate, formatDateTime, timeAgo } from './props.jsx';
import { BarChart, ChartTable, ColumnChart, Legend, Meter, SERIES_SLOTS, StackedBar, StatTile, monthLabel, seriesColor } from './charts.jsx';

const POLL_MS = 30000;

// Board columns map onto the fixed series slots in order. Past the eighth, the tail is
// summed into one "other" series rather than reusing a colour that already means something
// else; the table under the chart still lists every column separately.
function foldColumns(columns) {
  if (columns.length <= SERIES_SLOTS) return columns.map((c) => ({ id: c.id, name: c.name, ids: [c.id] }));
  const rest = columns.slice(SERIES_SLOTS - 1);
  return [
    ...columns.slice(0, SERIES_SLOTS - 1).map((c) => ({ id: c.id, name: c.name, ids: [c.id] })),
    { id: '__other', name: `${rest.length} other columns`, ids: rest.map((c) => c.id) },
  ];
}

function reasonText(reason, targetName) {
  if (reason.kind === 'blocked') return reason.detail ? `Blocked — ${reason.detail}` : 'Blocked';
  if (reason.kind === 'overdue') return `${targetName || 'Target date'} ${formatDate(reason.detail)} has passed`;
  return `Last updated ${timeAgo(reason.detail)}`;
}

function activityText(e) {
  if (e.type === 'task') return `${e.done ? 'finished' : 'reopened'} “${e.text}”`;
  if (e.type === 'created') return e.to ? `created in ${e.toName}` : 'created';
  if (e.type === 'deleted') return e.fromName ? `deleted from ${e.fromName}` : 'deleted';
  return `moved from ${e.fromName ?? '—'} to ${e.toName ?? '—'}`;
}

// Whether recent activity includes tasks: off until someone turns it on, then remembered in this browser.
const TASKS_KEY = 'clique-stats-show-tasks';
function useShowTasks() {
  const [show, setShow] = useState(() => {
    try {
      return localStorage.getItem(TASKS_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const update = (next) => {
    setShow(next);
    try {
      localStorage.setItem(TASKS_KEY, String(next));
    } catch {
      // storage unavailable; the choice just won't be remembered
    }
  };
  return [show, update];
}

export default function StatsView({ workspace }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [showTasks, setShowTasks] = useShowTasks();

  useEffect(() => {
    const load = () => api.stats().then((s) => { setStats(s); setError(null); }, setError);
    load();
    const t = setInterval(() => document.visibilityState === 'visible' && load(), POLL_MS);
    window.addEventListener('focus', load);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', load);
    };
  }, []);

  const series = useMemo(() => foldColumns(workspace.columns), [workspace.columns]);

  if (error && !stats) return <div className="banner error">Could not load the stats: {error.message}</div>;
  if (!stats) return <p className="muted stats-loading">Working out the numbers…</p>;

  const liveName = workspace.columns.find((c) => c.id === LIVE_STATUS)?.name ?? 'Live';
  const targetName = stats.targetProperty?.name ?? '';
  const activity = showTasks ? stats.recentWithTasks : stats.recent;

  const groupRows = stats.byGroup.map((g) => ({
    label: g.name,
    total: g.total,
    counts: Object.fromEntries(series.map((s) => [s.id, s.ids.reduce((n, id) => n + (g.counts[id] ?? 0), 0)])),
  }));

  const monthSeries = [
    { key: 'created', name: 'Created', partial: false },
    { key: 'delivered', name: `Went ${liveName.toLowerCase()}`, partial: true },
  ];
  const startIndex = stats.months.findIndex((m) => m.delivered !== null);

  return (
    <div className="settings stats">
      <div className="settings-bar">
        <h2>Stats</h2>
        <span className="muted small">Updated {timeAgo(stats.generatedAt)}</span>
      </div>

      {error && <div className="banner warn">Showing the last figures loaded — the server did not answer: {error.message}</div>}

      <h3 className="stats-heading">Portfolio</h3>

      <section className="tiles">
        <StatTile label="Active projects" value={stats.totals.active} hint={`of ${stats.totals.projects} on the board`} />
        <StatTile label={liveName} value={stats.totals.live} hint={`${stats.totals.maintenance} in maintenance`} />
        <StatTile
          label={`Went ${liveName.toLowerCase()}, last 90 days`}
          value={stats.history.startedAt ? stats.delivery.last90 : '—'}
          hint={stats.history.startedAt ? `${stats.delivery.total} since tracking began` : 'nothing recorded yet'}
        />
        <StatTile
          label="Typical time to go live"
          value={stats.delivery.medianDays === null ? '—' : `${stats.delivery.medianDays} days`}
          hint={
            stats.delivery.sample
              ? `median of ${stats.delivery.sample} project${stats.delivery.sample === 1 ? '' : 's'}`
              : 'needs a project to go live first'
          }
        />
      </section>

      <div className="stats-pair">
        <section>
          <h3>Where the work sits</h3>
          <p className="muted small">Every project on the board, by column.</p>
          <BarChart rows={stats.byStatus.map((s) => ({ label: s.name, value: s.count }))} />
          <ChartTable head={['Column', 'Projects']} rows={stats.byStatus.map((s) => [s.name, s.count])} />
        </section>

        <section>
          <h3>Work per group</h3>
          <p className="muted small">Bar length is the group's whole portfolio; the segments are the columns it sits in.</p>
          <Legend items={series.map((s, i) => ({ label: s.name, color: seriesColor(i) }))} />
          <StackedBar rows={groupRows} series={series} />
          <ChartTable
            head={['Group', ...workspace.columns.map((c) => c.name), 'Total']}
            rows={stats.byGroup.map((g) => [g.name, ...workspace.columns.map((c) => g.counts[c.id] ?? 0), g.total])}
          />
        </section>
      </div>

      <section>
        <h3>Created and delivered by month</h3>
        <p className="muted small">
          {stats.history.startedAt ? (
            <>
              Creation dates come from the project files, so they go back as far as the board does. Go-lives are only
              counted from {formatDate(stats.history.startedAt)}, when this started being recorded — earlier months show
              no go-live bar rather than a zero.
            </>
          ) : (
            <>Nothing has been recorded yet. Go-lives will start appearing here as projects are moved into {liveName}.</>
          )}
        </p>
        <Legend items={monthSeries.map((s, i) => ({ label: s.name, color: seriesColor(i) }))} />
        <ColumnChart months={stats.months} series={monthSeries} startIndex={startIndex} />
        <ChartTable
          head={['Month', 'Created', `Went ${liveName.toLowerCase()}`]}
          rows={stats.months.map((m) => [
            monthLabel(m.month),
            m.created,
            m.delivered === null ? 'not recorded' : m.delivered + (m.partial ? ' (part month)' : ''),
          ])}
        />
      </section>

      <h3 className="stats-heading">Day to day</h3>

      <section>
        <h3>Needs attention</h3>
        <p className="muted small">
          Blocked, past their {targetName ? targetName.toLowerCase() : 'target date'}, or untouched for{' '}
          {stats.history.staleDays} days. Retired projects are left out.
        </p>
        {stats.attention.length === 0 ? (
          <p className="muted">Nothing is blocked, overdue or going quiet.</p>
        ) : (
          <table className="list attention-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Column</th>
                <th>Group</th>
                <th>Why</th>
              </tr>
            </thead>
            <tbody>
              {stats.attention.map((a) => (
                <tr key={a.id} className={a.reasons[0].kind}>
                  <td className="col-title">
                    <a href={`#/p/${encodeURIComponent(a.id)}`}>{a.title}</a>
                  </td>
                  <td>{a.statusName}</td>
                  <td>{a.groupName}</td>
                  <td>
                    {a.reasons.map((r) => (
                      <div key={r.kind} className={`reason reason-${r.kind}`}>
                        {reasonText(r, targetName)}
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h3>Who is carrying what</h3>
        <p className="muted small">
          Counted from the people properties on each project and the owners on its tasks. Retired projects are left out.
        </p>
        <Meter done={stats.totals.tasks.done} total={stats.totals.tasks.total} label="Tasks across the board" />
        {stats.people.length === 0 ? (
          <p className="muted">No people are named on any project yet.</p>
        ) : (
          <table className="list">
            <thead>
              <tr>
                <th>Person</th>
                <th>Groups</th>
                <th className="num">Active</th>
                <th className="num">{liveName}</th>
                <th className="num">Open tasks</th>
              </tr>
            </thead>
            <tbody>
              {stats.people.map((p) => (
                <tr key={p.name}>
                  <td className="col-title">{p.name}</td>
                  <td className="muted">{p.groups.join(', ')}</td>
                  <td className="num">{p.active}</td>
                  <td className="num">{p.live}</td>
                  <td className="num">{p.openTasks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <div className="activity-head">
          <h3>Recent activity</h3>
          <label className="activity-toggle">
            <input type="checkbox" checked={showTasks} onChange={(e) => setShowTasks(e.target.checked)} />
            Show tasks
          </label>
        </div>
        {activity.length === 0 ? (
          <p className="muted">Nothing has moved yet.</p>
        ) : (
          <ul className="activity">
            {activity.map((e, i) => (
              <li key={`${e.at}-${e.project}-${i}`}>
                <span className="when" title={formatDateTime(e.at)}>
                  {timeAgo(e.at)}
                </span>
                {e.exists ? <a href={`#/p/${encodeURIComponent(e.project)}`}>{e.title}</a> : <span>{e.title}</span>}{' '}
                <span className="muted">{activityText(e)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
