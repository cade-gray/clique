---
title: Card processor nightly reconciliation
status: live
order: 1
created: 2026-10-16T02:32:36.262Z
updated: 2026-10-17T05:42:51.069Z
subtasks:
  - text: Pull the settlement file over SFTP
    done: true
    owners:
      - Jordan
  - text: Match transactions to core postings
    done: true
    owners:
      - Jordan
      - Alex
  - text: Exception report emailed to Accounting
    done: true
    owners:
      - Jordan
  - text: Alert when the file is late
    done: true
    owners:
      - Priya
priority: Medium
owner:
  - Jordan
due: 2026-07-31
systems:
  - Card processor
  - Core banking
  - Data warehouse
pattern: SFTP file feed
estimate: 10
link: https://example.com/runbooks/card-recon
summary: Settlement files from the card processor are matched to core postings every night.
updates:
  - id: b2c3d401
    text: Shipped. First exception report went to Accounting with 3 items, all explained.
    at: 2026-07-31T13:00:00.000Z
    author: Jordan
---

## Schedule

The processor drops `SETTLE_YYYYMMDD.csv` by 02:00. The job runs at 02:15 and again at 04:00 if the file was late.

```bash
sftp -b get-settlement.batch cardproc@sftp.example.com
./reconcile --date "$(date +%F)" --out exceptions.csv
```

Unmatched items over 3 days old are escalated to Accounting.
