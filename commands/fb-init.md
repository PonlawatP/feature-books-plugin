---
description: Bootstrap Feature Books in a new project (create the vault skeleton + seed Obsidian graph colors)
argument-hint: [targetDir]
---

Bootstrap the Feature Books system for this project.

Steps:
1. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/fb-init.mjs" $ARGUMENTS`
   - Creates `.feature-books/` with folders features/ states/ shared/ apis/
   - Creates `_index.md`
   - Seeds `.feature-books/.obsidian/graph.json` so the graph is colored by type immediately (no need to configure in Obsidian)
   - Does not overwrite existing files unless `--force` is passed
2. Report the result to the user, then remind them to install the **Dataview** community plugin in Obsidian.
3. Suggest the next step: use `/fb-new` to create the first feature book.
