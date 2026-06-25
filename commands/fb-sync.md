---
description: Find code files under src/ not covered by any feature book's core_files
argument-hint: [glob to scan, e.g. "src/**/*.ts"]
---

Find code files that have no owner in the Feature Books.

Steps:
1. Gather the `core_files` globs from every note in `.feature-books/`.
2. List the actual files under `src/` (or the glob the user provides: `$ARGUMENTS`).
3. Find files that match no feature's fence → report them as a list.
4. For orphan files that look important, suggest which feature book they should belong to, or create a new one.
5. Do not change anything automatically — report and let the user decide.
