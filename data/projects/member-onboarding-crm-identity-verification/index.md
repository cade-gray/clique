---
title: "Member onboarding: CRM + identity verification"
status: backlog
group: it-integrations
order: 0
created: 2026-10-16T02:32:36.278Z
updated: 2026-10-16T02:32:36.281Z
subtasks:
  - text: Pick an identity verification vendor
    done: false
    owners:
      - Sam
  - text: Draft the data flow for compliance review
    done: false
    owners:
      - Priya
  - text: Create member in core and CRM from one event
    done: false
  - text: Handle failed verification and manual review
    done: false
priority: Medium
owner:
  - Sam
  - Priya
due: 2027-01-29
systems:
  - CRM
  - Identity
  - Core banking
pattern: Webhook / events
estimate: 18
summary: New members are verified and created in core and the CRM from one application.
updates:
  - id: f6070801
    text: Compliance wants to review the data flow before we pick a vendor. Draft going to them next week.
    at: 2026-10-06T15:00:00.000Z
    author: Priya
---

## Scope

One application should create the member in the CRM, verify identity, and open the core membership and share account. Verification failures route to the member services queue.

- [ ] Compliance review of the data flow
- [ ] Retention rules for ID images
- [ ] Vendor shortlist
