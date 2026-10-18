---
title: Data warehouse regulatory reporting feed
status: backlog
group: integrations
order: 1
created: 2026-10-16T02:32:36.287Z
updated: 2026-10-16T02:32:36.289Z
subtasks:
  - text: Inventory the fields needed for the quarterly call report
    done: false
    owners:
      - Jordan
  - text: Set up change data capture on core
    done: false
  - text: Build and validate the extract
    done: false
  - text: Parallel run against the current manual report
    done: false
priority: Low
owner:
  - Jordan
due: 2027-03-12
systems:
  - Data warehouse
  - Core banking
  - Loan origination
pattern: Database sync
estimate: 25
summary: Nightly extract of core and loan data for call report and other regulatory filings.
---

## Background

The quarterly call report is assembled by hand from spreadsheets. An automated nightly feed would remove most of the manual work and the reconciliation errors.
