# Clique

Clique is a home base for the solutions a development team builds. Each project, whether an integration, an automation, an internal app or a report feed, gets one card that follows it through the whole software development lifecycle. The card stays useful after go-live as the solution's wiki page.

Most trackers stop caring about work once it ships, and the knowledge ends up scattered across tickets, chats and someone's notes. In Clique, the page where a solution was planned and built is the same page the team uses to support it afterwards.

## How it's used

The board's columns are the stages of a solution's life (they can be renamed or changed in the app):

| Stage | What the card is for |
| --- | --- |
| **Backlog** | Requests and ideas: what's wanted, by whom, and why. |
| **In progress** | The working space while it's built: tasks with owners, design notes, field mappings, open questions, and a timeline of status updates. |
| **In review** | Testing, sign-off and go-live preparation. |
| **Live** | In production. The page becomes the solution's wiki: what it does, how it works, the systems it touches, runbooks and support notes. A task added here flags the project as **in maintenance** until it's checked off. |
| **Graveyard** | Retired. Nothing is deleted, so the history and documentation are still there if someone asks how it used to work, or the solution comes back. |

Each project is more than a ticket:

- **Properties** shared by every project (owners, systems, go-live date, priority, or whatever your team needs) show on the card, so the board doubles as an inventory of what's been built.
- **Pages**: an overview plus as many sub-pages as you like (design, field mapping, runbook, meeting notes), edited Notion-style with markdown that renders as you type, tables, and code blocks with a copy button.
- **Status updates** keep a dated record of decisions and progress; the latest one shows on the card.
- **Tasks** (stories, in agile terms) with owners and history, each able to book a working block in Google Calendar, Outlook or any calendar that reads `.ics`, plus a **Blocked** flag and an automatic **Maintenance** flag that stand out on the board.
- **List view** for a sortable, printable, CSV-exportable view of everything, for management reports or audits.

Everything is stored as plain markdown files on disk (Obsidian-style), so the documentation outlives the tool: it can be read, searched, backed up or put in git without Clique. There is no database and no login yet; everyone who can reach the site edits the same board.

## Run it

Requires Node.js 20.19+ (22 LTS recommended).

```bash
npm install
npm run dev        # API on :3001 and Vite dev server on :5173 with hot reload, also reachable from your network
```

`npm run dev` works on `data.local/`, a git-ignored copy of `data/` made on the first run, so local testing never shows up in git. Delete `data.local/` to start again from the starter workspace, or set `DATA_DIR` to use a different folder.

Production:

```bash
npm run build      # builds the React app into dist/
npm start          # serves dist/ and the API on PORT (default 3001)
npm test           # storage and calendar-event tests
```

## Where the data lives

`DATA_DIR` (default `./data`) holds everything. The repo ships with a starter workspace in `data/` with a welcome project plus example projects for a credit union integrations team (each project is a built integration, such as an ITSM ↔ core banking incident sync), so a fresh clone opens to a working board. (If `workspace.yaml` is ever missing, the app recreates the defaults and the welcome project.) The `data/.trash/` folder and `data/events.ndjson` are git-ignored.

Clique is built for one board shared by one team. To keep your team's real data in git, point `DATA_DIR` at `data/` (`npm start` already uses it), commit it and use normal pull/push to share it; to keep it out of the repo, point `DATA_DIR` somewhere else.

```
data/
  workspace.yaml                     board columns, global property definitions, groups
  projects/
    website-redesign/
      index.md                       the project: frontmatter + overview page
      meeting-notes.md               an extra page inside the project
      attachments/                   images pasted into the project's pages, linked as attachments/<file>
  events.ndjson                      append-only history: creates, column moves, deletes (feeds Stats)
  .trash/                            deleted projects and pages are moved here, never erased
```

### events.ndjson

A project file holds its *current* state, so moving a card overwrites the column that was there before and nothing records that the move happened. `events.ndjson` is that record: one JSON object per line, appended and never rewritten, which is what the **Stats** page reads for go-lives per month and time-to-go-live.

```
{"at":"2026-10-18T09:00:00.000Z","type":"created","project":"ledger-feed","title":"Ledger feed","to":"backlog"}
{"at":"2026-10-18T11:30:00.000Z","type":"status","project":"ledger-feed","title":"Ledger feed","from":"backlog","to":"live"}
```

The first time a version with the log runs against an existing data folder, it writes a `created` line for every project from that project's own `created` date and then a `log-started` line. Those creation dates are real, so the "created" figures go back as far as the board does; the column moves made before that point were never written down, so nothing is invented for them and Stats reports those months as *not recorded* rather than zero.

**It cannot be rebuilt from the markdown**, so include it in your backups along with the rest of `DATA_DIR`. Losing it loses the delivery history and nothing else: the board, the projects and their pages are unaffected. A line that cannot be parsed is skipped rather than breaking the page, so it is safe to prune old lines by hand if it ever grows unwieldy (at a few hundred projects it stays in the tens of kilobytes).

### workspace.yaml

`workspace.yaml` defines the shape of the board: which **columns** exist, which **properties** every project has, and the **groups** of people projects belong to. There is exactly one per workspace, and it is read fresh on every request, so hand edits show up on the next refresh. You can edit it in the app (**Configuration**) or by hand.

```yaml
columns:                  # left to right on the board; also the Status choices
  - id: backlog           # stable id, stored in each project's `status`
    name: Backlog         # the label people see; safe to rename any time
  - id: in-progress
    name: In progress
  - id: live              # projects in production; only these can be in maintenance
    name: Live
  - id: graveyard
    name: Graveyard

properties:               # shown on every project, in this order
  - key: priority         # the frontmatter key in every project file (fixed once created)
    name: Priority        # the label people see; safe to rename any time
    type: select
    options:              # select and multi_select only
      - value: High
        color: red
      - value: Low
        color: gray
  - key: owner
    name: Owners
    type: people          # any number of names
  - key: due
    name: Go-live
    type: date

groups:                   # teams; each project can belong to one
  - id: it-integrations   # stable id, stored in each project's `group`
    name: IT Integrations # the label people see; safe to rename any time
    members:              # offered first when choosing owners on the group's projects
      - Alex
      - Priya
```

