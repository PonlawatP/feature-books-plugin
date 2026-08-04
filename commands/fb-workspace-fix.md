---
description: Restore workspace Obsidian graph colors, appearance, and generated Dataview dashboard
---

# Feature Books Workspace Fix

Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/fb-workspace.mjs" fix` from anywhere below an initialized
workspace. This intentionally overwrites `.feature-books-workspace/.obsidian/graph.json` and
`appearance.json`, then regenerates `_index.md`. It never modifies repository-local Feature Books.
