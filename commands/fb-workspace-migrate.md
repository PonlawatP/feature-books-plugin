---
description: Host repository-local Feature Books vaults inside the workspace portal and link each repo back
---

# Feature Books Workspace Migrate

Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/fb-workspace.mjs" migrate [--dry-run]` from anywhere below
an initialized workspace.

For every registered repository that has a real `.feature-books/` vault, this moves the vault content
into `.feature-books-workspace/repos/<repo>/` and replaces the repository-local vault with a symlink
back to the hosted copy. The vault content is then tracked by the workspace repository instead of
each child repository (which keeps `.feature-books/` gitignored), while repository-local tools still
resolve the vault through the symlink.

- Repos whose content is already hosted (with a valid repo symlink) are reported as `hosted` and left
  alone; a hosted repo whose symlink is missing gets the symlink recreated.
- Conflicting layouts (content in both places, or a repo symlink pointing elsewhere) abort the run —
  resolve them manually first.
- Use `--dry-run` to preview the plan without changing anything.
