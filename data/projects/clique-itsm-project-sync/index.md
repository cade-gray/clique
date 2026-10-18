---
title: Clique ↔ ITSM project sync
status: in-progress
group: integrations
order: 2
created: 2026-10-16T02:32:36.248Z
updated: 2026-10-16T02:32:36.250Z
subtasks:
  - text: Store the ITSM change number on the project
    done: true
    owners:
      - Sam
  - text: Poll ITSM for change status every 5 minutes
    done: true
    owners:
      - Sam
  - text: Move the card to Done when the change is closed
    done: false
    owners:
      - Sam
      - Jordan
  - text: Show approval state on the card
    done: false
    owners:
      - Jordan
  - text: Handle ITSM maintenance windows
    done: false
priority: Medium
owner:
  - Sam
  - Jordan
due: 2026-11-20
systems:
  - Clique
  - ITSM
pattern: REST API
estimate: 8
summary: Show linked ITSM change requests on a Clique card and move the card when the change closes.
updates:
  - id: d4e5f601
    text: Change numbers now saved on projects and polled every 5 minutes.
    at: 2026-10-12T14:10:00.000Z
    author: Sam
  - id: d4e5f602
    text: "Next up: moving the card to Done when the change closes. Need to agree rate limits with the ITSM admins."
    at: 2026-10-15T19:00:00.000Z
    author: Jordan
---

## Goal

The integrations team tracks builds in Clique but approvals live in ITSM. This keeps the two in step so nobody updates a status twice.

## Approach

```js
// poll ITSM and patch the matching Clique project
const change = await itsm.get(`/changes/${project.properties.change}`);
if (change.state === "closed") await clique.patch(project.id, { status: "done" });
```

- [x] Read-only service account created in ITSM
- [ ] Rate limits agreed with the ITSM admins
