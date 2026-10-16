---
title: Set up CI pipeline
status: done
order: 0
created: 2026-10-16T01:53:18.362Z
updated: 2026-10-16T01:53:18.363Z
subtasks:
  - text: Run `npm test` on PRs
    done: true
    owners:
      - Alex
  - text: Cache node_modules
    done: true
    owners:
      - Alex
  - text: Document the workflow
    done: true
    owners:
      - Jordan
priority: High
owner:
  - Alex
due: 2026-10-08
labels:
  - Backend
  - Docs
estimate: 2
link: https://example.com/ci
summary: Run tests and build on every pull request.
---

Done and merged. Every pull request now runs the storage tests and a production build.
