---
title: Welcome to Clique
status: in-progress
group: integrations
order: 0
created: 2026-10-16T01:00:12.321Z
updated: 2026-10-16T03:54:16.394Z
subtasks:
  - text: Open this project
    done: true
    owners:
      - Alex
      - Sam
  - text: Add a property under "Properties, columns & groups"
    done: false
  - text: Drag this card to another column
    done: false
priority: Medium
owner:
  - Alex
  - Sam
---

## What is this?

Each card on the board is a folder of **markdown files** on the server. This overview is `index.md`;
pages you add in the sidebar are sibling `.md` files. Properties and to-dos live in the frontmatter.

Type `/` on an empty line for headings, lists, tables, and code blocks.

```powershell
Get-ChildItem .\data\projects -Recurse -Filter *.md
```

- [x] Markdown renders as you type
- [ ] Code blocks have a copy button
