# Clique for a Small Integration Team

A working guide for 2–3 integration developers building MuleSoft integrations and SQL extracts — and for the IT Manager and Project Manager who need to see what is happening.

*Last reviewed: 2 November 2026.*

## Read this first

Clique gives the integration team one board where every MuleSoft integration and SQL extract lives as a single card, from the request through to retirement — and that same card becomes the solution's documentation once it is live. Nothing is archived away at go-live, because go-live is when support starts.

The process around it is deliberately light. There are no story points, no sprint commitments, no velocity, no burndown. With two or three developers those ceremonies cost more than they return. What the process does ask for is five habits:

1. **One card per solution, and one door in.** Every request becomes a Backlog card. Nothing starts from a hallway conversation or a Teams message.
2. **A status update every week on each card in progress.** One or two sentences, with a name on it.
3. **Tasks sized to a day or less**, each with an owner.
4. **A written gate between stages** — the checklists in *The five stages*, below.
5. **A runbook page before a card reaches Live.** No runbook, no go-live.

**What it costs.** A developer spends roughly 85 minutes a week inside the process: one 30-minute planning session, four 10-minute standups, and 15 minutes of board tidying on Friday. That is about 3% of the week. The Project Manager spends about an hour a week, the IT Manager 30 minutes a month.

**What it buys.** At any moment, without asking anyone, the IT Manager can answer four questions from one screen: what is the team working on, what is late, what is stuck, and what did we deliver this quarter. The Project Manager gets a blocker list and a per-person workload view that are generated rather than collected. The developers get somewhere to write a field mapping down once instead of three times.

**What Clique is not.** It is not an incident queue — production incidents and service requests stay in ITSM. Clique holds *solutions*, not tickets. It is also not access-controlled: there is no login, so it belongs on the internal network only. See *Limits, risks and workarounds*.

## What we keep from agile, and what we drop

Scrum assumes a team of five to nine people building one product with a backlog they control. An integration team of three does none of that: the work arrives from six different business units, each item is small and mostly independent, and a third of the week goes on supporting things that are already live. Running full Scrum on top of that produces accurate ceremonies and inaccurate plans.

So we keep the parts that survive a small team, and drop the parts that only pay off at scale.

| Practice | Keep or drop | Why |
| --- | --- | --- |
| Visible work in one place | **Keep** | The board is the single source of truth. If it is not on the board, it is not happening. |
| Short feedback loop with the requester | **Keep** | Business sign-off is a gate, recorded as a status update with a name and date. |
| A daily standup | **Keep**, 10 minutes | Run off each person's Workday page, not off the board. |
| Work-in-progress limits | **Keep** | The real constraint on a 3-person team. Two projects per developer, five for the team. |
| Small, owned increments | **Keep** | Tasks sized to a day or less. This is our only sizing rule. |
| Definition of done | **Keep**, per stage | The gates in the next section. Written down, so nobody negotiates them per project. |
| Retrospective | **Keep**, informal | A running *Lessons* page, not a meeting. Monthly skim. |
| Story points and velocity | **Drop** | Three people, half-interrupt-driven. The number would be noise, and estimating it costs real hours. |
| Sprint commitment | **Drop** | We cannot honour a two-week commitment when production pages us. The In progress column is the focus list instead. |
| Sprint boundaries and planning poker | **Drop** | Work is pulled when capacity frees up, not batched into iterations. |
| Burndown and burn-up charts | **Drop** | Replaced by go-lives per month and time-to-go-live on the Stats page. |
| Scrum Master, Product Owner roles | **Drop** | The Project Manager covers intake, priority and chasing. See the next section. |
| Epics, sub-tasks, dependency links | **Drop** | Clique has one level: project and task. Dependencies go in a sentence on the card. |

The honest summary: this is a **pull-based Kanban with a weekly cadence and written stage gates**. It borrows agile's visibility and short feedback loop, and borrows nothing from its estimation machinery. If someone asks whether the team is "doing agile", the answer is no — and the next sentence is that velocity on a three-person integration team was never going to mean anything.

## Who does what

Four roles, and each one owns a specific thing on the board. Where two people could both do something, the table says who does it, so it does not fall between them.

| Role | Owns on the board | Does each week | Does not do |
| --- | --- | --- | --- |
| **IT Manager** | Priority, and the decision to retire something | Reads the Stats page before the monthly one-to-one; approves anything that needs budget or a new vendor | Assign tasks, move cards, set go-live dates |
| **IT Project Manager** | Intake and the Backlog order; go-live dates; chasing blockers and sign-off | Runs Monday planning; keeps the blocked list moving; confirms every In progress card got a status update; books the business sign-off | Decide technical approach, write tasks for developers |
| **Integration developer** | Their own cards' tasks, pages and status updates | Writes the design and mapping pages, breaks work into day-sized tasks, posts the weekly update, keeps the runbook current | Re-prioritise the Backlog, change a go-live date alone |
| **Lead developer** (one of the 2–3, part time) | Technical review, and the Configuration screen | Peer-reviews before In review; decides the pattern (API vs batch vs extract); says whether a card is Ready | Act as a gatekeeper on every change |

