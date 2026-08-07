---
description: Add a file to a feature book's core_files fence
argument-hint: <file-path> <feature-id> [--glob]
---

Claim a file under a feature's ownership fence.

1. Before running the script, apply the skill's **New capability vs. existing feature ownership**
   decision gate. Claim only when the file implements the same user-facing capability and business
   boundary already documented by the target book. Code proximity, reuse, or a relationship to the
   feature is not enough.
2. If the file implements a distinct capability, stop this workflow and create a new feature book;
   link it to the related existing book with `depends_on` / `impacts`. For mixed scopes, update the
   old book for its owned changes and create a new book for the new capability.
3. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/fb-claim.mjs" $ARGUMENTS` to add the file to the feature book's `core_files`.
4. The file path can be repo-relative or absolute. Use `--glob` to convert a file path to a directory glob (e.g. `src/foo/bar.ts` → `src/foo/**`).
5. Report the ownership reason and the result to the user.
