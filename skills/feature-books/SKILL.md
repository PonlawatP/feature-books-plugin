---
name: feature-books
description: Use whenever editing, refactoring, or reasoning about a feature in this repo. Loads the relevant Feature Book(s) from .feature-books/ as the source of truth for business logic, declares the code "fence" (core_files) for the feature, and checks blast radius (impacts) before changing code to avoid regressions.
---

# Feature Books

This repo keeps a knowledge graph of features in `.feature-books/` (an Obsidian vault).
Each note carries YAML frontmatter that is the **source of truth** for business logic and
the **fence** (which files belong to a feature) and **blast radius** (what a change impacts).

## Language rule (configurable, default English)
Before creating or editing a feature book, read the `language` field from
`.feature-books/.fbconfig.json` (default: **English** if the file is absent).
Write all Feature Book prose — frontmatter prose values (e.g. business rules) and the
Markdown body — in that language. Keep ids, paths, tags, and code unchanged.
Change it with `/fb-config set <language>`; the new language applies from the next operation onward
and existing books are not retranslated.

## When to use
Before editing/refactoring any code related to a feature in this repo, follow the steps below first.

## Before editing code (read first)
1. **Find the relevant feature book**: search `.feature-books/` by feature name, or match the
   file path against each note's `core_files`.
2. **Read 1 hop**: read that feature's note plus every node listed in its `depends_on` and `impacts`
   (the first-degree neighbors). Do not load the whole vault — it wastes context and loses focus.
3. **Respect the fence**: edit only files within that feature's `core_files`. If you must touch a
   file outside the fence, stop and tell the user first which feature that file belongs to.
4. **Review the Business Rules** in the note before writing code.

## After editing code
1. If the feature has `impacts` → tell the user to also test/verify those downstream features.
2. Update the **Change Log** section in the note with the date and what changed.
3. **Auto-claim new files**: for every file you created or edited, **immediately** run `use fb-claim tool` with the file path and current feature ID. This keeps the fence in sync without manual bookkeeping. Use `--glob` to claim the whole directory (e.g. `src/foo/bar.ts` → `src/foo/**`).

## Schema reference (frontmatter)
- `id` (kebab-case, prefix: feat- / state- / shared- / api-) matches the filename
- `type`: feature | state | shared | api
- `depends_on` / `impacts`: list of `"[[id]]"` (always bidirectional — if A impacts B, then B depends_on A)
- `core_files`: globs of the files this note owns (the fence)
- `related_states`: related Zustand store/slice

## Slash commands
- `/fb-init` — bootstrap a new project with `.feature-books/` skeleton + Obsidian graph colors
- `/fb-new` — create a new feature book (proper frontmatter + bidirectional relations)
- `/fb-impact` — analyze git diff blast radius (owning features → downstream impacts)
- `/fb-sync` — find source files not covered by any feature's `core_files` fence
- `/fb-config` — get/set the content language (stored in `.fbconfig.json`)
- `/fb-claim <file-path> <feature-id> [--glob]` — claim a file under a feature's fence (auto-add to core_files)

## Helper scripts (run via node)
All commands above run these scripts under the hood; you can also call them directly:
- `node "${CLAUDE_PLUGIN_ROOT}/scripts/graph-lint.mjs"` — check bidirectional relations + links to non-existent ids
- `node "${CLAUDE_PLUGIN_ROOT}/scripts/diff-impact.mjs"` — map git diff → owning features → summarize blast radius
- `node "${CLAUDE_PLUGIN_ROOT}/scripts/fb-new.mjs" <type> <id>` — create a feature book (validates, links, lints)
- `node "${CLAUDE_PLUGIN_ROOT}/scripts/fence-check.mjs" <file>` — which feature's fence a file belongs to (also runs automatically before edit/write via the PreToolUse hook)
- `node "${CLAUDE_PLUGIN_ROOT}/scripts/fb-claim.mjs" <file-path> <feature-id> [--glob]` — claim a file under a feature's fence

> Note: under OpenCode the same scripts are exposed as native tools (`fb-init`, `fb-new`, …) via `src/index.ts`; the scripts are the shared source of truth for both runtimes.