If there is no separate lead, the two developers peer-review each other and the Project Manager breaks a tie by asking for the decision in writing as a status update.

**The rule that matters most:** the Project Manager owns *what* and *when*, the developers own *how* and *how long*. A go-live date is proposed by the developer who will build it and confirmed by the Project Manager. Neither sets one alone, and that conversation happens at Monday planning, in front of the board.

## One-time setup in Clique

All of this is done once, on the **Configuration** screen, by the lead developer. It takes about an hour. Budget a second hour for the back-fill described in *Rollout*.

### Columns

The shipped defaults already match the lifecycle, so leave them alone: **Backlog**, **In progress**, **In review**, **Live**, **Graveyard**. Two things to know before anyone gets creative:

- Rename labels freely, but **do not change a column's `id`** once projects use it — the id is stored in every project file.
- The `live` column id is special: only cards in it get the automatic **Maintenance** flag. Keep that id.

### Properties

Every property shows on every card, so a long list makes the board unreadable. Nine is the practical ceiling. This set is tuned for MuleSoft and SQL work:

| Property | Type | Options / notes |
| --- | --- | --- |
| **Summary** | text | One line: what it does, in business language. Shows in the list view and the CSV — this is the line a manager reads. |
| **Priority** | select | High (red), Medium (yellow), Low (gray). Set by the IT Manager. |
| **Owners** | people | The developer(s). Keep it to one primary where you can. |
| **Go-live** | date | Confirmed at Monday planning. Drives the "past its date" list on Stats. |
| **Systems** | multi-select | Core banking, ITSM, CRM, Online banking, Card processor, Loan origination, Data warehouse, Identity, SFTP / file share, Reporting. This turns the board into an impact map: before a core upgrade, filter by Core banking and you have the blast radius. |
| **Pattern** | select | MuleSoft API, MuleSoft batch / scheduler, MuleSoft event listener, SQL extract, SQL view / procedure, File feed (SFTP), Manual / script. Tells you at a glance what skills a card needs. |
| **Requested by** | text | The business sponsor's name. Who signs off, and who to go back to. |
| **Effort** | select | S (under a week), M (1–3 weeks), L (over 3 weeks — split it). T-shirts, not points, and only used to sequence the Backlog. |
| **Runbook** | url | Link to the external runbook if one already lives elsewhere; otherwise leave it empty and use the Runbook page on the card. |

Optional tenth, if you are under formal change control: **Change ref** (text) for the ITSM change number. Worth it — it makes an audit request answerable from the list view and CSV export.

A property's **key is fixed at creation** because it is the frontmatter key in every project file. Renaming only changes the label. So spend five minutes on the key names now.

### Groups

Create one group, **IT Integrations**, with the two or three developers as members. Members get offered first in every owner dropdown, which is most of the value.

Create a second group only if the team genuinely splits its reporting — for example **IT Integrations** and **IT Reporting** if extracts are tracked separately for the data team. The **Perspectives** row then lets each group see only its own cards, and the Stats page follows the same choice. For two or three people sharing all the work, one group is right.

### Repositories

If the MuleSoft projects live in GitHub, put each card's repository URLs in its **GitHub repos** field. Each open task then gets a **🔗 Issue** button that opens GitHub's new-issue form pre-filled from the task and its notes summary; you paste the issue link or number back to link them.

If the code lives in Azure DevOps or Bitbucket — common in MuleSoft shops — that integration does not apply. Put the repository or pipeline link in the **Runbook** URL property, or as a link on the design page, and skip issue linking.

### Where the data lives, before you start

Clique stores everything as markdown files under `DATA_DIR`. Agree two things with whoever runs the server:

- `DATA_DIR` is on backed-up storage, and the backup includes **`events.ndjson`** — the append-only delivery history. It cannot be rebuilt from the markdown, and losing it loses the Stats history.
- Exactly **one instance** runs. It is a single process writing files on disk; do not put it behind a load balancer.

## The five stages and their gates

A card moves right only when its gate is met, and the gate is evidence written on the card — not a verbal agreement in a meeting. There are four of them, each a short checklist. They are deliberately low-ceremony: no forms, no approval chains, no extra meeting. But they are not negotiable per project, because a gate that bends for a tight deadline has stopped being a gate.

```
   Backlog
      |   Gate: Ready — sponsor named, pattern and effort agreed,
      |                 nothing unknown that would stop a start
      v
   In progress
      |   Gate: Built — tasks done, peer-reviewed, running in Test,
      |                 design and field-mapping pages complete
      v
   In review
      |   Gate: Accepted — sign-off recorded as a status update with a
      |                    name and date, change approved, runbook written
      v
   Live  <--+   An open task on a live card flags it Maintenance;
      |     |   checking it off clears the flag.
      |     +---+
      |   Gate: Retired — the owner agrees it is switched off, and a
      |                   decommission note is written on the card
      v
   Graveyard
```

Each gate's evidence sits on the card itself, so the Project Manager or the IT Manager can check it without asking the developer.

