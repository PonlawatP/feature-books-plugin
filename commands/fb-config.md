---
description: Get or set the language used when writing Feature Books (default English)
argument-hint: [get | set <language>]
---

Manage the Feature Books content language for this project.

Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/fb-config.mjs" $ARGUMENTS`:
- no args or `get` → prints the current language
- `set <language>` → saves it to `.feature-books/.fbconfig.json`

Then tell the user the setting applies to feature books created/edited from the **next run onward**; it does not retroactively translate existing books.
