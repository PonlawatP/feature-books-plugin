---
description: Bootstrap Feature Books in a new project (create the vault skeleton + seed Obsidian graph colors)
argument-hint: [targetDir]
---

Call the `fb-init` tool to bootstrap Feature Books: $ARGUMENTS

If the user provides a target directory, pass it as `targetDir`. If they want to overwrite existing files, pass `force: true`.
If no target directory is given, use the current project root.
Report the result to the user, then suggest the next step: create the first feature book with `/fb-new`.
