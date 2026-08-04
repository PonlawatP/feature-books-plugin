---
description: Analyze the blast radius of the current code change (git diff → features → impacts)
---

Analyze the impact of the changes currently pending.

1. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/diff-impact.mjs"` to map changed files → owning books → their `impacts`.
2. If a touched owner is `type: shared`, read it and its first-degree `depends_on`/`impacts`, confirm
   its `core_files` ownership, and treat every downstream feature as an explicit verification target.
3. Read the output and summarize for the user in plain language:
   - Which books this change touches
   - Which downstream features (impacts) should be tested/re-verified
   - Whether any changed file is not inside any feature's fence (a missed-coverage risk)
4. If there are orphan files, suggest creating/updating a feature book with `/fb-new`. If a new
   shared consumer exists, require both `shared.impacts` and the consumer's reciprocal `depends_on`.
