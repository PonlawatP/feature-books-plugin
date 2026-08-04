---
description: Restore Obsidian graph colors + appearance (fonts/accent color) if they drift or get reset
argument-hint: "[targetDir]"
---

Restore the Feature Books Obsidian settings to their known-good defaults for this project.

Steps:
1. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/fb-fix.mjs" $ARGUMENTS`
   - Overwrites `.feature-books/.obsidian/graph.json` with the default color groups (features/states/shared/apis/tasks stages)
   - Overwrites `.feature-books/.obsidian/appearance.json` with the default fonts (Noto Sans / Noto Sans Thai Looped) and accent color (`#5cf58f`)
   - Re-stamps `.feature-books/.fbconfig.json` with the currently installed plugin's version (this is what clears the "vault version mismatch" warning from `/fb-version` and the SessionStart check)
   - Always overwrites — unlike `/fb-init`, there is no "skip if exists" here, since the point is to force these files back to spec
2. Report what was restored to the user, and remind them to reload the vault in Obsidian (Ctrl/Cmd+R) if colors don't refresh immediately.
