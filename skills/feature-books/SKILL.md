---
name: feature-books
description: Use when initializing or maintaining Feature Books, creating or triaging its task cards or product specs, or editing, refactoring, and reasoning about a feature in a repo that uses .feature-books/. Loads business rules and code fences before edits, then checks blast radius and freshness afterward.
---

# Feature Books

This repo keeps a knowledge graph of features in `.feature-books/` (an Obsidian vault).
Each note carries YAML frontmatter that is the **source of truth** for business logic and
the **fence** (which files belong to a feature) and **blast radius** (what a change impacts).

## Runtime compatibility

This skill supports Codex, Claude Code, and OpenCode. In Codex, users can invoke it explicitly as
`$feature-books` or describe the desired workflow in natural language. Claude Code additionally
exposes `/fb-*` slash commands, while OpenCode exposes native `fb-*` tools.

When Codex needs a bundled script, resolve the plugin root as the directory two levels above this
`SKILL.md`, then run `node <plugin-root>/scripts/<script>.mjs ...`. Do not assume
`CLAUDE_PLUGIN_ROOT` is present in an ordinary Codex shell command; that compatibility variable is
guaranteed for plugin hooks, not for arbitrary commands initiated by the skill.

## Version check (automatic, no AI involved)
Every session start, a `SessionStart` hook runs `fb-version-check.mjs` — a plain deterministic
script (no LLM call) that compares the version stamped in `.feature-books/.fbconfig.json` against
the installed plugin's own version and prints a warning if they don't match or the vault predates
version tracking. This is not something you need to remember to check — it always fires on its own.
If you see that warning in context, run the `fb-fix` workflow (it restores Obsidian settings and
re-stamps the version). The `fb-version` workflow re-runs the same check on demand.

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
   fence, run `fb-claim.mjs` (or the native `fb-claim` tool) with the file path and current feature ID.
   Use `--glob` to claim the whole directory (e.g. `src/foo/bar.ts` → `src/foo/**`). This keeps the
   fence in sync without manual bookkeeping.
2. Run `diff-impact.mjs` (or `/fb-impact`) to get the full blast radius before calling the task done.
3. Run `graph-lint.mjs` and fix any ERRORS it reports before finishing.
4. Update the **Change Log** section in the note with the date and what changed.
5. If the feature has `impacts` → tell the user to also test/verify those downstream features.

A task is not finished until the Feature Book reflects the code as it now stands — do not skip
straight to reporting success while the note is still stale.

> **Enforced automatically (Claude Code and Codex).** A `Stop` hook (`fb-autobook.mjs`) runs when you finish
> a turn. If you changed code but the owning book has no Change Log entry for today — or a changed
> code file belongs to no book at all (a new feature) — it **blocks the turn end** and hands you the
> exact books to update. Do it in the same turn: run the `fb-new` workflow for a new feature,
> claim files with `fb-claim.mjs`, and add the dated Change Log row. It stops prompting the moment the
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

## Available workflows

In Codex, interpret requests such as "initialize Feature Books", "run fb-impact", or
"use `$feature-books` to create a task" as the corresponding workflow below. Claude Code users can
invoke the slash-command spelling shown here:

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

For deterministic workflows, run the matching script in `<plugin-root>/scripts/`. For the
judgment-heavy `fb-spec-new`, `fb-task`, and `fb-triage` workflows, first read the corresponding
file under `<plugin-root>/commands/` completely and follow it. Treat `$ARGUMENTS` in those legacy
command files as the user's natural-language input in Codex.

## Helper scripts (run via node)
All commands above run these scripts under the hood; you can also call them directly:
- `node "<plugin-root>/scripts/graph-lint.mjs"` — check bidirectional relations + links to non-existent ids
- `node "<plugin-root>/scripts/diff-impact.mjs"` — map git diff → owning features → summarize blast radius
- `node "<plugin-root>/scripts/fb-new.mjs" <type> <id>` — create a feature book (validates, links, lints)
- `node "<plugin-root>/scripts/fence-check.mjs" <file>` — which feature's fence a file belongs to (also runs automatically before edit/write via the PreToolUse hook)
- `node "<plugin-root>/scripts/fb-autobook.mjs"` — runs automatically on the `Stop` hook: if changed code isn't reflected in its feature book (stale Change Log or new-feature orphan), continues the turn with what to update (loop-guarded; disable with `FB_AUTOBOOK=0`)
- `node "<plugin-root>/scripts/fb-claim.mjs" <file-path> <feature-id> [--glob]` — claim a file under a feature's fence
- `node "<plugin-root>/scripts/fb-fix.mjs"` — force-restore Obsidian graph colors/appearance and re-stamp the vault version
- `node "<plugin-root>/scripts/fb-version-check.mjs" [check]` — compare the vault's stamped version against the installed plugin
- `node "<plugin-root>/scripts/fb-tasks-list.mjs" [--inbox] [--json]` — list task/issue cards
- `node "<plugin-root>/scripts/fb-tasks-lint.mjs"` — check task card schema + folder/status consistency

> Note: Codex and Claude Code load lifecycle hooks from `hooks/hooks.json`. Codex requires users to
> review and trust non-managed plugin hooks before they run. OpenCode exposes the same scripts as
> native tools via `src/index.ts`; the scripts remain the shared source of truth.
