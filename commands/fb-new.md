---
description: Create a new Feature Book from a template under .feature-books/
argument-hint: <type> <id> e.g. feature feat-wishlist
---

Create a new Feature Book from the input: `$ARGUMENTS`

1. Parse the argument into `<type>` (feature|state|shared|api) and `<id>` (kebab-case).
   - If incomplete, ask the user briefly first.
   - Optional fields: title, depends_on, impacts, core_files, related_states.
2. Run the script — it validates the prefix, refuses to overwrite, builds the frontmatter,
   writes bidirectional relations into the linked notes, and runs graph-lint:

   ```
   node "${CLAUDE_PLUGIN_ROOT}/scripts/fb-new.mjs" <type> <id> \
     [--title "..."] [--depends_on a,b] [--impacts a,b] \
     [--core_files glob,glob] [--related_states s1,s2]
   ```

   The script reads the content language from `.feature-books/.fbconfig.json` (default English)
   for the Business Rules placeholder.
3. Report the created file path and the graph-lint result. Then suggest the user open the file
   to fill in the **Business Rules** section.
