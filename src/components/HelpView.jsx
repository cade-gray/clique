import { version } from '../../package.json';
import { LIVE_STATUS } from '../api.js';

// What each built-in column is for. Columns can be renamed, so the page shows the board's own
// names; columns a team adds itself are listed without a description.
const STAGES = {
  backlog: 'Requests and ideas: what is wanted, by whom, and why.',
  'in-progress': 'The working space while it is built: to-dos with owners, design notes, field mappings, open questions and status updates.',
  review: 'Testing, sign-off and go-live preparation.',
  [LIVE_STATUS]:
    'In production. The page becomes the solution’s wiki: what it does, how it works, the systems it touches, runbooks and support notes. A to-do added here puts the project into maintenance until it is checked off.',
  graveyard: 'Retired. Nothing is deleted, so the history and documentation are still there if someone asks how it used to work, or it comes back.',
};

export default function HelpView({ workspace }) {
  const known = workspace.columns.filter((c) => STAGES[c.id]);
  const others = workspace.columns.filter((c) => !STAGES[c.id]);

  return (
    <div className="settings help">
      <div className="settings-bar">
        <h2>Help</h2>
        <span className="muted small">Version {version}</span>
      </div>

      <section>
        <p className="lead">
          Clique is the home base for the solutions this team builds. Every integration, automation, internal app or report feed gets one card that
          follows it through the whole software development lifecycle, and stays on as its wiki page after go-live.
        </p>
        <p>
          Most trackers stop caring about work once it ships, and what the team knows ends up scattered across tickets, chats and personal notes.
          Here, the page where a solution was planned and built is the same page used to support it afterwards.
        </p>
      </section>

      <section>
        <h3>A solution’s life on the board</h3>
        <p className="muted small">Each column is a stage. Move a card along as the solution moves.</p>
        <dl className="stages">
          {known.map((c) => (
            <div key={c.id}>
              <dt>{c.name}</dt>
              <dd>{STAGES[c.id]}</dd>
            </div>
          ))}
        </dl>
        {others.length > 0 && <p className="muted small">Also on this board: {others.map((c) => c.name).join(', ')}.</p>}
      </section>

      <section>
        <h3>What goes on a project</h3>
        <ul>
          <li>
            <strong>Properties</strong> shared by every project ({workspace.properties.map((p) => p.name).join(', ') || 'set them up under Configuration'}). They
            show on the card, so the board doubles as an inventory of what has been built.
          </li>
          <li>
            <strong>Pages</strong>: an overview plus as many sub-pages as needed (design, field mapping, runbook, meeting notes). Type <code>/</code> for
            headings, tables, code blocks and more; paste screenshots straight in. General pages sit under <strong>Wiki</strong>; a page written for one
            to-do sits under <strong>To-do notes</strong>.
          </li>
          <li>
            <strong>Status updates</strong>: a dated record of decisions and progress. The latest one shows on the card.
          </li>
          <li>
            A <strong>group</strong>: the team the solution belongs to. Groups and their people are set up under{' '}
            <a href="#/settings">Configuration</a>; a project's group members are offered first when choosing owners.
          </li>
          <li>
            <strong>To-dos</strong> with owners. Checked-off items move to a history section rather than disappearing.
          </li>
          <li>
            <strong>Blocked</strong> (red outline), set by hand with a reason, and <strong>Maintenance</strong> (yellow outline), which a Live project
            goes into on its own while it has an open to-do.
          </li>
        </ul>
      </section>

      <section>
        <h3>Good to know</h3>
        <ul>
          <li>
            Give a project one or more <strong>GitHub repos</strong> and its to-dos can create or link an issue there. New issues are written on GitHub under your own
            account; paste the link back into the to-do.
          </li>
          <li>
            <a href="#/workday">Workday</a> lists one person's to-dos from every project, for planning a day, with the same schedule, notes and issue buttons as the project page. A{' '}
            <strong>Potential blocker</strong> label means the project is blocked, which may or may not hold up that to-do.
          </li>
          <li>
            <a href="#/list">List view</a> gives a sortable table of every project, with CSV export and a print layout for reports and audits. Use{' '}
            <strong>Columns</strong> to leave out detail management doesn't need.
          </li>
          <li>
            <strong>+ Filter</strong> on the board and list narrows them down by group, person, status, flags or any property. The same filters apply to both views.
          </li>
          <li>
            <a href="#/stats">Stats</a> covers the whole board: how much is active and live, how long things take to go live, and what each group is
            carrying, then what is blocked, overdue or going quiet. Delivery figures only count moves recorded from the day the history log started, so
            they fill in over time.
          </li>
          <li>
            Existing work in Microsoft Planner can be brought in from <a href="#/import">Import</a>.
          </li>
          <li>Deleting a project or page moves it to a trash folder on the server; it can be restored from there.</li>
          <li>
            Everything is saved as plain markdown files on the server, so the documentation can be read, searched and backed up without Clique.
          </li>
          <li>There are no logins: everyone who can open this site can view and edit every project.</li>
        </ul>
      </section>
    </div>
  );
}
