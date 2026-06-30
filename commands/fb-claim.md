---
description: Add a file to a feature book's core_files fence
argument-hint: <file-path> <feature-id> [--glob]
---

Claim a file under a feature's ownership fence.

1. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/fb-claim.mjs" $ARGUMENTS` to add the file to the feature book's `core_files`.
2. The file path can be repo-relative or absolute. Use `--glob` to convert a file path to a directory glob (e.g. `src/foo/bar.ts` → `src/foo/**`).
3. Report the result to the user.
