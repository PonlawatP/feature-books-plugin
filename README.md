# Feature Books (Claude Code + OpenCode plugin)

A knowledge graph of business logic and each feature's code "fence", stored as an Obsidian vault
in every project at `.feature-books/`. It lets the AI read the relevant context before editing
code and warns about the blast radius to reduce regression bugs.

**Important:** the plugin installs globally, but the `.feature-books/` data always lives in each repo,
because every script resolves the vault from the current working directory (cwd) upward — not from
where the plugin is installed.

**Language:** feature book content defaults to **English**, configurable per project. Change it with `/fb-config set <language>` (stored in `.feature-books/.fbconfig.json`); the new language applies from the next run onward and existing books are not retranslated.

## What you get

- **Skill** `feature-books` — teaches the AI to load a feature book 1 hop before editing, respect the fence, and update the Change Log
- **Commands / Tools**: `/fb-init` (bootstrap a new project + seed graph colors + appearance), `/fb-fix` (restore graph colors/appearance if they drift or reset, re-stamp version), `/fb-version` (check vault version vs installed plugin), `/fb-new`, `/fb-impact`, `/fb-sync`, `/fb-config` (set content language), `/fb-claim` (add a file to a feature's fence), `/fb-task` (create a task/issue card), `/fb-triage` (process the task inbox) — usable via `use <tool>` in OpenCode or `/<command>` in Claude Code
- **Hooks** (all plain deterministic scripts — no AI/LLM call in any of them):
  - `SessionStart` — `fb-version-check` compares the vault's stamped version against the installed plugin, every time work starts in a repo
  - `PreToolUse` on Edit/Write/MultiEdit — `fence-check` warns when about to edit a file outside a feature's fence
  - `PostToolUse` on Edit/Write/MultiEdit — `fb-staleness-check` reports which feature's fence (or which tasks/ stage) the just-edited file belongs to, so keeping Feature Books current after an edit doesn't rely on the model remembering to check
  - `Stop` (Claude Code only) — `fb-autobook` blocks the turn from ending if changed code isn't reflected in its owning Feature Book (stale Change Log or a new, unclaimed feature); loop-guarded, disable with `FB_AUTOBOOK=0`
- **Scripts**: `graph-lint`, `diff-impact`, `fence-check`, `fb-init`, `fb-fix`, `fb-new`, `fb-claim`, `fb-autobook`, `fb-version-check`, `fb-staleness-check`, `fb-tasks-list`, `fb-tasks-lint` (Node ≥ 16, no dependencies)

## Install

### Claude Code (via plugin marketplace)
```bash
/plugin marketplace add ./feature-books-plugin
/plugin install feature-books@ponlawatp
```

Or from GitHub:
```bash
/plugin marketplace add ponlawatp/feature-books
/plugin install feature-books@ponlawatp
```

### OpenCode

#### From npm (easiest — once published)

```json
// opencode.json
{
  "plugin": ["@ponlawatp/feature-books"]
}
```

OpenCode auto-installs it at startup. No file copying needed.
The `scripts/` are bundled in the npm package and found automatically.
Skills are auto-discovered from the package too.

**Before publishing**, run:
```bash
npm run build        # compile src/index.ts -> dist/index.js
npm publish          # publish to npm
```

#### Per-project (auto-discovery)

Run `scripts/install-opencode.mjs` inside the target project:
```bash
node ../feature-books-plugin/scripts/install-opencode.mjs
```

This copies `.opencode/plugins/feature-books.ts` + `scripts/` into the project
and links the skill to `~/.claude/skills/feature-books`. The plugin is
auto-discovered because it lives in `.opencode/plugins/`.

#### Global install (one-time, works in every project)

```bash
# 1. Clone the repo to a fixed location (e.g. home dir)
git clone https://github.com/PonlawatP/feature-books-plugin ~/feature-books-plugin

# 2. Set env var so the plugin finds scripts (add to shell profile)
export FEATURE_BOOKS_SCRIPTS="$HOME/feature-books-plugin/scripts"
# Windows PowerShell:
# [Environment]::SetEnvironmentVariable("FEATURE_BOOKS_SCRIPTS", "$env:USERPROFILE\feature-books-plugin\scripts", "User")

# 3. Link the skill (OpenCode auto-loads from ~/.claude/skills/)
ln -s ~/feature-books-plugin/skills/feature-books ~/.claude/skills/feature-books
# Windows:
# New-Item -ItemType Junction -Path ~\.claude\skills\feature-books -Target ~\feature-books-plugin\skills\feature-books
```

Then add to each project's `opencode.json`:
```json
{
  "plugin": ["file:///Users/you/feature-books-plugin/.opencode/plugins/feature-books.ts"]
}
```

#### Quick project reference (no copy)

If the plugin repo is cloned alongside your project:
```json
{
  "plugin": ["../feature-books-plugin/.opencode/plugins/feature-books.ts"]
}
```

Scripts are resolved automatically via `FEATURE_BOOKS_SCRIPTS` env var or by
finding them relative to the plugin file.

## Get started in a project

Run inside the target repo:

### OpenCode
Ask the AI:
- `use fb-init tool` to bootstrap the `.feature-books/` vault (+ graph colors, appearance, tasks/ kanban)
- `use fb-new tool` to create a feature book
- `use fb-impact tool` to analyze blast radius
- `use fb-claim tool` to add a file to a feature's fence

### Claude Code
```bash
/fb-init
/fb-new feature feat-login
```

Open the `.feature-books/` folder as an Obsidian vault (install the **Dataview**
community plugin for the tables in `_index.md`).

**Appearance:** `/fb-init` also seeds `.feature-books/.obsidian/appearance.json` with the project's fonts
(`Noto Sans,Noto Sans Thai Looped` for interface/text, `Noto Sans Mono,Noto Sans Thai Looped` for monospace)
and accent color (`#5cf58f`). If the graph colors or appearance ever drift, get reset, or get hand-edited
away from spec, run `/fb-fix` — unlike `/fb-init`, it always overwrites both files back to these defaults.

**Staying current:** `/fb-init` stamps `.feature-books/.fbconfig.json` with the plugin version at bootstrap
time. A `SessionStart` hook checks that stamp against the installed plugin every time work begins in a
repo and warns (via plain script, not AI) if the vault is out of date — run `/fb-fix` to clear the warning.
Separately, a `PostToolUse` hook fires after every edit and reports which feature's fence the file
belongs to, so the model is told — deterministically, every time — to update that Feature Book's Change
Log/`core_files`/`impacts` before finishing, rather than relying on it to remember on its own.

**Enforced automatically (Claude Code):** a `Stop` hook (`fb-autobook`) runs when a turn finishes. If
changed code isn't reflected in its owning book's Change Log for today — or belongs to no book at all
(a new feature) — it blocks the turn from ending and hands back exactly what to update. Disable with
`FB_AUTOBOOK=0`.

## Tasks (issue cards)

`.feature-books/tasks/` is a lightweight kanban for things you spot along the way — a card per
issue/feature/enhancement, with a `kind` (feature/enhancement/bug/note), `status`, `effort`
(S/M/L/XL), `related` feature-book links, and — for feature/enhancement cards — a Logic Spec/Steps
section. Cards are notes in the same Obsidian vault, so they show up (and link) in Graph View too.

```bash
/fb-task feature "Add CSV export to the reports page"   # creates tasks/issues/task-add-csv-export...
/fb-triage                                               # AI reads the inbox, links it to feature
                                                          # books, estimates effort, moves it to
                                                          # tasks/decisions/
```

Most cards, in practice, get created by hand directly in Obsidian rather than via `/fb-task` — just
drop a note into `tasks/issues/` with whatever frontmatter (or none at all) and let `/fb-triage`
normalize it: it infers `id`/`title`/`kind`/`created` from the content and filename, preserves the
author's original prose instead of discarding it, and only asks the user when a card is too sparse
to make sense of at all.

The 4 stages are physical folders: `issues/` (new) → `decisions/` (triaged by `/fb-triage`) →
`action/` (you drag it here once you confirm you're working on it) → `done/` (you drag it here once
it's finished). Only the `issues/` → `decisions/` move is automated; the other two are manual by
design. `fb-tasks-lint` (deterministic, no AI) flags a card whose `status` field doesn't match the
folder it's actually sitting in, which catches a manual drag that forgot to update the frontmatter.

## Notes

- A standalone `.claude/` registers hooks only via `settings.json` — `.claude/hooks/hooks.json` will not fire there. When used as a **Claude Code plugin**, the hook location is correct.
- OpenCode hooks live inside the plugin code (`tool.execute.before`), so the `hooks/hooks.json` is ignored by OpenCode — kept only for Claude Code compatibility. The `Stop`-hook `fb-autobook` behavior is exposed to OpenCode via its own `--report` mode for the plugin's `session.idle` handler.
- The tools (fb-init, fb-new, fb-claim, etc.) are available as native OpenCode tools that the AI can call directly without slash commands.

---

## Development — REMINDER: Keep both platforms in sync

This plugin targets **Claude Code** (primary) and **OpenCode**. Every change must touch all layers:

| Layer | Claude Code | OpenCode |
|-------|-------------|----------|
| Plugin entry | `.claude-plugin/plugin.json` | `src/index.ts` → `dist/index.js` (npm), `.opencode/plugins/feature-books.ts` (local dev) |
| Hooks | `hooks/hooks.json` (SessionStart/PreToolUse/PostToolUse/Stop → scripts) | Plugin `tool.execute.before` / `session.idle` (`src/index.ts` + `.opencode/plugins/feature-books.ts`) |
| Scripts | `scripts/*.mjs` (shared, same files) | `scripts/*.mjs` (shared, same files) |
| Skill | `skills/feature-books/SKILL.md` (shared) | `skills/feature-books/SKILL.md` (shared) |
| Tools | Slash commands (via scripts) | Native tools in plugin code |

**Rule:** always edit `src/index.ts` AND `.opencode/plugins/feature-books.ts` in parallel, then rebuild (`npm run build`). The scripts + skill live in one place and are shared — no extra sync needed there.
