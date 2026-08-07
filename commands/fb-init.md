---
description: Bootstrap Feature Books in a new project (create the vault skeleton + seed Obsidian graph colors + appearance)
argument-hint: [targetDir]
---

Bootstrap the Feature Books system for this project.

Steps:
1. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/fb-init.mjs" $ARGUMENTS` (optional `[targetDir]`, default = cwd; add `--force` to overwrite existing graph.json/appearance.json/config).
   - Creates `.feature-books/` with folders features/ states/ shared/ apis/ and the tasks/ lifecycle
     (`issues/`, `decisions/`, `backlog/`, `hold/`, `action/`, `done/`, `cancelled/`)
   - Creates `_index.md` and `.fbconfig.json` (content language, default English, plus a plugin-version stamp)
   - Seeds `.feature-books/.obsidian/graph.json` so the graph is colored by type immediately (no need to configure in Obsidian)
   - Seeds `.feature-books/.obsidian/appearance.json` with the project's fonts (Noto Sans / Noto Sans Thai Looped) and accent color (`#5cf58f`)
   - Does not overwrite existing files unless `--force` is passed
2. Report the result to the user, then remind them to install the **Dataview** community plugin in Obsidian (for the tables in `_index.md`).
3. Suggest the next steps: use `/fb-new` to create the first feature book, and `/fb-task` to log a task/issue card. Mention that if the graph colors or appearance ever drift/reset, `/fb-fix` restores them.