### Gate 1 — Ready: Backlog → In progress

Checked at Monday planning by the lead developer.

- [ ] A named business sponsor, a person and not a department
- [ ] Summary written as one line of business language
- [ ] Systems and Pattern set
- [ ] Priority set by the IT Manager
- [ ] Effort agreed, and anything sized L is split first
- [ ] Nothing unknown that would stop work starting: access, credentials, sample data, a confirmed endpoint
- [ ] The team is under the WIP limit

If the last item is the blocker, the card stays in Backlog carrying one spike task. That is a normal state, not a failed gate.

### Gate 2 — Built: In progress → In review

Checked by the peer reviewer.

- [ ] Every task checked off, or explicitly moved out of scope and noted in a status update
- [ ] Design page complete: trigger, flow, error handling, retries, volumes
- [ ] Field mapping page complete, including the rule for rejected records
- [ ] Unit or MUnit tests passing
- [ ] Deployed to Test and run against realistic data
- [ ] Peer review done by the other developer

### Gate 3 — Accepted: In review → Live

Checked by the Project Manager. This is the gate that gets skipped under pressure, and the one most worth holding.

- [ ] Test evidence page on the card
- [ ] Business sign-off recorded as a status update naming the person and the date
- [ ] Change record approved, with its number in the Change ref property
- [ ] **Runbook page written** — no runbook, no go-live
- [ ] Monitoring or alerting in place, including the failure case
- [ ] Go-live date on the card matches reality

### Gate 4 — Retired: anything → Graveyard

Checked by the IT Manager.

- [ ] The business owner agrees it is no longer needed, or it is confirmed switched off
- [ ] A decommission note on the card: when, why, what replaced it, where the historical data went, who approved it

A rejected Backlog request goes here too, with one line saying why. Nothing is ever deleted — Graveyard cards stay searchable, which is what makes it safe to retire things.

### Live is not an end state

This is the part that makes Clique different from a ticket tracker, and it is worth spelling out for anyone used to one. A card in **Live** picks up work again whenever something needs changing: add a task, and Clique flags the project **in maintenance** and outlines it yellow. Check the task off and the flag clears itself. There is nothing to tick and nothing to remember.

The effect is that support work on live solutions is visible on the same board as delivery work, competing for the same WIP limit — which is honest, because it competes for the same people. It also means the card's pages stay current, since the person fixing it is already on the page that documents it.

## The weekly and monthly rhythm

Four short meetings a week, and one a month. Every one of them has a screen open and leaves the board changed — if a meeting ends with nothing edited, cancel it next time.

| Meeting | When | Who | Screen open | What must change by the end |
| --- | --- | --- | --- | --- |
| **Intake and focus** | Monday, 30 min | PM runs it, all developers, IT Manager optional | Board, All groups | New Backlog cards triaged or rejected; Ready cards pulled into In progress within the WIP limit; every In progress card has a confirmed Go-live date and an owner |
| **Standup** | Tue–Fri, 10 min | Developers, PM listens | Each person's **Workday** page | Anything newly stuck is ticked **Blocked** with a reason; nothing else |
| **Review clinic** | Wednesday, 15 min | PM, lead developer, requester if available | Board filtered to In review | Each In review card either gets its sign-off recorded as a status update, or a named person and date for getting it |
| **Board hygiene** | Friday, 15 min | Developers | Board, then each own card | A status update on every card in In progress; runbooks updated for anything that went live; finished tasks checked off |
| **Portfolio review** | Monthly, 30 min | IT Manager, PM | **Stats** page | Priorities re-set for the next month; retirement decisions made; anything untouched for 30 days either restarted or moved to Graveyard |

### How to run the standup

Do not walk the board — it invites status theatre. Each developer opens their own **Workday** page (`#/workday/<name>`), which collects their open tasks from every project into one list with each task's project and stage. They answer three questions against that list:

1. What came off this list yesterday?
2. What is coming off it today?
3. What is in the way?

Anything in the way gets the project ticked **Blocked** with a reason, right then, while everyone is watching. The reason shows on the card, on the project page, in the list view and in the CSV — which is how it reaches the Project Manager without anyone writing a separate email. A blocked project also stamps a **Potential blocker** label on its open tasks in Workday, so it does not get quietly forgotten.

The standup never reassigns work and never re-estimates. Those happen Monday.

### How to run Monday planning

In this order, 30 minutes:

1. **Clear the done pile first.** Anything finished since last Monday moves to Live or Graveyard. Five minutes.
2. **Walk the blocked list.** Every card with a red outline: still blocked, or can we unblock it now? The PM takes an action for each one that is still stuck.
3. **Triage new Backlog cards.** For each: is it Ready (see the gate in the next section)? If not, who is getting the missing piece, by when? If it should not be done at all, say so now and move it to Graveyard — a rejected request that stays in the Backlog is a lie the board tells for months.
4. **Pull, do not push.** Only if someone is under the WIP limit do they pull the top Ready card. The PM does not assign; the developer pulls.
5. **Confirm Go-live dates** on everything in progress. A date that slipped gets changed on the card *and* explained in a status update. Silently moving a date is the one thing that will break the manager's trust in the board.

