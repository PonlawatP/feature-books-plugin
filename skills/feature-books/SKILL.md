---
name: feature-books
description: Use when initializing or maintaining Feature Books, creating or triaging its task cards or product specs, or editing, refactoring, and reasoning about a feature in a repo that uses .feature-books/. Loads business rules and code fences before edits, then checks blast radius and freshness afterward.
---

# Feature Books

This repo keeps a knowledge graph of features in `.feature-books/` (an Obsidian vault).
Each note carries YAML frontmatter that is the **source of truth** for business logic and
the **fence** (which files belong to a feature) and **blast radius** (what a change impacts).

## Runtime compatibility

This skill supports Codex, Claude Code, and OpenCode. On every runtime, describing the desired
workflow in natural language is enough to trigger it — you do not need to wait for an exact command
spelling. In Codex, users can also invoke it explicitly as `$feature-books`. Claude Code additionally
exposes `/fb-*` slash commands as an optional shortcut, and OpenCode exposes native `fb-*` tools as
an optional shortcut, but neither spelling is required to run the matching workflow.

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
This language check is a required first step for specs and task cards too, including triage and
normalization. Do not infer the document language from the user's current message when it differs
from the configured value.
Change it with `/fb-config set <language>`; the new language applies from the next operation onward
and existing books are not retranslated.

## When to use
Before editing/refactoring any code related to a feature in this repo, follow the steps below first.

## Before editing code (read first)
When a `.feature-books-workspace/workspace.json` exists above the working directory, read that
manifest and `state.local.json` before searching. Treat `activeRepo`, `activeFeatures`, `activeTask`,
and `relatedRepos` as the context entry point. Search only registered repositories implicated by
that state or by the target file; do not sweep every repository. Repository-local `.feature-books/`
notes remain authoritative, and all fence, lint, impact, and write operations run from the owning repo.

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
> a turn. If you changed code but the owning book has no Change Log entry for today, a changed
> feature has no explicit lifecycle decision for the current scope, or a changed code file belongs
> to no book at all (a new feature), it **blocks the turn end** and hands you the
> exact books to update. Do it in the same turn: run the `fb-new` workflow for a new feature,
> claim files with `fb-claim.mjs`, and add the dated Change Log row. It stops prompting the moment the
> books reflect the change. Users never run these commands by hand. Kill switch: `FB_AUTOBOOK=0`.

## Schema reference (frontmatter)
- `id` (kebab-case, prefix: feat- / state- / shared- / api-) matches the filename
- `type`: feature | state | shared | api
- Feature `status`: `draft | active | stable | paused | deprecated`. It describes the current
  implementation lifecycle, not whether every related task is done. Set `active` while the user's
  requested implementation scope remains unfinished and `stable` when that scope completes; a
  stable feature may have optional tasks and may return to active in a later sprint. Only use
  `paused` or `deprecated` after an explicit user decision. Record status changes in the Change Log
  as `status: <value>` so the Stop hook can verify the decision.
- `depends_on` / `impacts`: list of `"[[id]]"` (always bidirectional — if A impacts B, then B depends_on A)
- `core_files`: globs of the files this note owns (the fence)
- `related_states`: related Zustand store/slice
- `capability`: optional workspace-wide product capability slug shared by repo-local feature slices
- `role`: optional slice role such as `frontend`, `backend`, `gateway`, or `worker`
- `cross_repo`: optional qualified references (`repo/feature-id`) to related slices in registered repositories
- `related_files`: optional non-owning mentions (`repo:relative/path`) of files in registered repositories;
  cross-repository files never belong in this book's `core_files`

## Choosing a book type

- Use `type: feature` for a user-facing capability or business workflow with a clear product owner.
- Use `type: api` for a transport/API contract and the lifecycle of that API boundary.
- Use `type: state` for shared application state and its transitions, following project convention.
- Use `type: shared` for a technical capability or contract consumed by multiple features when no
  single feature should own it.

Keep a capability in its feature book while it has only one feature consumer. Do not pre-emptively
extract it. Consider a shared book when a second consumer appears or a genuine cross-feature
contract and ownership boundary forms.

## Shared books — `shared/`

