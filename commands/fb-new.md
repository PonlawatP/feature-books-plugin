---
description: Create a new Feature Book from a template under .feature-books/
argument-hint: <type> <id> e.g. feature feat-wishlist
---

Create a new Feature Book from the input: `$ARGUMENTS`

Steps:
1. Parse the argument into `<type>` (feature|state|shared|api) and `<id>` (kebab-case).
   - If incomplete, ask the user briefly first.
   - Verify `id` starts with the correct prefix for its type (feat-/state-/shared-/api-).
2. Choose the target folder by type: features/ states/ shared/ apis/.
3. If a file with that id already exists → stop and report it; do not overwrite.
4. Create `.feature-books/<folder>/<id>.md` using the frontmatter + body structure from the spec
   (see the feature-books skill). Leave unknown values as empty lists.
   **Write all content in the language from `.feature-books/.fbconfig.json` (default English).**
5. If the user specifies `depends_on`/`impacts` → add the reciprocal relation in the target nodes
   so the relationships stay bidirectional.
6. Finish by running `node "${CLAUDE_PLUGIN_ROOT}/scripts/graph-lint.mjs"` and report the result.
