# Clique

A Kanban board of projects where each project opens into Notion-style pages: markdown that renders as you type, code blocks with a copy button, to-dos, and properties defined once for every project.

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

`DATA_DIR` (default `./data`) holds everything. The repo ships with a starter workspace in `data/` with a welcome project plus example projects for a credit union integrations team (each project is a built integration, such as an ITSM ↔ core banking incident sync), so a fresh clone opens to a working board. (If `workspace.yaml` is ever missing, the app recreates the defaults and the welcome project.) The `data/.trash/` folder is git-ignored.

Clique is built for one board shared by one team. To keep your team's real data in git, commit `data/` and use normal pull/push to share it; to keep it out of the repo, point `DATA_DIR` somewhere else.

```
data/
  workspace.yaml                     board columns + global property definitions
  projects/
    website-redesign/
      index.md                       the project: frontmatter + overview page
      meeting-notes.md               an extra page inside the project
      attachments/                   images pasted into the project's pages, linked as attachments/<file>
  .trash/                            deleted projects and pages are moved here, never erased
```

### workspace.yaml

`workspace.yaml` defines the shape of the board: which **columns** exist and which **properties** every project has. There is exactly one per workspace, and it is read fresh on every request, so hand edits show up on the next refresh. You can edit it in the app (**Properties & columns**) or by hand.

```yaml
columns:                  # left to right on the board; also the Status choices
  - id: backlog           # stable id, stored in each project's `status`
    name: Backlog         # the label people see; safe to rename any time
  - id: in-progress
    name: In progress
  - id: live              # projects in production; only these can be flagged as in maintenance
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
```

**Columns**

| Field | Rules |
| --- | --- |
| `id` | Lowercase letters, digits and `-`, up to 80 characters, unique. Stored in each project as `status`, so don't change it once projects use it. |
| `name` | The label shown on the board, up to 80 characters. |

- At least one column is required. The order in the file is the order on the board.
- Every project always has a valid status. New projects start in `backlog` (or the first column if there is no `backlog`). If a column is removed, or a file names a status that doesn't exist, its projects appear in `backlog`; the file is only rewritten the next time the project is saved.
- The `live` column id is special: only projects in it show the **Maintenance** checkbox. Rename its label freely, but keep the id.
- Upgrading from a version before 1.1: on start, a workspace with a `done` column (and no `live` one) has it replaced by **Live**, with **Graveyard** added after it, and every project in `done` is moved to `live`.

**Properties**

| Field | Rules |
| --- | --- |
| `key` | Same format as a column `id`, unique. It becomes a flat key in every project's frontmatter. It can't be one of the built-in keys: `title`, `status`, `order`, `subtasks`, `blocked`, `blockedReason`, `maintenance`, `updates`, `created`, `updated`. |
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

### Project files

Each project is a markdown file with YAML frontmatter. The properties from `workspace.yaml` sit alongside the built-in fields:

```markdown
---
title: Website Redesign
status: in-progress          # a column id from workspace.yaml
order: 0                     # position within the column
blocked: true                # optional; shows a red outline on the card
blockedReason: Waiting on design sign-off
maintenance: true            # optional; yellow outline, only while the project is in the live column
subtasks:                    # shown as "To-dos" in the app
  - text: Draft wireframes
    done: true
    doneAt: 2026-10-01T12:00:00.000Z   # set when checked off; feeds the History section
    owners: [Sam]            # optional, any number per to-do
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

Property, status and to-do changes save immediately. Each property and the status merge per field; the to-do list is saved as a whole, so if two people edit the to-dos of the same project at the same moment, the later save wins. Status updates are appended, so simultaneous posts are all kept. Page bodies autosave after a short pause; if someone else saved the same page in the meantime, the editor shows a banner to load their version or overwrite with yours instead of silently clobbering it.

## Features

- **List view**: every project in a sortable table (status, blocked + reason, each property, to-do progress, last updated) with filters, and each project's to-dos (with owners) listed beneath it (toggle "Show to-dos"). **Export CSV** downloads exactly what is shown (opens in Excel/Sheets); with to-dos on, there is one row per to-do that repeats the project columns, so it can be filtered or pivoted, and **Print / PDF** gives a clean light-themed report for management.
- **Board view**: columns are statuses; drag cards between and within columns; filter by title; card shows properties and to-do progress.
- **Project pages**: an overview plus any number of sub-pages from the sidebar.
- **Editor** ([Milkdown Crepe](https://milkdown.dev)): live markdown, `/` menu for headings, lists, task lists, tables, quotes, code blocks (syntax highlighting, language picker, copy button), images and math.
- **Status updates**: a comment-style timeline on each project (`updates` in the frontmatter, newest first, with an optional name). The latest update shows on the board card and in the list view and CSV.
- **Blocked**: tick Blocked on a project to outline its card in red; an optional reason shows on the card (`blocked` / `blockedReason` in the frontmatter).
- **Maintenance**: projects in the **Live** column have a Maintenance checkbox that outlines the card in yellow (`maintenance` in the frontmatter). A project that is both blocked and in maintenance gets a yellow outline with a red one around it. Moving a project out of Live hides the flag; it comes back if the project returns to Live.
- **To-dos**: check off, edit inline, drag to reorder, assign multiple owners. Checked-off to-dos move to a collapsed History section. (They are stored under the `subtasks` frontmatter key.)
- **Global properties** (Properties & columns screen): text, number, select, multi-select, people (multiple owners), date, checkbox, URL. Select options have colours. Each property's key is fixed at creation since it is the frontmatter key in every file; renaming only changes its label.

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
server/store.js        markdown-on-disk storage, frontmatter, conflict checks
src/App.jsx            hash router and top bar
src/components/        Board, ListView, ProjectView, Subtasks (to-dos), Updates, Settings, DocBody (autosave), MarkdownEditor (Crepe)
```