`.feature-books/shared/` stores knowledge books for cross-feature capabilities, infrastructure,
conventions, and technical contracts. Good candidates include internal/project-wide libraries,
shared UI or interaction patterns, date/time/timezone/locale contracts, authentication and
permission primitives, cross-feature formatting/validation/serialization, frontend engineering
conventions, multi-feature third-party adapters or forks, and generated-code or platform-level
integration contracts.

Shared is not a catch-all for utilities or code with no obvious home. Reuse across files alone does
not justify it. Do not move feature-specific business logic into shared merely to reduce duplication,
claim another book's files without changing and documenting ownership, or create an abstraction
before it has a cross-feature consumer.

A shared book must:

1. Define the technical contract and invariants every consumer follows.
2. Own its capability files through `core_files`, without ambiguous overlapping claims.
3. Document supported public entry points and the consumer boundary.
4. Link upstream dependencies and downstream consumers with bidirectional `depends_on` / `impacts`.
5. Record material constraints, known risks, rejected alternatives, and upgrade considerations.
6. Be the source of truth for changes whose blast radius crosses feature boundaries.
7. Keep its Change Log synchronized with implementation changes.

Expected shared frontmatter uses the normal Feature Books schema:

```yaml
---
id: shared-<capability-name>
type: shared
status: draft
last_reviewed: YYYY-MM-DD
core_files:
  - path/to/owned/file
depends_on:
  - "[[shared-or-api-id]]"
impacts:
  - "[[feat-consumer-a]]"
  - "[[feat-consumer-b]]"
related_states: []
---
```

If a shared book impacts a feature, that feature must depend on the shared book. Recommended body
sections are Overview, Responsibilities, Public Contract, Business/Technical Rules, Consumers,
Constraints and Known Risks, Extension or Upgrade Guide, Verification, and Change Log. Headings may
vary, but ownership, contract, consumers, and verification must remain explicit. Avoid volatile
implementation detail unless it supports a durable technical contract.

When changing a shared capability: read its book plus first-degree `depends_on`/`impacts`; confirm
`core_files` ownership; update implementation and tests; update its Change Log; run `diff-impact.mjs`
and `graph-lint.mjs`; report downstream features that need testing; and add reciprocal relations for
each new consumer. Never finish a shared change without checking downstream impacts.

## Tasks (issue cards) — `tasks/`
Separate from feature books, but same vault. Each card is a note with its own schema (`id`, `title`,
`kind`: feature|enhancement|bug|note, `status`, `effort`: S|M|L|XL, `related`: `"[[feat-x]]"` links,
`created`), plus optional `capability` for workspace aggregation and a body (`## Description`,
`## Logic Spec / Steps` for feature/enhancement cards, `## Triage Notes`). A card moves physically
through lifecycle folders:
- `tasks/issues/` — new, untriaged. Created manually with `/fb-task`, whenever you (or the user)
  spot something that needs doing.