### Instead of a retrospective

Keep a single card called **Team practices** in the Live column, with pages for *Conventions*, *Lessons learned* and *On-call notes*. When something goes wrong or a trick is worth keeping, add a dated bullet to *Lessons learned* on the spot. Skim it for ten minutes at the monthly portfolio review. That captures more than a scheduled retro that two of three people attend.

## Walkthrough: a MuleSoft integration

A real example end to end. The request: when a member updates their address in online banking, push it to the CRM so the service team sees it the same day.

**Monday, intake.** The PM creates the card on the board, in the IT Integrations perspective, and fills only what intake needs:

- Title: `Online banking → CRM address change sync`
- Summary: `Address changes made in online banking reach the CRM within 15 minutes.`
- Requested by: `Dana Reyes, Member Services`
- Systems: `Online banking`, `CRM`
- Priority: `Medium`

It is not Ready yet — no pattern, no effort, nobody has confirmed the CRM even has a writable address endpoint. The PM adds a task `Confirm CRM address API is writable` owned by the developer who will investigate, and the card stays in Backlog. That is the correct state: a Backlog card with one spike task on it.

**The following Monday, pull.** The spike came back: the CRM exposes a REST endpoint, and online banking can fire a webhook. The lead sets Pattern to `MuleSoft API`, Effort to `S`, the developer proposes a Go-live two weeks out, the PM confirms it, and the card is dragged to **In progress**.

**In progress.** The developer does three things on the card, in this order.

First, a **Design** page from the sidebar. This is the page that saves the next person two days:

- The trigger and its shape: webhook from online banking, payload sample in a code block.
- The Anypoint application name, the API spec in Exchange with its version, and the target environment and runtime.
- Error handling: what happens on a CRM 4xx versus a 5xx, the retry policy, and where a message that exhausts retries ends up.
- Connectors used, and which secure properties the app needs.

Second, a **Field mapping** page — a table, one row per field. See the template in *Page templates*. This is the single most valuable page on the card, and the one most often left in someone's Anypoint Studio comments instead.

Third, the task list, each item a day or less:

- [ ] Stand up the system API skeleton and deploy to Dev
- [ ] Map the webhook payload to the CRM contract
- [ ] Error handling and dead-letter path
- [ ] MUnit tests for the happy path and a CRM 500
- [ ] Deploy to Test and run with 20 real address changes
- [ ] Runbook page

Two habits make this pay off. Use **📝 Add notes** on a task when it needs its own working page — the notes page's **Summary** box becomes the description if you later schedule the task or raise a GitHub issue from it. And use **📅 Schedule** on the one or two tasks that need uninterrupted time; it opens a pre-filled calendar draft you drag to a free slot.

Every Friday, a status update: `Mapping done, MUnit at 80%. CRM sandbox was down Wed so Test deploy slips to Monday.` — two sentences, and the manager now knows more than a standup would have told them.

**In review.** Tasks are done, Test is green. The card moves right, and a **Test evidence** page goes on it: the 20 address changes, what reached the CRM, and the two that failed with the reason. The PM books 20 minutes with Dana, who confirms it. The sign-off is recorded as a status update: `Signed off by Dana Reyes, 18 Nov, on 20 test cases. Approved for production.` That sentence is the audit trail.

**Live.** Before the card moves, the **Runbook** page is written — the gate in the next section does not bend for this. Then the change goes through ITSM, the change number lands in the Change ref property, and the card moves to **Live**. The card is now the solution's wiki page: the Design, Field mapping and Runbook pages are what the on-call person reads at 2am.

**Afterwards.** Six weeks later the CRM adds a county field. Nobody opens a new card. A task goes on the live card: `Add county to the address mapping`. Clique automatically flags the project **in maintenance** and outlines it yellow, so the work is visible to the PM without a ticket, and the flag clears itself when the task is checked off. That loop — live cards picking up tasks and shedding them — is where most of a mature integration team's week actually goes, and it is the main reason the card does not get archived at go-live.

## Walkthrough: a SQL extract

Extracts are the volume work: a dozen a quarter, most of them two days each. Run them through the same five stages, but with a lighter touch, or the process will cost more than the work.

The request: Accounting wants a monthly file of closed loans with payoff amounts, dropped on the finance share.

**What changes versus an integration**

|  | Integration | Extract |
| --- | --- | --- |
| Pages on the card | Design, Field mapping, Test evidence, Runbook | One **Spec and runbook** page, combined |
| Tasks | 5–8 | 2–3 |
| Business sign-off | A booked session with the requester | The requester confirms the first real file by email; paste their reply into a status update |
| Time in review | Days | Often the same day |
| Peer review | Always | Always — this is the one thing not to drop |

**The card.** Title `Extract: Accounting closed-loan payoffs (monthly)`. Prefix extracts with `Extract:` so they sort together in the list view and are easy to filter. Pattern is `SQL extract`, Systems are `Core banking` and `Reporting`, Effort `S`.

