---
title: ITSM ↔ Core Banking incident sync
status: done
order: 0
created: 2026-10-16T02:32:36.227Z
updated: 2026-10-16T02:32:36.233Z
subtasks:
  - text: Map core alert codes to ITSM categories
    done: true
    owners:
      - Priya
  - text: Build the webhook receiver
    done: true
    owners:
      - Alex
  - text: Auto-close incidents when the batch recovers
    done: true
    owners:
      - Alex
      - Priya
  - text: Write the on-call runbook
    done: true
    owners:
      - Jordan
  - text: Load test with 500 alerts
    done: true
    owners:
      - Sam
priority: High
owner:
  - Alex
  - Priya
due: 2026-08-14
systems:
  - ITSM
  - Core banking
pattern: Webhook / events
estimate: 12
link: https://example.com/runbooks/itsm-core
summary: Core batch failures open and update ITSM incidents automatically.
---

## What it does

When a core banking batch job fails, the receiver opens an ITSM incident with the job name, error code and affected branch. It updates the incident on each retry and closes it when the job succeeds.

## Flow

1. Core emits an alert webhook
2. Receiver de-duplicates by job + business date
3. ITSM incident is created or updated
4. Recovery event closes the incident

> Alerts are retried for 24 hours before paging a human.