**Columns**

| Field | Rules |
| --- | --- |
| `id` | Lowercase letters, digits and `-`, up to 80 characters, unique. Stored in each project as `status`, so don't change it once projects use it. |
| `name` | The label shown on the board, up to 80 characters. |

- At least one column is required. The order in the file is the order on the board.
- Every project always has a valid status. New projects start in `backlog` (or the first column if there is no `backlog`). If a column is removed, or a file names a status that doesn't exist, its projects appear in `backlog`; the file is only rewritten the next time the project is saved.
- The `live` column id is special: only projects in it go into **Maintenance** when they have an open task. Rename its label freely, but keep the id.
- Upgrading from a version before 1.1: on start, a workspace with a `done` column (and no `live` one) has it replaced by **Live**, with **Graveyard** added after it, and every project in `done` is moved to `live`.

**Properties**

| Field | Rules |
| --- | --- |
| `key` | Same format as a column `id`, unique. It becomes a flat key in every project's frontmatter. It can't be one of the built-in keys: `title`, `status`, `order`, `group`, `repo`, `repos`, `subtasks`, `blocked`, `blockedReason`, `maintenance`, `updates`, `created`, `updated`. |
| `name` | The label shown in the UI and the CSV, up to 80 characters. |
| `type` | One of the types below. |
| `options` | For `select` and `multi_select`: a list of `{ value, color }`. Colors: `gray`, `brown`, `orange`, `yellow`, `green`, `blue`, `purple`, `pink`, `red`. |

| Type | Stored in a project as | Example |
| --- | --- | --- |
| `text` | string | `summary: Nightly settlement match` |
| `number` | number | `estimate: 12` |
| `select` | one of the option values | `priority: High` |
| `multi_select` | list of option values | `systems: [ITSM, CRM]` |
| `people` | list of names (a single string from older files is treated as one name) | `owner: [Alex, Sam]` |
| `date` | `YYYY-MM-DD` | `due: 2026-11-20` |
| `checkbox` | `true` (the key is left out when unchecked) | `reviewed: true` |
| `url` | string | `link: https://example.com/runbook` |

Things worth knowing when you change a property:

- **Renaming the `name`** only changes the label. **Changing the `key`** orphans the existing values, because project files still use the old key; rename the key in the files too (find and replace) if you need to.
- **Removing a property** hides it but leaves its values in the project files, so adding the same `key` back brings them back.
- **Changing the `type`** doesn't rewrite any files. Values stay as they were and are interpreted as the new type (for example, switching `text` to `people` turns `owner: Cade` into one name).
- **Select options** are matched by their `value` text. Renaming or removing an option leaves the old value in projects that used it; it still displays, just without its color.
- Saving from the app rewrites the file from scratch, so **YAML comments and custom formatting are lost**. If you keep notes in the file, edit by hand only, or keep them in a project page instead.

**Groups**

| Field | Rules |
| --- | --- |
| `id` | Same format as a column `id`, unique. Stored in each project as `group`, so don't change it once projects use it. |
| `name` | The label shown on the project, the card and the list view, up to 80 characters. |
| `members` | Names, as they appear in owner fields. Duplicates (ignoring case) are dropped. |

- Removing a group leaves its projects without one; the old id stays in their files until the project is next given a group.
- Owners are still stored as plain names. Removing someone from a group, or renaming them, doesn't change projects they already own.

### Project files

Each project is a markdown file with YAML frontmatter. The properties from `workspace.yaml` sit alongside the built-in fields:

```markdown
---
title: Website Redesign
status: in-progress          # a column id from workspace.yaml
group: it-integrations       # optional; a group id from workspace.yaml
repos:                       # optional; the GitHub repositories for this project's issues
  - https://github.com/acme/website
order: 0                     # position within the column
blocked: true                # optional; shows a red outline on the card
blockedReason: Waiting on design sign-off
subtasks:                    # shown as "Tasks" in the app
  - text: Draft wireframes
    done: true
    doneAt: 2026-10-01T12:00:00.000Z   # set when checked off; feeds the History section
    owners: [Sam]            # optional, any number per task
    doc: wireframe-notes     # optional; the page in this folder written for this task
    issue: https://github.com/acme/website/issues/12   # optional; the GitHub issue linked to this task
updates:                     # status updates, oldest first
  - id: a1b2c3d4
    at: 2026-10-02T15:00:00.000Z
    author: Sam              # optional
    text: Wireframes reviewed, moving to visual design.
priority: High               # global properties are flat frontmatter keys
owner:                       # a "people" property: any number of names
  - Cade
  - Sam
---

## Goals
...
```

The folder can be opened as an Obsidian vault, edited by hand, backed up, or put in git. Edits made outside the app show up on the next refresh (the board also re-polls every 10 seconds).

### Shared editing

Property, status and task changes save immediately. Each property and the status merge per field; the task list is saved as a whole, so if two people edit the tasks of the same project at the same moment, the later save wins, and that covers which doc each task links to. Status updates are appended, so simultaneous posts are all kept. Page bodies autosave after a short pause; if someone else saved the same page in the meantime, the editor shows a banner to load their version or overwrite with yours instead of silently clobbering it.

## Features