**The one page it needs.** Combine the spec and the runbook, because for an extract they are nearly the same document. It has to answer:

- **Source**: server, database, and the tables or views read. Name them exactly.
- **The query**: the SQL itself in a code block, or the name of the view or stored procedure if it lives in the database. If the query lives in source control, link it — but paste the current version here too, because the person reading this at month-end will not clone a repository.
- **Schedule**: the SQL Agent job name (or the scheduler), the cron or recurrence, and the window it must finish in.
- **Output**: file name pattern, format, delimiter, encoding, whether there is a header row, and the exact destination path or SFTP target.
- **Recipients**: who consumes it, and who to call when it is wrong.
- **Data sensitivity**: whether the file carries member PII or account numbers, where it is allowed to land, and how long copies are kept. For a credit union this is the line an auditor will ask about, and it takes one sentence to write now.
- **Failure handling**: who gets alerted if the job fails or produces zero rows, and whether a late file is a call-out or waits for morning.

**Tasks.**

- [ ] Write and peer-review the query against last month's figures
- [ ] Schedule the job and prove the file lands on the share
- [ ] Accounting confirms the first file

**Two things that go wrong with extracts, and the cheap fix for each.**

The first is the zero-row file. An extract that runs successfully and writes an empty file looks healthy on every dashboard and is wrong for a month before anyone notices. Make "alert on zero rows" a line in the spec and a task on the card, not an afterthought.

The second is the orphan. Extracts outlive the person who asked for them. Once a year, filter the list view to `Pattern = SQL extract`, export the CSV, and send it to the requesters: *are you still using this?* Anything nobody claims goes to **Graveyard** with a note. That one hour a year is the main defence against a reporting estate that nobody understands — and it is only possible because every extract is a card with a named requester on it.

## Conventions and limits

Six rules. They exist because with three people and no tooling to enforce anything, consistency is the only thing keeping the board readable six months from now.

**1. Naming.** The title says what it connects, in the direction data flows.

- Integrations: `<source> → <target> <what>` — `Online banking → CRM address change sync`, `Core banking → Data warehouse nightly load`
- Extracts: `Extract: <recipient> <dataset> (<frequency>)` — `Extract: Accounting closed-loan payoffs (monthly)`
- Internal or platform work: plain name — `MuleSoft runtime upgrade to 4.6`

No ticket numbers, no project codes, no acronyms that only three people know. The title is read by the IT Manager and by whoever inherits this in two years.

**2. A task is a day or less.** This is the only sizing rule, and it replaces estimation entirely. If a task cannot be finished in a day, split it. The reason is practical, not ideological: tasks under a day make the standup honest, because "still working on it" twice in a row is now visibly a problem rather than normal.

**3. WIP limit: two cards per developer, five for the team.** Counted in the In progress column. When the limit is hit, nothing new is pulled until something leaves — and if the business insists on something new, something current goes back to Backlog *explicitly*, as a decision made in the meeting with a status update explaining it. The limit's whole purpose is to force that trade-off into the open instead of letting it happen by neglect.

**4. One status update a week on every In progress card, with a name.** Two sentences: what moved, and what is next or in the way. A card with no update for two weeks is treated as stalled at Monday planning regardless of what anyone says in the room. This is the single habit the whole guide depends on; if it lapses, the board becomes decoration.

**5. Blocked means blocked by someone outside the team.** Waiting on a vendor, an access request, a business decision, another team's environment. It does not mean "hard" or "I have not started". Keep that distinction, because the blocked list is what the Project Manager escalates with, and a list with three soft entries in it stops being escalated.

**6. Document on the card, not in chat.** If an answer took more than five minutes to find, it belongs on a page on the card. The test: if the person who built it were on holiday, could someone else fix it from the card alone? Teams threads are not searchable in two years; the card's markdown files are, with or without Clique.

### What does not go on the board

| Keep it out | Where it goes instead |
| --- | --- |
| Production incidents, outages | ITSM. If the fix is more than a restart, open a task on the live card and link the incident number. |
| Ad-hoc "can you run this query" asks | Do it, don't card it. If the same ask comes three times, it becomes an extract card. |
| Personal to-dos and admin | Your own notes. |
| Vendor tickets | Their system, with the reference in a status update. |
| Work for another team you are not building | Nothing. The board holds what this team builds and supports. |

## Page templates to copy

Clique has no template feature, so keep these on the **Team practices** card and copy them. Every one of them is markdown, so pasting works.

### Design page (integrations)

```markdown
## Purpose
One paragraph in business language. Who benefits and how.

## Trigger
What starts it: webhook, schedule (with the cron), queue message, file arrival.
Sample payload in a code block.

## Flow
1. ...
2. ...

## Anypoint details
- Application name:
- API spec in Exchange (name and version):
- Environment and runtime:
- Connectors used:
- Secure properties required:

## Error handling
- On a 4xx from the target:
- On a 5xx / timeout:
- Retry policy:
- Where an exhausted message ends up, and who looks at it:

## Non-functional
- Expected volume (per day, peak):
- Latency requirement:
- Idempotency: what happens if the same event arrives twice

## Open questions
- [ ] ...
```