- `tasks/decisions/` — triaged. `/fb-triage` reads **every card physically in `tasks/issues/`** —
  including ones hand-created directly in Obsidian with no or partial frontmatter, not just ones
  made via `/fb-task` — normalizes it to the standard schema (inferring `id`/`title`/`kind`/`created`
  and preserving the author's original prose rather than discarding it), links it to related feature
  books, estimates effort, sets `status: triaged`, and moves it here.
- `tasks/backlog/` — accepted for later (`status: backlog`), but not currently scheduled or blocked.
- `tasks/hold/` — accepted work that cannot proceed (`status: hold`). Require `hold_reason`,
  `resume_when`, and `held_at` so the pause has an explicit, reviewable exit condition.
- `tasks/action/` — confirmed. The user drags a card here themselves once they decide to act on it.
  Nothing automated does this move — update `status: in-progress` to match when you see one land here.
- `tasks/done/` — completed. The user drags it here themselves when the work is finished — update
  `status: done` to match.
- `tasks/cancelled/` — intentionally closed without completion (`status: cancelled`). Require
  `cancellation_reason` and `cancelled_at`; cancelled is terminal but is not equivalent to done.

`fb-tasks-lint.mjs` (deterministic, no AI) checks that a card's `status` field matches which of
these folders it's physically in, validates hold/cancellation metadata, and flags drift after a manual drag.

## Available workflows

Interpret requests such as "initialize Feature Books", "run fb-impact", or "create a task
for X" as the corresponding workflow below, on any runtime — recognize the intent from natural
language and run the matching script yourself. Codex users can also invoke it explicitly as
`$feature-books`, and Claude Code users can also type the slash-command spelling shown here, but
neither is required:

- `/fb-init` — bootstrap a new project with `.feature-books/` skeleton + Obsidian graph colors + appearance
- `/fb-fix` — restore Obsidian graph colors/appearance and re-stamp the vault version
- `/fb-version` — check the vault's stamped version against the installed plugin (deterministic, also runs automatically at session start)
- `/fb-new` — create a new feature book (proper frontmatter + bidirectional relations)
- `/fb-impact` — analyze git diff blast radius (owning features → downstream impacts)
- `/fb-sync` — find source files not covered by any feature's `core_files` fence
- `/fb-config` — get/set the content language (stored in `.fbconfig.json`)
- `/fb-workspace-init` — create a derived Obsidian portal and manifest for a multi-repository workspace
- `/fb-workspace-fix` — restore workspace graph colors, appearance, and the generated Dataview dashboard
- `/fb-workspace-sync` — refresh only repositories registered in the workspace manifest
- `/fb-workspace-status` — show vault coverage, tasks, and local current-focus state
- `/fb-workspace-focus` — set or clear the active repository/features/task used for context selection
  (or focus every repository slice of one capability with `--capability <slug>`)
- `/fb-learn-pr` — fetch PR review discussion, verify it against implementation, and propose or
  apply durable knowledge updates; no argument resolves the current branch PR, while `--latest`
  and `--auto` discover merged PRs not present in the checkpoint
- `/fb-claim <file-path> <feature-id> [--glob]` — claim a file under a feature's fence (auto-add to core_files)
- `/fb-task` — create a new task/issue card in `tasks/issues/`
- `/fb-triage` — process the task inbox: format, link to feature books, estimate effort, move to `tasks/decisions/`

For deterministic workflows, run the matching script in `<plugin-root>/scripts/`. For the
judgment-heavy `fb-spec-new`, `fb-learn-pr`, `fb-task`, and `fb-triage` workflows, first read the corresponding
file under `<plugin-root>/commands/` completely and follow it. Treat `$ARGUMENTS` in those legacy
command files as the user's natural-language input in Codex.

## Helper scripts (run via node)
All commands above run these scripts under the hood; you can also call them directly:
- `node "<plugin-root>/scripts/graph-lint.mjs"` — check bidirectional relations + links to non-existent ids
- `node "<plugin-root>/scripts/diff-impact.mjs"` — map git diff → owning features → summarize blast radius
- `node "<plugin-root>/scripts/fb-new.mjs" <type> <id>` — create a feature book (validates, links, lints)
- `node "<plugin-root>/scripts/fence-check.mjs" <file>` — which feature's fence a file belongs to (also runs automatically before edit/write via the PreToolUse hook)
- `node "<plugin-root>/scripts/fb-autobook.mjs"` — runs automatically on the `Stop` hook: if changed code isn't reflected in its feature book (stale Change Log, missing lifecycle decision, or new-feature orphan), continues the turn with what to update (loop-guarded; disable with `FB_AUTOBOOK=0`)
- `node "<plugin-root>/scripts/fb-claim.mjs" <file-path> <feature-id> [--glob]` — claim a file under a feature's fence
- `node "<plugin-root>/scripts/fb-fix.mjs"` — force-restore Obsidian graph colors/appearance and re-stamp the vault version
- `node "<plugin-root>/scripts/fb-version-check.mjs" [check]` — compare the vault's stamped version against the installed plugin
- `node "<plugin-root>/scripts/fb-workspace.mjs" <init|fix|sync|status|focus|clear-focus>` — manage a multi-repo portal while preserving repo-local source-of-truth vaults
- `node "<plugin-root>/scripts/fb-learn-pr.mjs" context|record ...` — resolve PR-learning context
  and persist the idempotency/provenance checkpoint; fetching and knowledge judgment remain AI work
- `node "<plugin-root>/scripts/fb-tasks-list.mjs" [--inbox] [--json]` — list task/issue cards
- `node "<plugin-root>/scripts/fb-tasks-lint.mjs"` — check task card schema + folder/status consistency

> Note: Codex and Claude Code load lifecycle hooks from `hooks/hooks.json`. Codex requires users to
> review and trust non-managed plugin hooks before they run. OpenCode exposes the same scripts as
> native tools via `src/index.ts`; the scripts remain the shared source of truth.
