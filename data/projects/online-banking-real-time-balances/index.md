---
title: Online banking real-time balances
status: review
group: it-core
order: 1
created: 2026-10-16T02:32:36.255Z
updated: 2026-10-16T02:32:36.257Z
subtasks:
  - text: Expose a balance endpoint from the core gateway
    done: true
    owners:
      - Ronald
  - text: Cache with a 5 second TTL
    done: true
    owners:
      - Ronald
  - text: Pen test sign-off
    done: true
    owners:
      - Ronald
  - text: Security review of token scopes
    done: false
    owners:
      - Ronald
  - text: Cut over 10% of members
    done: false
    owners:
      - Ronald
priority: High
owner:
  - Ronald
due: 2026-10-30
systems:
  - Online banking
  - Core banking
pattern: REST API
estimate: 15
link: https://example.com/runbooks/balances
summary: Members see posted and pending balances within two seconds of a transaction.
updates:
  - id: c3d4e501
    text: Gateway endpoint is up in staging. p95 is 610 ms, under the 800 ms target.
    at: 2026-10-09T15:20:00.000Z
    author: Ronald
  - id: c3d4e502
    text: Pen test passed. Waiting on the token scope review before we start the 10% rollout.
    at: 2026-10-14T17:45:00.000Z
    author: Ronald
---

## Overview

Online banking previously showed balances from the nightly snapshot. This integration reads the live ledger through the core gateway.

## Targets

| Metric | Target | Current |
| --- | --- | --- |
| p95 latency | < 800 ms | 610 ms |
| Availability | 99.9% | 99.95% |

If the gateway is down the app falls back to the last cached balance and labels it *as of* the cache time.