### Field mapping page

One row per field. The *Transformation* column is where the knowledge actually lives — fill it even when the answer is "direct".

```markdown
| Source field | Type | Target field | Type | Required | Transformation / rule |
| --- | --- | --- | --- | --- | --- |
| member.addr1 | string(60) | Contact.Street | string(255) | yes | direct |
| member.state | string(2) | Contact.State | picklist | yes | map 2-letter code to CRM picklist; unknown -> reject |
| member.updatedAt | datetime | (not mapped) | | | used only for ordering |

**Rejections:** what happens to a record that fails a rule, and who sees it.
```

### Spec and runbook (extracts)

```markdown
## What this produces
One line, and who uses it.

## Source
Server / database / tables or views:

## Query
(SQL in a code block, or the view / procedure name, plus a link to source control)

## Schedule
- Job name:
- Runs:
- Must complete by:

## Output
- File name pattern:
- Format, delimiter, encoding, header row:
- Destination path or SFTP target:

## Recipients
- Consumes it:
- Call when it is wrong:

## Data sensitivity
PII or account numbers present? Where it may land. Retention of copies.

## If it fails
- Job failure: who is alerted, and is it a call-out?
- Zero rows: who is alerted?
- Re-running it safely:
```

### Runbook page (integrations)

The test for this page: a colleague who has never seen the integration can diagnose it at 2am with only this page open.

```markdown
## What breaks, and what you do
| Symptom | Likely cause | What to do |
| --- | --- | --- |
| ... | ... | ... |

## Where to look
- Logs:
- Dashboard / alerts:
- Dead-letter queue:

## How to restart it safely
Steps, and whether replaying causes duplicates.

## Who to call
- Business owner:
- Vendor / system contact:

## Known limitations
Things that are deliberate, so nobody "fixes" them.
```

### Test evidence page

```markdown
## Scope
What was tested, in which environment, on which date.

## Results
| # | Case | Expected | Actual | Pass |
| --- | --- | --- | --- | --- |

## Defects found and their resolution

## Sign-off
Recorded as a status update on the project: name, date, what was approved.
```

### Decommission note (Graveyard)

Four lines, written when the card is retired. Skipping this is how an organisation ends up afraid to turn anything off.

```markdown
## Decommissioned
- Turned off on:
- Why:
- Replaced by: (link to the card that replaced it, or "nothing")
- Where the historical data went:
- Who approved it:
```

## Reporting: what the manager and PM get

Nothing here is compiled by hand. Every number below is generated from the cards, which is the point: the reporting is a by-product of the team working normally, so it cannot drift from reality without the board visibly rotting first.

### The IT Manager's monthly half-hour

Open **Stats** and read the *Portfolio* half, top to bottom.

| What you see | What it tells you | What to ask when it looks wrong |
| --- | --- | --- |
| Active and live counts | The size of what the team has built and what is in flight | If live keeps growing and active does not shrink, maintenance is eating delivery — look at the maintenance flags |
| Go-lives in the last 90 days | Throughput, the only output number worth tracking here | Compare across quarters, never against another team |
| Typical time from created to go-live | How long a request waits, end to end, including Backlog time | A rising number with steady go-lives means intake is outpacing capacity |
| Where the work sits by column | Where the queue is | A pile-up in **In review** is almost always waiting on business sign-off, not on the developers |
| Created vs went-live by month | Whether intake and delivery are in balance | Two months of intake above delivery is the moment to talk about priorities or headcount |

One honest caveat: column moves made before the event log existed were never recorded, so early months show as *not recorded* rather than zero. Go-lives and time-to-go-live are reliable from the point the team started using the board properly.

### The Project Manager's weekly pass

The *Day to day* half of the Stats page is built for exactly this, and replaces a status-chasing round:

- **Blocked projects**, with reasons — the escalation list
- **Past their go-live date** — the conversations to have before someone else notices
- **Untouched for 30 days** — the cards that quietly died
- **What each person is carrying** — load, for the WIP conversation on Monday
- **Recent activity** — what actually moved, with **Show tasks** ticked to include finished tasks

### Reports you can hand to someone else

**List view** is the reporting surface. Filter it, use **Columns** to trim it to what the audience needs, then either **Export CSV** or **Print / PDF**. The print output is light-themed and states which filters were applied, which matters when it ends up in a pack.

Four that are worth saving as recipes:

| Report | How |
| --- | --- |
| **Integration inventory** for an audit or a vendor review | No filters, columns: Title, Summary, Systems, Pattern, Owners, Go-live, Change ref. Export CSV. |
| **Blast radius before a core upgrade** | Filter Systems = Core banking. Every integration and extract that touches it, with owners. |
| **Monthly delivery summary** | Filter Status = Live, sort by last updated. Trim to Title, Summary, Go-live, Owners. Print to PDF. |
| **Support load** | Filter flags = In maintenance. Live solutions with open work — the real support backlog, and the number to bring when asking for capacity. |

