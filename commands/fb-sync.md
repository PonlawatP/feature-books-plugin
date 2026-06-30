---
description: Find code files under src/ not covered by any feature book's core_files
argument-hint: [glob to scan, e.g. "src/**/*.ts"]
---

Call the `fb-sync` tool to find orphan files: $ARGUMENTS

If the user provides a glob, pass it as the `glob` argument. Otherwise use the default (`src/**/*.ts`).
Report the orphan files to the user. Do NOT change anything automatically — let the user decide how to handle them.
