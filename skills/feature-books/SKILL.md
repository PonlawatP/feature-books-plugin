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
3. If you added/removed files that should be in the fence → update `core_files` to match.

## Schema reference (frontmatter)
- `id` (kebab-case, prefix: feat- / state- / shared- / api-) matches the filename
- `type`: feature | state | shared | api
- `depends_on` / `impacts`: list of `"[[id]]"` (always bidirectional — if A impacts B, then B depends_on A)
- `core_files`: globs of the files this note owns (the fence)
- `related_states`: related Zustand store/slice

## Helper scripts (run via node)
- `node "${CLAUDE_PLUGIN_ROOT}/scripts/graph-lint.mjs"` — check bidirectional relations + links to non-existent ids
- `node "${CLAUDE_PLUGIN_ROOT}/scripts/diff-impact.mjs"` — map git diff → owning features → summarize blast radius
- `node "${CLAUDE_PLUGIN_ROOT}/scripts/fence-check.mjs" <file>` — which feature's fence a file belongs to (also used as a PreToolUse hook)

## Slash commands
- `/fb-new` — create a new feature book from a template
- `/fb-impact` — analyze the impact of the current change
- `/fb-sync` — find code files that have no owner in any feature book
- `/fb-config` — get/set the content language (default English)