With tasks turned on in the CSV you get one row per task repeating the project columns, which pivots in Excel. That is how to answer "what did each person actually finish last quarter" without anyone keeping a timesheet.

### The four numbers to report upward

Resist adding more. For a three-person team these are enough, and each one is a single read off the Stats page:

1. Solutions delivered this quarter (go-lives)
2. Typical time from request to go-live
3. Live solutions currently in maintenance (support load)
4. Count blocked, with reasons

Notice what is absent: no velocity, no story points, no utilisation. If someone asks for velocity, the four numbers above answer every question velocity was being used as a proxy for.

## Limits, risks and workarounds

Read this section before committing the team to Clique. These are real constraints, not rough edges, and most of them are consequences of a deliberate design — markdown files on disk, no database, no accounts — that is also why the documentation outlives the tool.

| Limit | What it means in practice | Workaround |
| --- | --- | --- |
| **No login, no permissions** | Anyone who can reach the URL reads and edits everything, with no audit of who changed what | Internal network or VPN only. Put Windows Authentication or a reverse-proxy login in front of it. Never expose it to the internet. This is the one item that needs a decision from the IT Manager before rollout. |
| **No named-user attribution** | Status updates carry a name only because the author types it | Make typing your name in a status update a convention from day one. There is no way to add it later for past entries. |
| **Single instance, files on disk** | One process, no load balancer, no horizontal scale | Fine for three users. Put `DATA_DIR` on backed-up, persistent storage and run one instance. |
| **`events.ndjson` cannot be rebuilt** | Losing it loses all delivery history; the board and documents survive | Verify it is in the backup set. Check this once, now, not after an incident. |
| **No notifications** | Nothing emails you when you are assigned a task or a card is blocked | The weekly cadence replaces notifications. Workday is the personal queue; people check it at standup. Do not try to run this asynchronously. |
| **GitHub issues are one-directional** | Closing an issue on GitHub does not check off the task; Clique never reads issue state | Treat the Clique task as the record of truth and check it off yourself. If the code is in Azure DevOps or Bitbucket, skip issue linking entirely. |
| **No sprint or iteration object** | Nowhere to record "this is cycle 14" | By design — the In progress column *is* the focus list, bounded by the WIP limit. Resist adding a Cycle property; it goes stale within a month. |
| **No dependency links between cards** | You cannot record "A blocks B" structurally | Use Blocked with a reason naming the other card, and mention it in a status update. With five active cards you do not need a dependency graph. |
| **Last save wins on tasks** | Two people editing the same card's task list at the same moment: the later save overwrites | Rare with three people, and only applies to the task list as a whole. Page bodies are safe — the editor warns and offers both versions. |
| **No time tracking, no capacity model** | Cannot answer "how many hours did this take" | Accepted. If someone needs billable hours, that lives in the timesheet system, not here. |
| **No attachments beyond pasted images** | Spreadsheets and vendor PDFs do not live on the card | Keep them on the file share or SharePoint and put the link on the page. Pasted screenshots do work and land in the card's `attachments/` folder. |

### The two risks worth naming out loud

**Adoption risk is the real one.** Clique's value is entirely a function of whether the status updates and runbooks get written. The tool enforces nothing — there is no required field, no workflow validation, no reminder. If the weekly update habit lapses for a month, the board becomes a stale wall that the IT Manager stops trusting, and after that no amount of tooling brings it back. This is why *Board hygiene* is a scheduled 15 minutes on Friday rather than something expected to happen naturally.

**Key-person risk cuts both ways.** The team is 2–3 people, so one departure is a third of the capacity. The documentation discipline in this guide is the mitigation, and it only works if the runbook gate is actually held. The first time a card moves to Live without a runbook because the go-live date was tight, the gate is gone. Hold it on the first one and it holds afterwards.

### If you outgrow it

The exit is unusually clean, which is worth knowing before adopting. Every project is a markdown file with YAML frontmatter in a plain folder structure — openable as an Obsidian vault, greppable, and commit-able to git as it stands. If the team grows past five or six people, or needs real permissions and audit, the documentation moves wherever you go without a migration project. Only the board behaviour and the Stats history are specific to Clique.

## Rollout: the first three weeks

Do not configure for a month and launch. Get the board in front of the team in week one with the work they are already doing on it.

| Week | Who | What |
| --- | --- | --- |
| **Week 0** (half a day) | Lead developer + whoever runs the server | Stand it up on an internal host, one instance, `DATA_DIR` on backed-up storage. Confirm `events.ndjson` is in the backup. Decide the authentication question. Configure columns, the nine properties and the one group. Delete the sample cards. |
| **Week 0** (2 hours) | All developers together | Create a card for every piece of **work in flight right now**, in the right column, with owner, summary and go-live date. Create the **Team practices** card and paste the templates onto it. |
| **Week 1** | Everyone | Run the full cadence: Monday planning, four standups, Wednesday clinic, Friday hygiene. Expect it to feel clumsy. Do not change the process this week — you cannot tell what is a process problem and what is a new-habit problem yet. |
| **Week 2** | Everyone | Same again. Back-fill live solutions in the background (below). First real sign-off recorded. At Friday hygiene, check: did every In progress card get an update? That answer is the health of the whole thing. |
| **Week 3** | IT Manager + PM | First portfolio review on the Stats page, even though the history is thin. The point is to find out which numbers the manager actually wants, early enough to adjust the property list. |

