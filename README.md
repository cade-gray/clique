# Project Tracker

A Kanban board of projects where each project opens into Notion-style pages: markdown that renders as you type, code blocks with a copy button, subtasks, and properties defined once for every project.

Everything is stored as plain markdown files on disk (Obsidian-style). There is no database and no login yet; everyone who can reach the site edits the same board.

## Run it

Requires Node.js 20.19+ (22 LTS recommended).

```bash
npm install
npm run dev        # API on :3001 and Vite dev server on :5173 with hot reload
```

Production:

```bash
npm run build      # builds the React app into dist/
npm start          # serves dist/ and the API on PORT (default 3001)
npm test           # storage tests
```

## Where the data lives

`DATA_DIR` (default `./data`) holds everything. On first run it creates a workspace and an example project.

```
data/
  workspace.yaml                     board columns + global property definitions
  projects/
    website-redesign/
      index.md                       the project: frontmatter + overview page
      meeting-notes.md               an extra page inside the project
  .trash/                            deleted projects and pages are moved here, never erased
```

A project file looks like this:

```markdown
---
title: Website Redesign
status: in-progress          # a column id from workspace.yaml
order: 0                     # position within the column
subtasks:
  - text: Draft wireframes
    done: true
priority: High               # global properties are flat frontmatter keys
owner: Cade
---

## Goals
...
```

The folder can be opened as an Obsidian vault, edited by hand, backed up, or put in git. Edits made outside the app show up on the next refresh (the board also re-polls every 10 seconds).

### Shared editing

Property, status and subtask changes save immediately and merge per field. Page bodies autosave after a short pause; if someone else saved the same page in the meantime, the editor shows a banner to load their version or overwrite with yours instead of silently clobbering it.

## Features

- **Board**: columns are statuses; drag cards between and within columns; filter by title; card shows properties and subtask progress.
- **Project pages**: an overview plus any number of sub-pages from the sidebar.
- **Editor** ([Milkdown Crepe](https://milkdown.dev)): live markdown, `/` menu for headings, lists, task lists, tables, quotes, code blocks (syntax highlighting, language picker, copy button), images and math.
- **Subtasks**: check off, edit inline, drag to reorder.
- **Global properties** (Properties & columns screen): text, number, select, multi-select, date, checkbox, URL. Select options have colours. Each property's key is fixed at creation since it is the frontmatter key in every file; renaming only changes its label.

## Hosting on IIS

`web.config` is set up for [HttpPlatformHandler](https://www.iis.net/downloads/microsoft/httpplatformhandler), which starts Node and forwards requests to it.

1. Install Node.js and the HttpPlatformHandler module on the server.
2. Copy the repo (with `node_modules` and a built `dist/`) to the site folder, or run `npm ci && npm run build` there.
3. Point an IIS site or application at the folder. Check `processPath` in `web.config` matches where `node.exe` is installed.
4. Give the app pool identity modify rights on the `data` folder (or set `DATA_DIR` to another location) and on `logs`.
5. If the app sits in a virtual directory such as `/tracker`, set `BASE_PATH` to `/tracker` in `web.config`. The frontend uses relative URLs and hash routes, so no URL Rewrite rules are needed.

### Windows authentication (later)

Not wired up yet. The plan is to enable Windows Authentication on the IIS site so only domain users get in, then pass the signed-in user name to Node (for example via an IIS URL Rewrite server variable such as `X-Remote-User` = `{LOGON_USER}`) so pages can record who edited them. The storage format does not depend on the backend, so moving the API to ASP.NET Core later is also an option if tighter Windows auth integration is wanted.

## Code layout

```
server/index.js        Express routes (/api/...) + static hosting of dist/
server/store.js        markdown-on-disk storage, frontmatter, conflict checks
src/App.jsx            hash router and top bar
src/components/        Board, ProjectView, Subtasks, Settings, DocBody (autosave), MarkdownEditor (Crepe)
```
