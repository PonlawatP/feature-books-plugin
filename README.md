# Feature Books (Claude Code plugin)

A knowledge graph of business logic and each feature's code "fence", stored as an Obsidian vault
in every project at `.feature-books/`. It lets Claude read the relevant context before editing
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

### Test locally (local marketplace)
```bash
/plugin marketplace add ./feature-books-plugin
/plugin install feature-books@ponlawatp
```

### Use globally via GitHub
Push this folder to a repo (e.g. `ponlawatp/feature-books`), then:
```bash
/plugin marketplace add ponlawatp/feature-books
/plugin install feature-books@ponlawatp
```
Install once and use it across all projects. Then in each project run `/fb-init` to create `.feature-books/`.

## Get started in a project
```bash
/fb-init            # create .feature-books/ + seed Obsidian graph colors (no manual setup)
/fb-new feature feat-login
```
Open the `.feature-books/` folder as an Obsidian vault (install the **Dataview** community plugin for the table in `_index.md`).

## Note on migrating from standalone `.claude/`
A standalone `.claude/` registers hooks only via `settings.json` — `.claude/hooks/hooks.json` will not fire.
When used as a **plugin**, the `hooks/hooks.json` location is correct and the hook works on its own.
So once installed as a plugin, remove the old command/skill co