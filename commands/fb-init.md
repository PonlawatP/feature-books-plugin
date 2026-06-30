---
description: Bootstrap Feature Books in a new project (create the vault skeleton + seed Obsidian graph colors)
argument-hint: [targetDir]
---

Bootstrap the Feature Books system for this project.

1. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/fb-init.mjs" $ARGUMENTS` (optional `[targetDir]`, default = cwd; add `--force` to overwrite existing graph.json/config).
   - Creates `.feature-books/` with folders features/ states/ shared/ apis/
   - Creates `_index.md` and `.fbconfig.json` (content language, default English)
   - Seeds `.feature-books/.obsidian/graph.json` so the graph is colored by type immediately (no need to configure in Obsidian)
   - Does not overwrite existing files unless `--force` is passed
2. Report the result, then remind the user to install the **Dataview** community plugin in Obsidian (for the table in `_index.md`).
3. Suggest the next step: create the first feature book with `/fb-new`.
