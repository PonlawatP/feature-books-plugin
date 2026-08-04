---
description: Initialize a multi-repository Feature Books workspace portal
---

# Feature Books Workspace Init

Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/fb-workspace.mjs" init $ARGUMENTS`.

This creates `.feature-books-workspace/` at the target workspace root, discovers only immediate
child repositories, records them in `workspace.json`, and generates an Obsidian dashboard. Each
repository's own `.feature-books/` remains authoritative; the portal only catalogs and links them.
It also seeds workspace Graph View colors, appearance, and a Dataview-powered `_index.md`.
