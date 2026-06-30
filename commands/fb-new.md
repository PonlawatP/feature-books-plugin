---
description: Create a new Feature Book from a template under .feature-books/
argument-hint: <type> <id> e.g. feature feat-wishlist
---

Call the `fb-new` tool with the parsed input: $ARGUMENTS

Parse the arguments:
- `<type>` (feature | state | shared | api)
- `<id>` (kebab-case, must start with matching prefix: feat- / state- / shared- / api-)
- Optional: title, depends_on, impacts, core_files, related_states

If the user is missing required fields, ask them briefly first.
Verify the `id` prefix matches the `type`. Write all content in the language from `.feature-books/.fbconfig.json` (default English).
After creation, report the file path and run graph-lint. Then suggest the user open the file to fill in Business Rules.
