---
title: Loan origination → core auto-boarding
status: in-progress
group: it-lending
order: 1
created: 2026-10-16T02:32:36.269Z
updated: 2026-10-16T02:32:36.271Z
subtasks:
  - text: Define the loan boarding payload
    done: true
    owners:
      - Alex
  - text: Build the boarding service
    done: true
    owners:
      - Alex
      - Sam
  - text: Test against the vendor sandbox
    done: false
    owners:
      - Sam
  - text: Reconcile funded amounts with the GL
    done: false
    owners:
      - Priya
  - text: Train loan officers
    done: false
    owners:
      - Jordan
blocked: true
blockedReason: Vendor sandbox credentials expired; waiting on a renewed key from the vendor
priority: High
owner:
  - Alex
  - Sam
due: 2026-12-04
systems:
  - Loan origination
  - Core banking
  - CRM
pattern: REST API
estimate: 20
summary: Approved loans are boarded to core and the member record is updated without re-keying.
updates:
  - id: e5f60701
    text: Boarding service works end to end against our mock. Vendor sandbox is still needed for the real test.
    at: 2026-10-13T18:00:00.000Z
    author: Alex
  - id: e5f60702
    text: Sandbox key expired yesterday. Opened a ticket with the vendor and marked this blocked.
    at: 2026-10-15T20:30:00.000Z
    author: Sam
---

## Why

Loan officers re-key every approved loan into core, which takes about 12 minutes and causes rate and term typos.

## Plan

1. Origination sends an *approved* event
2. Service validates product, rate and term against core
3. Loan is boarded and the member record updated in the CRM
4. A funding exception goes to the loan operations queue
