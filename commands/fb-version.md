---
description: Check whether this repo's .feature-books/ vault matches the installed plugin version
---

Check the Feature Books vault version against the installed plugin.

Steps:
1. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/fb-version-check.mjs" check`
   - Deterministic check only (no AI reasoning): compares the version stamped in
     `.feature-books/.fbconfig.json` against the installed plugin's own `plugin.json` version.
   - This same check also runs automatically as a `SessionStart` hook every time work begins in
     this repo, so it's normally already been reported; this command re-runs it on demand.
2. Report the result verbatim to the user.
3. If it reports a mismatch or unknown version → tell the user to run `/fb-fix`, which restores
   the Obsidian graph colors/appearance and re-stamps the vault with the current version.
