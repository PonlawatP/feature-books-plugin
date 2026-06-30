---
description: Analyze the blast radius of the current code change (git diff → features → impacts)
---

Call the `fb-impact` tool to analyze the blast radius of changes currently pending.

Read the output and summarize for the user:
- Which features this change touches
- Which downstream features (impacts) should be tested/re-verified
- Whether any changed file is not inside any feature's fence (a missed-coverage risk)
If there are orphan files, suggest creating a feature book with `/fb-new`.
