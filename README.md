# Feature Books (Claude Code + OpenCode plugin)

A knowledge graph of business logic and each feature's code "fence", stored as an Obsidian vault
in every project at `.feature-books/`. It lets the AI read the relevant context before editing
code and warns about the blast radius to reduce regression bugs.

**Important:** the plugin installs globally, but the `.feature-books/` data always lives in each repo,
because every script resolves the vault from the current working directory (cwd) upward — not from
where the plugin is installed.

**Language:** feature book content defaults to **English**, configurable per project. Change it with `/fb-config set <language>` (stored in `.feature-books/.fbconfig.json`); the new language applies from the next run onward and existing books are not retranslated.

## What you get

- **Skill** `feature-books` — teaches Claude to load a feature book 1 hop before editing, respect the fence, and update the Change Log
- **Commands**: `/fb-init` (bootstrap a new project + seed graph colors), `/fb-new`, `/fb-impact`, `/fb-sync`, `/fb-config` (set content language)
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
The plugin and skill work globally. Run these commands once:

```bash
# 1. Copy the plugin to global OpenCode plugins
cp .opencode/plugins/feature-books.ts ~/.config/opencode/plugins/

# 2. Copy scripts to a known location
cp -r scripts ~/.config/opencode/feature-books-scripts/

# 3. Set env var so the plugin finds scripts (add to your shell profile)
export FEATURE_BOOKS_SCRIPTS="$HOME/.config/opencode/feature-books-scripts"
# Windows PowerShell: [Environment]::SetEnvironmentVariable("FEATURE_BOOKS_SCRIPTS", "$env:USERPROFILE\.config\opencode\feature-books-scripts", "User")

# 4. Link the skill so OpenCode loads it
ln -s "$PWD/skills/feature-books" ~/.claude/skills/feature-books
# Windows: New-Item -ItemType Junction -Path ~\.claude\skills\feature-books -Target "$PWD\skills\feature-books"
```

> **Alternative**: For per-project use, copy `.opencode/` + `scripts/` into each project. The plugin auto-discovers `../../scripts` relative to its own location.

## Get started in a project
Run inside the target repo:

### Claude Code
```bash
/fb-init            # create .feature-books/ + seed Obsidian graph colors (no manual setup)
/fb-new feature feat-login
```

### OpenCode
Prompt the AI to call the tools:
- `use fb-init tool` to bootstrap
- `use fb-new tool` to create a feature book
- `use fb-impact tool` to analyze blast radius

Open the `.feature-books/` folder as an Obsidian vault (install the **Dataview** community plugin for the table in `_index.md`).

## Note on migrating from standalone `.claude/`
A standalone `.claude/` registers hooks only via `settings.json` — `.claude/hooks/hooks.json` will not fire.
When used as a **plugin**, the `hooks/hooks.json` location is correct and the hook works on its own.
So once installed as a plugin, remove the old command/skill co