- **Filters** (board and list view): **+ Filter** adds a filter on status, group, person (owns the project or one of its tasks), flags (blocked / in maintenance), or any select, multi-select, people, checkbox or date property. Each filter is a chip with a checkbox per value and a count of matching projects; checking several values in one filter shows projects with any of them, and separate filters must all match. A status filter on the board hides the other columns. Filters are shared by both views and remembered in the browser.
- **List view**: every project in a sortable table (status, group, blocked + reason, each property, task progress, last updated) with each project's tasks (with owners) listed beneath it. **Columns** picks which columns show and whether to list tasks, finished tasks and task owners, so a report can be trimmed for management; the choice is remembered in the browser. **Export CSV** downloads exactly what is shown (opens in Excel/Sheets); with tasks on, there is one row per task that repeats the project columns, so it can be filtered or pivoted. **Print / PDF** gives a clean light-themed report of the same, with a line saying which filters were applied.
- **Board view**: columns are statuses; drag cards between and within columns (with filters on, a dropped card lands next to the visible card it was dropped by); search titles and filter as above; card shows properties and task progress.
- **Project pages**: an overview plus any number of sub-pages from the sidebar, in two sections: **Wiki** for the project's general docs and **Task notes** for pages written for a specific task. On a phone these are two rows of chips on the Docs tab.
- **Task notes**: **📝 Add notes** on a task creates a page named after it and opens it. A task has one page of notes at most, so the button then becomes a **📝 Notes** link to it, and the page says which task it belongs to. The link is the `doc` field on the task, so it survives rewording, reordering and checking off. Deleting a task keeps its notes, which move to the Wiki section; deleting the notes frees the task to have new ones.
- **Editor** ([Milkdown Crepe](https://milkdown.dev)): live markdown, `/` menu for headings, lists, task lists, tables, quotes, code blocks (syntax highlighting, language picker, copy button), images and math.
- **Status updates**: a comment-style timeline on each project (`updates` in the frontmatter, newest first, with an optional name). The latest update shows on the board card and in the list view and CSV.
- **Blocked**: tick Blocked on a project to outline its card in red; an optional reason shows on the card (`blocked` / `blockedReason` in the frontmatter).
- **Maintenance**: a project in the **Live** column is in maintenance whenever it has an open task, and its card is outlined in yellow. There is nothing to tick: adding a task to a live project puts it into maintenance, and checking off the last one takes it out again. The reason shows next to the flag — the task's own text, or `3 tasks open` once there is more than one — on the card, the project page, the list view and the CSV. A project that is both blocked and in maintenance gets a yellow outline with a red one around it. Maintenance is worked out from the tasks rather than stored, so it is never in the frontmatter, and a `maintenance:` line left by an older version is ignored and dropped the next time the project is saved.
- **Groups**: define teams and their people under Configuration. Pick a project's group when creating it on the board (the last one you used is preselected) or on the project page. Owner fields on the project and its tasks then open a dropdown of that group's members; other people show up as you type, and any other name can still be typed in. The group shows on the card and as a column in the list view and CSV.
- **Tasks**: add from the box under the list with Enter or **Add** (always shown on a phone), check off, edit inline, drag to reorder (a blue line shows where the task will land), assign multiple owners. Checked-off tasks move to a collapsed History section. (They are stored under the `subtasks` frontmatter key.) **📅 Schedule** books time to work on one: it offers Google Calendar and Outlook on the web, which open a pre-filled draft, or a `.ics` download for desktop Outlook, Apple Calendar and the rest. The block starts as an hour at 9am tomorrow and is meant to be dragged to a free slot in the calendar itself, where the day's conflicts are visible. Nothing is saved in Clique, so it never claims to know what your calendar actually holds.
- **GitHub issues**: give a project one or more **GitHub repos** and each open task gets **🔗 Issue**. **Create on GitHub** opens GitHub's new-issue form in a new tab with the task filled in; with several repos there's one **Create in owner/repo** link for each. Submit the form there, then paste its link or number back into Clique to link it; with several repos, a number also asks which repo it's in. An existing issue is linked the same way, as long as it's in one of the project's repos. The task then shows the issue number as a link, with the repo's name in front when the project has several (`website#12`), and **×** unlinks it. Removing a repo leaves its linked issues in place. A project file with the older single `repo:` line keeps working, and is rewritten as `repos:` the next time its repos change. Clique holds no GitHub login, so issues are created under each person's own account, and it doesn't read an issue's state: closing one doesn't check off the task.
- **Global properties** (Configuration screen): text, number, select, multi-select, people (multiple owners), date, checkbox, URL. Select options have colours. Each property's key is fixed at creation since it is the frontmatter key in every file; renaming only changes its label.
- **Import from Microsoft Planner**: turn a Planner plan into projects, one per task. See below.
- **Stats** (top bar; under **More** on a phone): two sections on one page. *Portfolio* is the management summary — active and live counts, go-lives in the last 90 days, typical time from created to go-live, where the work sits by column, each group's portfolio by column, and created vs went-live by month. *Day to day* is the operational side — projects that are blocked, past their go-live date or untouched for 30 days; what each person is carrying; and recent activity. Every chart has a **Show the numbers** table under it, and the page prints as a light-themed report. History comes from `events.ndjson`; the snapshot comes from the project files.
- **Phones**: at 760px wide or less, and on a phone held sideways, Clique switches to a touch layout. The top bar becomes bottom tabs for Board, List, Workday and More, with Stats, Configuration, Import, Help and the theme under **More**. The board shows one stage at a time: swipe or tap a stage name, and a dot marks stages with a blocked project. Browsers on phones don't start a drag from a touch, so a card's **⋯** button moves it to another stage or up and down within one, and tasks are dragged by their **⋮⋮** handle, which follows a finger and scrolls the page near the top and bottom of the screen. A project opens to tabs for Tasks, Updates, Docs and Details; a project in Live opens on Docs. Docs start read-only behind **Edit page**, so a tap while scrolling a runbook doesn't bring up the keyboard. The list view shows rows with a sort picker instead of the table, and leaves out Columns and Print / PDF. Desktop is unchanged, and so is a tablet in portrait, which is wider than 760px.
- **Workday** (top bar; a bottom tab on a phone): pick a person to see their open tasks from every project in one list, for planning a day, with each task's project and column and the same **📅 Schedule**, **📝 Add notes** and **🔗 Issue** buttons as on the project page. Notes are saved under the task's project and issues use that project's repos, and events and new issues link back to the project. Finished tasks are collapsed under **Done**, with links to any notes or issue they have. If a project is blocked, its open tasks carry a **Potential blocker** label with the reason, because a blocked project doesn't always mean a blocked task. Only tasks the person owns are listed, not unassigned tasks on projects they own, and retired projects in the Graveyard are left out. Each change starts from the project as it is now, so it doesn't undo an edit made since the page last refreshed. If the task has been reworded or removed, or another on that project has the same text, Clique says so and changes nothing. The page can't edit, check off or reassign tasks. It follows the link (`#/workday/Sam`), and a bare `#/workday` opens on the person last picked in that browser.
- **Help page** (top bar): explains what Clique is for and what each board column means, using the board's own column and property names, so new team members can find their way around.

## Importing from Microsoft Planner

Planner can't send data to other apps directly, but it can export a plan to an Excel workbook, which Clique reads. Each Planner task becomes a Clique project.

**1. Export from Planner**

1. Open the plan in Planner (in Teams, or at [planner.cloud.microsoft](https://planner.cloud.microsoft)).
2. Select **…** next to the plan name at the top, then **Export plan to Excel**. (In older versions of Planner the menu is the **…** to the right of the plan's tabs.)
3. The `.xlsx` file downloads to your Downloads folder. Upload it as it is: there's no need to open it, and don't save it as CSV.

Export one plan at a time. Planner has no export for "all my plans" or "my tasks". If you don't see **Export plan to Excel**, your organisation may be on a Planner version or plan type that doesn't offer it yet; Microsoft is still rolling the option out in the new Planner.

**2. Import into Clique**

1. Open **Import** in the top bar and choose the file. Nothing is saved yet: Clique shows the plan's tasks and buckets.
2. Choose a board column for each bucket, or **Don't import** to leave it out. A bucket named like a column (e.g. "In progress") starts on that column, a bucket whose tasks are all completed starts on **Live**, and the rest start on **Backlog**.
3. Select **Import N projects**.

What goes where:

| Planner | Clique |
| --- | --- |
| Task name | Project title |
| Description | The project's page |
| Checklist | Tasks. A full count (e.g. 3/3 completed) checks them all off; with a partial count Planner doesn't say *which* items are done, so they import unchecked. |
| Assigned to | The `owner` people property (or the first people property) |
| Due date | The `due` date property (or the first date property) |
| Priority | The `priority` select property: Urgent → Urgent/Critical/High, Important → Important/High, Medium → Medium/Normal, Low → Low, using the first option that exists |
| Bucket, progress, labels, start date, created by, task ID | A short "Imported from Microsoft Planner" list at the end of the page (plus due date, assignees or priority when the workspace has no property for them) |

Notes:

- Comments, attachments and task history aren't in Planner's export, so they can't be imported.
- Dates are read in the format Planner writes them, which follows the exporting person's language settings. `11/30/2026` is read as month/day; a date whose first number is over 12 (e.g. `30/11/2026`) is read as day/month. If you export with day/month settings, check the dates of early-month tasks after importing.
- Importing the same plan twice creates the projects again (with `-2` added to their ids), so delete the first set or leave the buckets you've already imported out.
- Columns are matched by their header names, not their positions, so exports from both the classic and the new Planner work.

## Deploying

### Before you deploy anywhere

- **There is no login.** Anyone who can reach the site can read and edit everything. Keep it on an internal network, behind a VPN, or put authentication in front of it (each section below says how). Don't expose it to the public internet as-is.
- **It is a single process with files on disk.** Run exactly one instance, and keep `DATA_DIR` on storage that survives restarts and redeploys. Don't scale it out behind a load balancer.
- **Build first.** The server serves the built `dist/` folder. Run `npm run build` (this needs the dev dependencies, so use `npm ci`, not `npm ci --omit=dev`, on the machine that builds). To run without build tools on the server, build elsewhere, copy `dist/` over, and run `npm ci --omit=dev` there.

Environment variables the server reads:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3001` | Port to listen on. Under IIS the port comes from `HTTP_PLATFORM_PORT` instead, which IIS sets for you. |
| `DATA_DIR` | `./data` | Where `workspace.yaml` and `projects/` live. A relative path is resolved from the app folder. Use an absolute path in production so redeploys never touch your data. |
| `BASE_PATH` | empty | Set to `/clique` if the app is served from a sub-path instead of the site root. |

### Windows Server with IIS

`web.config` is set up for [HttpPlatformHandler](https://www.iis.net/downloads/microsoft/httpplatformhandler), which makes IIS start Node, restart it if it crashes, and forward requests to it. Every request goes to Node, so IIS never serves files from the repo folder directly.

These steps assume Windows Server 2019 or later, a site folder of `C:\inetpub\clique`, data in `D:\clique-data`, and a DNS name such as `clique.yourcompany.local` pointing at the server. Run PowerShell as Administrator.

**1. Install the prerequisites**

```powershell
# IIS, Application Initialization (warm start after reboot) and Windows Authentication (step 6)
Install-WindowsFeature Web-Server, Web-Mgmt-Console, Web-AppInit, Web-Windows-Auth
```

- Install the **Node.js 22 LTS** 64-bit MSI from nodejs.org (default path `C:\Program Files\nodejs`).
- Install **HttpPlatformHandler 1.2** (64-bit) from the IIS downloads page linked above.
- Install **git** if you want to deploy with `git pull`.

Open a new PowerShell window afterwards so `node` and `npm` are on the PATH, then check `node -v` (20.19 or newer).

**2. Get the code and build it**

```powershell
git clone https://github.com/<your-org>/<your-repo>.git C:\inetpub\clique
cd C:\inetpub\clique
npm ci
npm run build
```

`npm ci` downloads packages from registry.npmjs.org. If the server reaches the internet through a proxy, set it first (`npm config set proxy http://proxy:8080` and `npm config set https-proxy http://proxy:8080`). If the server has no internet access at all, build on any machine that does: run `npm ci`, `npm run build`, then `npm ci --omit=dev`, and copy `dist\`, `server\`, `logs\`, `node_modules\`, `web.config`, `package.json` and `package-lock.json` to `C:\inetpub\clique`. After `--omit=dev` the only packages left (Express and yaml) are plain JavaScript, so a copy built on macOS or Linux runs fine on Windows. Just don't run `npm run build` on the server from that copy.

**3. Put the data somewhere safe**

Keep the data outside the site folder so redeploys can't overwrite it, and set `DATA_DIR` in `web.config` to that absolute path:

```xml
<environmentVariable name="DATA_DIR" value="D:\clique-data" />
```

Then pick how your board starts:

```powershell
New-Item -ItemType Directory -Force D:\clique-data | Out-Null

# a) Start from the example board (credit union integrations), then delete the example cards in the app:
Copy-Item -Recurse C:\inetpub\clique\data\* D:\clique-data\

# b) Keep the example columns and properties (Systems, Go-live, ...) but start with no projects:
Copy-Item C:\inetpub\clique\data\workspace.yaml D:\clique-data\

# c) Copy nothing: Clique creates default columns, three properties and a welcome project on first start.
```

If `processPath` in `web.config` doesn't match where `node.exe` is installed, fix that too.

**4. Create the app pool and site**

```powershell
Import-Module WebAdministration

New-WebAppPool -Name Clique
Set-ItemProperty IIS:\AppPools\Clique -Name managedRuntimeVersion -Value ''          # No Managed Code
Set-ItemProperty IIS:\AppPools\Clique -Name startMode -Value AlwaysRunning           # start with Windows
Set-ItemProperty IIS:\AppPools\Clique -Name processModel.idleTimeout -Value ([TimeSpan]::Zero)  # never go idle
Set-ItemProperty IIS:\AppPools\Clique -Name recycling.disallowOverlappingRotation -Value $true   # one Node at a time
Set-ItemProperty IIS:\AppPools\Clique -Name recycling.periodicRestart.time -Value ([TimeSpan]::Zero)  # no daily recycle

New-Website -Name Clique -PhysicalPath C:\inetpub\clique -ApplicationPool Clique -Port 80 -HostHeader clique.yourcompany.local
Set-ItemProperty IIS:\Sites\Clique -Name applicationDefaults.preloadEnabled -Value $true
```

- **Port 80 is already taken** by the *Default Web Site* on a fresh IIS install, which is why the site above uses a host name. If you'd rather give Clique the whole server, stop that site instead (`Stop-Website 'Default Web Site'` and `Set-ItemProperty 'IIS:\Sites\Default Web Site' serverAutoStart $false`) and leave out `-HostHeader`.
- **Overlapping recycle is turned off on purpose.** By default IIS starts a new worker before the old one stops, which would briefly run two Node processes against the same files. With it off, a recycle means a second or two of downtime instead (the editor retries saves).
- For HTTPS, add a binding (`New-WebBinding -Name Clique -Protocol https -Port 443 -HostHeader clique.yourcompany.local -SslFlags 1`) and attach your certificate in IIS Manager → **Bindings**.

**5. Give the app pool access to the files**

The app pool runs as the virtual account `IIS AppPool\Clique`. It needs to read the site and write the data and logs:

```powershell
icacls C:\inetpub\clique /grant "IIS AppPool\Clique:(OI)(CI)RX" /T
icacls C:\inetpub\clique\logs /grant "IIS AppPool\Clique:(OI)(CI)M"
icacls D:\clique-data /grant "IIS AppPool\Clique:(OI)(CI)M" /T
```

**6. Let in only your domain users**

Clique has no login of its own, so let IIS check who people are. Turning off anonymous access and turning on Windows Authentication means only signed-in domain accounts can open the site:

```powershell
Set-WebConfigurationProperty -PSPath IIS:\ -Location Clique -Filter system.webServer/security/authentication/anonymousAuthentication -Name enabled -Value $false
Set-WebConfigurationProperty -PSPath IIS:\ -Location Clique -Filter system.webServer/security/authentication/windowsAuthentication -Name enabled -Value $true
```

Browsers sign people in silently when the site is in the *Local intranet* zone (a single-label name like `http://clique/`, or a host added to that zone by group policy). Otherwise they see a sign-in prompt and can use their domain account. To limit it to one team, add an **Authorization Rules** entry in IIS Manager that allows only that AD group.

**7. Check it works**

Browse to the site. If it doesn't load:

| What you see | Usual cause |
| --- | --- |
| HTTP 500.19 | HttpPlatformHandler isn't installed, so IIS doesn't understand `web.config`. |
| HTTP 502.3 or 502.5 | Node didn't start. Read the newest `C:\inetpub\clique\logs\node.log*` file. |
| `node.log` says *could not open its data folder* | Wrong `DATA_DIR`, or the app pool has no modify rights on it (step 5). |
| `node.log` says *Cannot find module ...\server\index.js* | Node started in a different folder. Set `arguments="C:\inetpub\clique\server\index.js"` in `web.config`. |
| A blank page | `npm run build` wasn't run, so `dist\` is missing. |
| "The server cannot write to its data folder" in the app | Permissions on `D:\clique-data` (step 5). |

You can also run `node server\index.js` by hand in the site folder to see startup errors directly (it listens on port 3001).

**8. Make it start on reboot**

The site comes back by itself after a reboot either way: IIS starts with Windows (the World Wide Web Publishing Service is Automatic), and HttpPlatformHandler launches Node on the first request. Step 4 also makes Node start straight away, so nobody waits on the first visit, and keeps it running:

1. App pool **Start Mode = AlwaysRunning**, so the worker process starts with IIS instead of on the first request.
2. Site **Preload Enabled = true**, so IIS sends a warm-up request that launches Node. This needs the **Application Initialization** feature from step 1.
3. App pool **Idle Time-out = 0**, so IIS doesn't shut Node down after 20 idle minutes.

To confirm, restart the server and open the site from your PC without logging on to the server. Keep the app pool's **Rapid-Fail Protection** at its defaults so IIS restarts a crashing app.

With Windows Authentication on (step 6), IIS's warm-up request is anonymous and gets refused, so Node starts on the first real visit instead. That is expected: the first visit after a reboot just takes a second longer. If you check with `Get-Process node` straight after a reboot, it may not be running until someone opens the site.

**Updating later**

```powershell
cd C:\inetpub\clique
Stop-WebAppPool Clique
git pull
npm ci
npm run build
Start-WebAppPool Clique
```

The site is down for the minute this takes. Your data in `D:\clique-data` is untouched. Your `DATA_DIR` edit to `web.config` is a local change that `git pull` keeps; if a pull ever stops because `web.config` also changed in the repo, run `git stash`, `git pull`, `git stash pop` and check the file.

**Backups.** Include `D:\clique-data` in your normal server backup, or commit it to a private git repo on a schedule. Deleted projects and pages are moved to `D:\clique-data\.trash` rather than erased, so you can restore them by moving the folder back into `projects\`.

**Alternative: run Node as a Windows service**

If you'd rather not depend on IIS to launch Node, run Clique as its own service with [NSSM](https://nssm.cc) and let IIS (or nothing) forward to it. The service starts at boot, and Windows restarts it if it exits.

```powershell
nssm install Clique "C:\Program Files\nodejs\node.exe" server\index.js
nssm set Clique AppDirectory C:\inetpub\clique
nssm set Clique AppEnvironmentExtra NODE_ENV=production PORT=3001 DATA_DIR=D:\clique-data
nssm set Clique Start SERVICE_AUTO_START
nssm set Clique AppStdout C:\inetpub\clique\logs\node.log
nssm set Clique AppStderr C:\inetpub\clique\logs\node.log
nssm start Clique
```

Run it as a low-privilege account with modify rights on `D:\clique-data` (`nssm set Clique ObjectName ...`) rather than LocalSystem. To publish it through IIS, install **URL Rewrite** and **Application Request Routing** (enable the proxy in ARR), replace the `httpPlatform` handler in `web.config` with a rule that proxies to `http://localhost:3001/{R:1}`, and host it at the site root (not a virtual directory). Or skip IIS and let people use `http://servername:3001` behind the Windows firewall, but then there is no sign-in at all.

**Recording who made changes (later)**

Step 6 controls who can get in, but Clique doesn't yet know who each person is: status updates use the name people type. The plan is to pass the signed-in Windows user name from IIS to Node (for example `forwardWindowsAuthToken`, or an IIS URL Rewrite server variable such as `X-Remote-User` = `{LOGON_USER}`) so updates and edits can be attributed automatically. The storage format does not depend on the backend, so moving the API to ASP.NET Core later is also an option if tighter Windows auth integration is wanted.

### Linux server (DigitalOcean Droplet or any VPS)

This works the same on a DigitalOcean Droplet, Linode, Hetzner, Lightsail or any Ubuntu/Debian VM. The recipe: Node running under **systemd** (starts on boot, restarts on crash) behind **Caddy**, which handles HTTPS and basic password protection.

**1. Create the server.** Ubuntu 24.04, the smallest size is plenty (1 vCPU, 1 GB). Add your SSH key. Point a DNS name (for example `clique.example.com`) at its IP.

**2. Install Node, Caddy and git**

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git
# Caddy: use the official apt repository from caddyserver.com/docs/install (the Ubuntu package is old)
sudo apt-get install -y caddy
```

**3. Create a user and get the code**

```bash
sudo useradd --system --create-home --home-dir /opt/clique --shell /usr/sbin/nologin clique
sudo -u clique git clone https://github.com/<your-org>/<your-repo>.git /opt/clique/app
cd /opt/clique/app
sudo -u clique npm ci
sudo -u clique npm run build
sudo mkdir -p /var/lib/clique && sudo cp -r data/* /var/lib/clique/
sudo chown -R clique:clique /var/lib/clique
```

**4. Run it with systemd.** Create `/etc/systemd/system/clique.service`:

```ini
[Unit]
Description=Clique
After=network.target

[Service]
User=clique
WorkingDirectory=/opt/clique/app
Environment=NODE_ENV=production
Environment=PORT=3001
Environment=DATA_DIR=/var/lib/clique
ExecStart=/usr/bin/node server/index.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now clique     # enable = start on every boot
systemctl status clique                # logs: journalctl -u clique -f
```

**5. Add HTTPS and a password with Caddy.** Create a hashed password with `caddy hash-password`, then edit `/etc/caddy/Caddyfile`:

```
clique.example.com {
    basic_auth {
        team <paste-the-hash-here>
    }
    reverse_proxy localhost:3001
}
```

```bash
sudo systemctl reload caddy
```

(On Caddy older than 2.8 the directive is spelled `basicauth`.) Caddy gets and renews a Let's Encrypt certificate automatically. Basic auth is a shared password, which is fine for a small team; for real per-user sign-in, put the server on a VPN (Tailscale or WireGuard) instead and don't expose it publicly at all.

**6. Lock down the firewall.** Only SSH and web traffic should be reachable; port 3001 must stay private:

```bash
sudo ufw allow OpenSSH && sudo ufw allow 80,443/tcp && sudo ufw enable
```

On DigitalOcean you can also use a Cloud Firewall with the same rules.

**Updating:** `cd /opt/clique/app && sudo -u clique git pull && sudo -u clique npm ci && sudo -u clique npm run build && sudo systemctl restart clique`.

**Backups:** turn on Droplet backups or snapshots, and also copy `/var/lib/clique` somewhere else (a cron `rsync`, or commit it to a private git repo).

### DigitalOcean Droplet with GitHub Actions and Docker (CI/CD)

The section above runs Clique straight on the machine with systemd. This one is the automated
version used for `cade-gray/clique`: GitHub Actions builds a Docker image, pushes it to GHCR,
and the droplet pulls it. A push to `main` ships; nothing is built on the server. It follows
the house rules in [droplet-deployment-standards](https://github.com/cade-gray/droplet-deployment-standards),
and it is additive — **IIS hosting is untouched**, `web.config` still runs Node directly and
knows nothing about Docker.

What the deploy does, in order: build `linux/amd64` and push `:latest` plus the commit SHA to
GHCR, copy `compose.prod.yaml` to `/srv/clique`, `docker compose pull`, `up -d`, then curl
`/health` every 3 s for up to 60 s and fail the run (printing the last 50 log lines) if it
never answers. It never runs `down`, so the board stays up while the new container starts.

Settings for this repo:

| Thing | Value |
| --- | --- |
| Image | `ghcr.io/cade-gray/clique:latest` and `:<commit sha>` |
| Host port → container port | `127.0.0.1:3007` → `3000` |
| Folder on the droplet | `/srv/clique` (compose file, `.env`) |
| Board data | `/srv/clique/data`, bind-mounted at `/data` |
| Domain | `clique.cadegray.dev` (Caddy reverse-proxies to `localhost:3007`) |
| Health check | `GET /health` → `200 {"status":"ok"}` once the data folder is readable |

Files this adds: `Dockerfile` (Node 24 Alpine, three stages, runs as the non-root `node`
user), `.dockerignore`, `compose.yaml` (run the image locally), `compose.prod.yaml` (what the
droplet runs), `.env.example`, `.github/workflows/ci.yml`, `.github/workflows/deploy.yml` and
`.github/dependabot.yml`.

Two things are worth knowing before copying this for another app:

- **The data folder is a volume, and the image deliberately has no `data/`.** The example
  board in the repo is not copied into the image, so a deploy can never overwrite the real
  one. The first container on an empty folder creates default columns and a welcome project;
  seed it yourself instead if you want the example board or an existing one (below).
- **CI runs `npm run build` and `npm test`, not `npm run lint`.** Clique is plain JSX with no
  linter or TypeScript, so there is no lint or typecheck step to run; the Docker build in CI
  is what catches a broken image.

**1. Set up GitHub**

Three repo secrets, plus a fourth if SSH is not on port 22. Run these from a clone of the repo:

```bash
gh secret set VPS_HOST    --body "<droplet ip or hostname>"
gh secret set VPS_USER    --body "deploy"
gh secret set VPS_SSH_KEY < ~/.ssh/droplet_deploy      # the private key, not the .pub
gh secret set VPS_PORT    --body "2222"                # only if SSH is not on 22
```

- The deploy pushes to GHCR with the built-in `GITHUB_TOKEN` (`packages: write`), so no PAT
  is needed and no write-scoped token is ever stored on the droplet.
- `deploy.yml` uses `environment: production`. Create that environment (Settings →
  Environments) to get a deployment history page; the workflow runs without it too.
- Turn on branch protection for `main` requiring the **CI** check, so a PR cannot merge
  without a green build.
- After the first deploy, set the `clique` package to **public** (package → Package settings →
  Change visibility) so the droplet pulls without logging in to GHCR.

**2. Set up the droplet** (once)

SSH in as **your own account, the one with sudo** — not as `deploy`. The `deploy` user has no
sudo on purpose: its private key sits in a GitHub secret, and membership of the `docker` group
is already root-equivalent, so sudo would only add a second, more obvious way in. `sudo` as
`deploy` is meant to fail with "user deploy is not allowed to execute ...".

```bash
# Docker Engine and the compose plugin, from the official Docker apt repository
# (docs.docker.com/engine/install/ubuntu). Then make sure it comes back after a reboot:
sudo systemctl enable docker

# A deploy user whose only privilege is Docker. Treat its key as root-equivalent.
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG docker deploy
sudo install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
# Paste the public half of the key you put in VPS_SSH_KEY:
sudo -u deploy tee -a /home/deploy/.ssh/authorized_keys < ~/droplet_deploy.pub
sudo chmod 600 /home/deploy/.ssh/authorized_keys
```

Then the app's two folders. `install -d` is `mkdir -p` plus ownership in one step, and the two
owners are deliberately different:

```bash
# /srv/clique belongs to deploy, which is what the workflow's scp step writes
# compose.prod.yaml as. Owned by anyone else, the deploy fails on the copy.
sudo install -d -o deploy -g deploy /srv/clique

# The data folder belongs to uid 1000: the node user inside the container, not a droplet
# account. Only the container writes here, so this stays 1000 even if deploy isn't uid 1000.
sudo install -d -o 1000 -g 1000 /srv/clique/data
```

`/srv/clique/.env` is the only thing that runs on the droplet and is not in git. Clique has no
secrets of its own (no database, no login), so it holds configuration only. `docker compose`
reads it as `deploy`, so `deploy` has to own it:

```bash
sudo tee /srv/clique/.env >/dev/null <<'EOF'
NODE_ENV=production
PORT=3000
DATA_DIR=/data
BASE_PATH=
TAG=latest
EOF
sudo chown deploy:deploy /srv/clique/.env
sudo chmod 600 /srv/clique/.env

# Check it: /srv/clique owned by deploy's uid, data by 1000.
ls -ln /srv/clique && id -u deploy
```

To start from an existing board rather than a fresh one, copy it in before the first deploy —
`workspace.yaml`, `projects/` and, if you want the delivery history, `events.ndjson`. Stage it
somewhere your own account can write, since `/srv/clique/data` belongs to uid 1000:

```bash
# from your machine, as your own (sudo) account
ssh <you>@<droplet> 'mkdir -p /tmp/clique-seed'
scp -r data/workspace.yaml data/projects <you>@<droplet>:/tmp/clique-seed/

# then on the droplet
sudo cp -r /tmp/clique-seed/. /srv/clique/data/
sudo chown -R 1000:1000 /srv/clique/data
rm -rf /tmp/clique-seed
```

**3. DNS and Caddy**

Point an A record for `clique.cadegray.dev` at the droplet, then add the site block to
`/etc/caddy/Caddyfile`. **Clique has no login, so put a password in front of it** — anyone who
can reach the site can edit every project. Generate the hash with `caddy hash-password`:

```caddy
clique.cadegray.dev {
    basic_auth {
        team <paste-the-hash-here>
    }
    reverse_proxy localhost:3007
    encode zstd gzip
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
    }
}
```

```bash
sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy
```

(On Caddy older than 2.8 the directive is spelled `basicauth`.) The container publishes its
port on `127.0.0.1:3007`, not `0.0.0.0`: Docker writes its own iptables rules, so a wildcard
port would be reachable over plain HTTP from the internet, around both Caddy and ufw. For real
per-user sign-in, keep the droplet off the public internet and reach it over Tailscale or
WireGuard instead.

**4. First deploy**

Run **Actions → Deploy → Run workflow** (`workflow_dispatch`) and watch the health check pass,
then make the GHCR package public. After that, every push to `main` deploys on its own.

**Rolling back.** Every deploy tags the image with its commit SHA, so on the droplet:

```bash
cd /srv/clique
TAG=<good-sha> docker compose -f compose.prod.yaml up -d      # back on a known-good build
```

That is a stopgap: `git revert` the bad commit and merge it, so the next deploy moves `latest`
back and a later plain `up -d` doesn't bring the bad build back.

**Day-to-day commands** on the droplet, all from `/srv/clique`, as `deploy` (any other
account needs to be in the `docker` group, or to prefix these with `sudo`):

```bash
docker compose -f compose.prod.yaml ps          # is it up, is it healthy
docker compose -f compose.prod.yaml logs -f     # follow the app log (10 MB x 3 rotation)
docker compose -f compose.prod.yaml restart
```

**Backups.** The image is disposable; `/srv/clique/data` is not, and `events.ndjson` in it
cannot be rebuilt from the markdown. Turn on Droplet backups and copy that folder off the box
as well (an `rsync` or `restic` cron job, or a commit into a private git repo).

### Azure

**App Service (Linux)** is the simplest managed option. The key point is where the data lives: on Linux App Service, the `/home` folder is persistent storage that survives restarts and deployments, so put `DATA_DIR` there. Everything else on the disk is replaced on each deploy.

```bash
az group create -n clique-rg -l eastus
az appservice plan create -g clique-rg -n clique-plan --is-linux --sku B1
az webapp create -g clique-rg -p clique-plan -n <unique-app-name> --runtime "NODE:22-lts"

az webapp config appsettings set -g clique-rg -n <unique-app-name> --settings \
  DATA_DIR=/home/clique-data NODE_ENV=production SCM_DO_BUILD_DURING_DEPLOYMENT=false
az webapp config set -g clique-rg -n <unique-app-name> --startup-file "npm start"
```

Build locally, then deploy a zip that contains `dist/`, `server/`, `package.json`, the lockfile and production `node_modules` (so the server does not need to build anything):

```bash
npm ci && npm run build && npm ci --omit=dev
zip -r clique.zip dist server package.json package-lock.json node_modules
az webapp deploy -g clique-rg -n <unique-app-name> --src-path clique.zip --type zip
```

Seed the data once by uploading `workspace.yaml` and `projects/` into `/home/clique-data` (for example with the Kudu file browser at `https://<app>.scm.azurewebsites.net`, or `az webapp ssh`). The app also creates a fresh workspace on its own if the folder is empty. App Service gives Node a `PORT` setting automatically, which the server reads; if you see a 503, set `WEBSITES_PORT` to match.

- **Sign-in:** turn on **App Service Authentication** (Settings → Authentication) with Microsoft Entra ID and set it to *Require authentication*. Only your organisation's users get in, with no code changes.
- **One instance only:** leave the plan scaled to one instance (don't enable autoscale or deployment slot swaps that would run two copies against the same files).
- **Backups:** App Service backups can include `/home`, or copy `/home/clique-data` to Blob Storage on a schedule.

**Azure VM:** create an Ubuntu VM and follow the [Linux server](#linux-server-digitalocean-droplet-or-any-vps) steps. Restrict the network security group to your office IP or VPN rather than opening 80/443 to the world, and use managed disk snapshots for backups.

### AWS

**EC2 or Lightsail** is the simplest fit because Clique needs a normal disk. Launch an Ubuntu instance (Lightsail's smallest plan is enough) and follow the [Linux server](#linux-server-digitalocean-droplet-or-any-vps) steps.

- **Security group:** allow 22 and 443/80 only from your office IP or VPN, not `0.0.0.0/0`. Never open 3001.
- **Data:** keep `DATA_DIR` on the instance's EBS volume (or a separate EBS volume mounted at `/var/lib/clique`) and schedule EBS snapshots with Amazon Data Lifecycle Manager. Lightsail has built-in snapshots.
- **HTTPS and sign-in:** the Caddy setup above works as is. For per-user sign-in, put an **Application Load Balancer** in front with OIDC or **Cognito** authentication on the listener rule, and only allow the load balancer to reach the instance.

Serverless or container services that have no persistent disk (App Runner, Lambda, Fargate without a volume) are **not** a good fit, because the data would be lost whenever the container restarts. If you want containers, use ECS on EC2 or Fargate with an **EFS** volume mounted at `DATA_DIR`, with the service's desired count fixed at 1.

## Code layout

```
server/index.js        Express routes (/api/...) + static hosting of dist/
server/dev.js          what npm run dev runs: seeds data.local/ from data/ (server/localData.js), then starts the server
server/store.js        markdown-on-disk storage, frontmatter, conflict checks
server/events.js       append-only event log (events.ndjson): writes, reads, skips unreadable lines
server/stats.js        pure computeStats(projects, workspace, events) behind GET /api/stats
server/planner.js      Microsoft Planner import: finds the task table in the export and maps tasks to projects
server/xlsx.js         minimal .xlsx reader used by the Planner import (no dependency)
src/App.jsx            hash router and top bar
src/usePhone.js        whether the phone layout applies; keep its query in step with the phone @media rule in styles.css
src/components/        Board, ListView, StatsView, WorkdayView, ProjectView, Subtasks (tasks), TaskLinks (notes and issue buttons), Updates, Settings, ImportView, HelpView, DocBody (autosave), MarkdownEditor (Crepe), calendar.js (Outlook link / .ics)
src/components/PhoneBoard.jsx  the board on a phone: swipeable stages, compact cards, move and new-project sheets
src/components/PhoneNav.jsx    bottom tabs and the More screen
src/components/Sheet.jsx       bottom sheet; Popover opens as one on a phone
src/components/phone.js        pure helpers for card placement and compact cards, with tests in phone.test.js
src/components/pages.js        pure helpers that split a project's pages into wiki pages and task notes, with tests in pages.test.js
src/components/workday.js      pure helpers that collect one person's tasks across projects, with tests in workday.test.js
src/components/tasks.js        pure helpers for dragging tasks into a new order, with tests in tasks.test.js
src/components/listView.js     what the list view shows, including settings saved before the rename, with tests in listView.test.js
src/components/useTouchDrag.js  dragging a task by touch, which browsers don't do natively
src/components/github.js       pure helpers for the new-issue form and linking issues, with tests in github.test.js
src/components/charts.jsx  bars, stacked bars, columns, tiles and meters built from divs (no charting library)
```
