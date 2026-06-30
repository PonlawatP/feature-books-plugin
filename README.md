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
- **Tools**: `fb-init`, `fb-new`, `fb-impact`, `fb-sync`, `fb-config` (usable via `use <tool>` in OpenCode or `/<command>` in Claude Code)
- **Hook** (PreToolUse on Edit/Write) — `fence-check` warns when about to edit a file outside a feature's fence
- **Scripts**: `graph-lint`, `diff-impact`, `fence-check`, `fb-init` (Node ≥ 16, no dependencies)

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
- `use fb-init tool` to bootstrap the `.feature-books/` vault
- `use fb-new tool` to create a feature book
- `use fb-impact tool` to analyze blast radius

### Claude Code
```bash
/fb-init
/fb-new feature feat-login
```

Open the `.feature-books/` folder as an Obsidian vault (install the **Dataview**
community plugin for the table in `_index.md`).

## Notes

- A standalone `.claude/` registers hooks only via `settings.json` — `.claude/hooks/hooks.json` will not fire there. When used as a **Claude Code plugin**, the hook location is correct.
- OpenCode hooks live inside the plugin code (`tool.execute.before`), so the `hooks/hooks.json` is ignored by OpenCode — kept only for Claude Code compatibility.
- The tools (fb-init, fb-new, etc.) are available as native OpenCode tools that the AI can call directly without slash commands.
