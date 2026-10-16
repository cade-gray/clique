---
title: Fix login redirect loop
status: in-progress
order: 1
created: 2026-10-16T01:53:18.334Z
updated: 2026-10-16T01:53:18.337Z
subtasks:
  - text: Reproduce on Safari 17
    done: true
    owners:
      - Priya
  - text: Find the cookie that is dropped
    done: true
    owners:
      - Alex
      - Priya
  - text: Ship the fix behind a flag
    done: false
    owners:
      - Alex
  - text: Add a regression test
    done: false
priority: High
owner:
  - Alex
  - Priya
due: 2026-10-22
labels:
  - Bug
  - Backend
estimate: 2
blocked: true
blockedReason: Waiting on HTTPS for the staging environment
link: https://example.com/issues/142
summary: Users on Safari bounce between /login and /home.
---

## Problem

After signing in, Safari users are sent back to `/login` forever.

## Findings

- The session cookie is set with `SameSite=None` but without `Secure`.
- Chrome tolerates it on localhost; Safari does not.

```js
res.cookie("sid", token, { httpOnly: true, secure: true, sameSite: "lax" });
```

> The task is **blocked** until staging serves HTTPS (see the reason above).
