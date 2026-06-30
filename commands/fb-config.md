---
description: Get or set the language used when writing Feature Books (default English)
argument-hint: [get | set <language>]
---

Call the `fb-config` tool: $ARGUMENTS

Parse the arguments:
- `get` or no arguments → read current language
- `set <language>` → save it to `.feature-books/.fbconfig.json`
Tell the user the setting applies to feature books created/edited from the next run onward; it does not retroactively translate existing books.
