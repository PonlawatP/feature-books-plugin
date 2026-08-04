---
name: feature-books
description: Use whenever editing, refactoring, or reasoning about a feature in this repo. Loads the relevant Feature Book(s) from .feature-books/ as the source of truth for business logic, declares the code "fence" (core_files) for the feature, and checks blast radius (impacts) before changing code to avoid regressions.
---

# Feature Books

This repo keeps a knowledge graph of features in `.feature-books/` (an Obsidian vault).
Each note carries YAML frontmatter that is the **source of truth** for business logic and
the **fence** (which files belong to a feature) and **blast radius** (what a change impacts).

## Version check (automatic, no AI involved)
Every session start, a `SessionStart` hook runs `fb-version-check.mjs` — a plain deterministic
script (no LLM call) that compares the version stamped in `.feature-books/.fbconfig.json` against
the installed plugin's own version and prints a warning if they don't match or the vault predates
version tracking. This is not something you need to remember to check — it always fires on its own.
If you see that warning in context, tell the user to run `/fb-fix` (it restores Obsidian settings
and re-stamps the version). `/fb-version` re-runs the same check on demand.

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

## After editing code (mandatory, not optional)
A `PostToolUse` hook (`fb-staleness-check.mjs`, also deterministic — no AI call) fires after every
Edit/Write/MultiEdit and tells you which feature's fence (if any) the edited file belongs to. Treat
that reminder as a requirement, not a suggestion:
1. **Auto-claim new files**: for every file you created or edited that isn't already in a feature's
   fence, run `/fb-claim` (or `use fb-claim tool`) with the file path and the current feature ID.
   Use `--glob` to claim the whole directory (e.g. `src/foo/bar.ts` → `src/foo/**`). This keeps the
   fence in sync without manual bookkeeping.
2. Run `diff-impact.mjs` (or `/fb-impact`) to get the full blast radius before calling the task done.
3. Run `graph-lint.mjs` and fix any ERRORS it reports before finishing.
4. Update the **Change Log** section in the note with the date and what changed.
5. If the feature has `impacts` → tell the user to also test/verify those downstream features.

A task is not finished until the Feature Book reflects the code as it now stands — do not skip
straight to reporting success while the note is still stale.

> **Enforced automatically (Claude Code).** A `Stop` hook (`fb-autobook.mjs`) runs when you finish
> a turn. If you changed code but the owning book has no Change Log entry for today — or a changed
> code file belongs to no book at all (a new feature) — it **blocks the turn end** and hands you the
> exact books to update. Do it in the same turn: create the book with `/fb-new` for a new feature,
> claim files with `/fb-claim`, and add the dated Change Log row. It stops prompting the moment the
> books reflect the change. Users never run these commands by hand. Kill switch: `FB_AUTOBOOK=0`.

## Schema reference (frontmatter)
- `id` (kebab-case, prefix: feat- / state- / shared- / api-) matches the filename
- `type`: feature | state | shared | api
- `depends_on` / `impacts`: list of `"[[id]]"` (always bidirectional — if A impacts B, then B depends_on A)
- `core_files`: globs of the files this note owns (the fence)
- `related_states`: related Zustand store/slice

## Tasks (issue cards) — `tasks/`
Separate from feature books, but same vault. Each card is a note with its own schema (`id`, `title`,
`kind`: feature|enhancement|bug|note, `status`, `effort`: S|M|L|XL, `related`: `"[[feat-x]]"` links,
`created`), plus a body (`## Description`, `## Logic Spec / Steps` for feature/enhancement cards,
`## Triage Notes`). A card moves physically through 4 folders as it progresses:
- `tasks/issues/` — new, untriaged. Created manually with `/fb-task`, whenever you (or the user)
  spot something that needs doing.
- `tasks/decisions/` — triaged. `/fb-triage` reads **every card physically in `tasks/issues/`** —
  including ones hand-created directly in Obsidian with no or partial frontmatter, not just ones
  made via `/fb-task` — normalizes it to the standard schema (inferring `id`/`title`/`kind`/`created`
  and preserving the author's original prose rather than discarding it), links it to related feature
  books, estimates effort, sets `status: triaged`, and moves it here.
- `tasks/action/` — confirmed. The user drags a card here themselves once they decide to act on it.
  Nothing automated does this move — update `status: in-progress` to match when you see one land here.
- `tasks/done/` — completed. The user drags it here themselves when the work is finished — update
  `status: done` to match.

`fb-tasks-lint.mjs` (deterministic, no AI) checks that a card's `status` field matches which of
these 4 folders it's physically in, and flags drift after a manual drag.

## Slash commands
- `/fb-init` — bootstrap a new project with `.feature-books/` skeleton + Obsidian graph colors + appearance
- `/fb-fix` — restore Obsidian graph colors/appearance and re-stamp the vault version
- `/fb-version` — check the vault's stamped version against the installed plugin (deterministic, also runs automatically at session start)
- `/fb-new` — create a new feature book (proper frontmatter + bidirectional relations)
- `/fb-impact` — analyze git diff blast radius (owning features → downstream impacts)
- `/fb-sync` — find source files not covered by any feature's `core_files` fence
- `/fb-config` — get/set the content language (stored in `.fbconfig.json`)
- `/fb-claim <file-path> <feature-id> [--glob]` — claim a file under a feature's fence (auto-add to core_files)
- `/fb-task` — create a new task/issue card in `tasks/issues/`
- `/fb-triage` — process the task inbox: format, link to feature books, estimate effort, move to `tasks/decisions/`

## Helper scripts (run via node)
All commands above run these scripts under the hood; you can also call them directly:
- `node "${CLAUDE_PLUGIN_ROOT}/scripts/graph-lint.mjs"` — check bidirectional relations + links to non-existent ids
- `node "${CLAUDE_PLUGIN_ROOT}/scripts/diff-impact.mjs"` — map git diff → owning features → summarize blast radius
- `node "${CLAUDE_PLUGIN_ROOT}/scripts/fb-new.mjs" <type> <id>` — create a feature book (validates, links, lints)
- `node "${CLAUDE_PLUGIN_ROOT}/scripts/fence-check.mjs" <file>` — which feature's fence a file belongs to (also runs automatically before edit/write via the PreToolUse hook)
- `node "${CLAUDE_PLUGIN_ROOT}/scripts/fb-autobook.mjs"` — runs automatically on the `Stop` hook: if changed code isn't reflected in its feature book (stale Change Log or new-feature orphan), blocks turn-end and lists what to update (loop-guarded; disable with `FB_AUTOBOOK=0`)
- `node "${CLAUDE_PLUGIN_ROOT}/scripts/fb-claim.mjs" <file-path> <feature-id> [--glob]` — claim a file under a feature's fence
- `node "${CLAUDE_PLUGIN_ROOT}/scripts/fb-fix.mjs"` — force-restore Obsidian graph colors/appearance and re-stamp the vault version
- `node "${CLAUDE_PLUGIN_ROOT}/scripts/fb-version-check.mjs" [check]` — compare the vault's stamped version against the installed plugin
- `node "${CLAUDE_PLUGIN_ROOT}/scripts/fb-tasks-list.mjs" [--inbox] [--json]` — list task/issue cards
- `node "${CLAUDE_PLUGIN_ROOT}/scripts/fb-tasks-lint.mjs"` — check task card schema + folder/status consistency

> Note: under OpenCode the same scripts are exposed as native tools (`fb-init`, `fb-new`, `fb-claim`, …) via `src/index.ts`; the scripts are the shared source of truth for both runtimes.
