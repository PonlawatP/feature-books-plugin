---
description: Analyze the blast radius of the current code change (git diff → features → impacts)
---

Analyze the impact of the changes currently pending.

Steps:
1. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/diff-impact.mjs"` to map changed files → owning features → their `impacts`.
2. Summarize for the user in plain language:
   - Which features this change touches
   - Which downstream features (impacts) should be tested/re-verified
   - Whether any changed file is not inside any feature's fence (a missed-coverage risk)
3. If there are orphan files → suggest creating/updating a feature book with `/fb-new`.
