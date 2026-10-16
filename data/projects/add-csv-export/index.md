---
title: Add CSV export
status: review
order: 0
created: 2026-10-16T01:53:18.358Z
updated: 2026-10-16T01:53:18.359Z
subtasks:
  - text: Pick columns to include
    done: true
    owners:
      - Sam
  - text: Stream large exports
    done: true
    owners:
      - Priya
  - text: Code review
    done: false
    owners:
      - Alex
priority: Medium
owner:
  - Priya
  - Alex
  - Sam
due: 2026-10-19
labels:
  - Backend
estimate: 4
summary: Export the board as CSV for reporting.
---

## Notes

Export includes title, status, owners, and due date. Subtask progress is added as `done/total`.

## Math

Progress is $\frac{done}{total}$ of the subtasks.
