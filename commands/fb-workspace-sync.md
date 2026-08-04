---
description: Refresh the registered Feature Books workspace catalog and Obsidian dashboard
---

# Feature Books Workspace Sync

Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/fb-workspace.mjs" sync` from anywhere below an initialized
workspace. Read only the repositories already listed in `.feature-books-workspace/workspace.json`;
do not rediscover or scan unrelated directories.

