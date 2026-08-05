---
description: Find code files under src/ not covered by any feature book's core_files
argument-hint: [glob to scan, e.g. "src/**/*.ts"]
---

Find code files that have no owner in the Feature Books.

1. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/fb-sync.mjs" $ARGUMENTS` (pass a glob to scan, e.g. `src/**/*.ts`; default is `src/**/*.ts`).
2. Report the orphan files to the user as a list.
3. For orphan files that look important, suggest which feature book they should belong to, or create a new one with `/fb-new`.
4. Do NOT change anything automatically — report and let the user decide.