### Back-filling what is already live

This is the part that produces the biggest immediate win, and the part most likely to stall the rollout if done wrong. You almost certainly have 20–60 integrations and extracts running with no single inventory.

Do it in two passes.

**Pass one, minimum viable, 10 minutes per solution.** One card each in the **Live** column with only: title, Summary (one line), Systems, Pattern, Owners, and Requested by if anyone remembers. Nothing else. At three minutes of real thought per card, two developers get through 40 in an afternoon. The output is already an inventory nobody had.

**Pass two, opportunistically, forever.** Write the runbook page for a live solution the next time you touch it. Do not schedule a documentation sprint — it will not survive contact with the first production issue, and documentation written away from the work is the least accurate kind. Within a year the things that break often will be fully documented, which is exactly the right prioritisation and it happened for free.

One exception worth forcing: the three or four solutions where exactly one person knows how they work. Write those runbooks in week two, deliberately. That is the key-person risk, and it is the clearest return the board will ever produce.

### If you are coming from Microsoft Planner

Clique reads Planner's Excel export directly: in Planner choose **… → Export plan to Excel**, then **Import** in Clique's top bar. Each Planner task becomes a project; you map each bucket to a column before anything is saved. Checklists become tasks, descriptions become the project page, assignees and due dates land on the people and date properties.

Two things to check afterwards: a partially completed Planner checklist imports unchecked, because the export does not say which items were done; and dates are read in the exporting person's locale, so if your Excel writes day/month, verify dates on early-month tasks. Comments, attachments and task history are not in the export at all — if those matter, keep the Planner plan read-only for reference rather than deleting it.

## Anti-patterns and FAQ

### The five ways this goes wrong

**A card per task.** Someone creates `Add county field to CRM mapping` as its own project. Now the board has 60 cards, the inventory is useless, and the live integration's history is scattered. The rule: a card is a *solution that can be turned off*. If it cannot be independently decommissioned, it is a task on an existing card.

**The ghost backlog.** Fifty Backlog cards nobody has read in a year. Every one of them is a promise to someone who is still waiting. At Monday planning, reject out loud and move to Graveyard — a card in Graveyard is honest and still findable; a card rotting in Backlog is neither.

**Documentation theatre.** Pages created with headings and no content, so the card looks documented. Worse than nothing, because it stops anyone asking. An empty page should be deleted, not kept as an intention.

**Blocked as an excuse.** If half of In progress is red, Blocked has come to mean "hard" and the PM has lost their escalation tool. Blocked means waiting on someone outside the team, with a name attached.

**Silent date slips.** Changing a Go-live date without a status update explaining it. One developer doing this twice is enough for the IT Manager to stop believing any date on the board, and from that point the board is just a to-do list.

### FAQ

**Why not Jira or Azure Boards?** For three people, their configuration overhead exceeds their benefit, and neither keeps the documentation next to the work — the knowledge ends up in a separate Confluence space that drifts. Clique's specific bet is that the page where a solution was built is the page you support it from. If you already run Azure DevOps for the code, use it for the code; this board is for the solution and its documentation.

**Do we have to use all five columns?** Yes, and In review is the one people want to drop. It is where business sign-off lives, and merging it into In progress is how things reach production without the requester having confirmed them.

**What if a card sits in In review for three weeks waiting on the business?** That is the system working. It is visible on the Stats page as a pile-up, and it is the PM's job to chase. Do not move it back to In progress to make the board look tidier — you would be hiding the only evidence that the delay is not the team's.

**Who writes the status update if the developer is on leave?** Nobody. A card with no update is correctly reported as stalled. Do not have the PM write updates on developers' behalf; a board of second-hand updates tells you nothing.

**How do we handle a support request on something live?** If it is an incident, ITSM. If it is a change, a task on the live card — which flags the project in maintenance automatically, so the work is visible without creating anything new. If it is a big change, a new card that links back to the original in its summary.

**Can two developers own one card?** Yes, but prefer one owner and per-task owners for the shared work. One name on the card means one person is answerable for the weekly update.

**What about work that is pure investigation?** A spike task on the Backlog card it relates to, as in the MuleSoft walkthrough. If it relates to nothing yet, a card titled `Spike: <question>` that goes to Graveyard with its findings page when answered.

**Do we need the mobile layout?** It is there, and it is genuinely useful for the on-call case: a phone can read a runbook and check off a task at 2am. Don't plan on anyone doing their weekly update from a phone.

**How long before this is worth it?** The inventory pays off in week one. The reporting becomes real at about week six, once Stats has history. The documentation pays off the first time someone is on holiday when their integration breaks — unpredictable, but it is the largest return of the three.
