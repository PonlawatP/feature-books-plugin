---
description: Create a new Feature Book from a template under .feature-books/
argument-hint: <type> <id> e.g. feature feat-wishlist
---

Create a new Feature Book from the input: `$ARGUMENTS`

1. Parse the argument into `<type>` (feature|state|shared|api) and `<id>` (kebab-case).
   - If incomplete, ask the user briefly first.
   - Optional fields: title, depends_on, impacts, core_files, related_states.
   - Use `feature` for a user-facing capability or business workflow with a clear owner, `api` for
     a transport/API boundary, and `state` for shared application state and transitions.
   - Use `shared` only for a technical capability or contract consumed by multiple features when
     no one feature should own it. Keep a one-feature capability in that feature's book until a
     second consumer or real cross-feature contract exists; never use shared as a utility catch-all.
   - A distinct user-facing capability gets its own `feature` book even when it depends on, extends,
     or lightly changes an existing feature. Express that relationship with `depends_on` / `impacts`;
     do not merge capabilities merely because they share code or a page.
2. Run the script — it validates the prefix, refuses to overwrite, builds the frontmatter,
   writes bidirectional relations into the linked notes, and runs graph-lint:

   ```
   node "${CLAUDE_PLUGIN_ROOT}/scripts/fb-new.mjs" <type> <id> \
     [--title "..."] [--depends_on a,b] [--impacts a,b] \
     [--core_files glob,glob] [--related_states s1,s2]
   ```

   The script reads the content language from `.feature-books/.fbconfig.json` (default English).
   Shared books use the shared-capability template, including ownership, public contract,
   consumers, risks, upgrade guidance, verification, and Change Log sections.
3. Report the created file path and the graph-lint result. Then suggest the user open the file
   to complete its contract/rules sections. For shared books, verify multiple real consumers,
   unambiguous `core_files` ownership, and bidirectional consumer relations.
