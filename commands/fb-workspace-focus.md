---
description: Set or clear the repository, features, and task currently in focus
---

# Feature Books Workspace Focus

Run one of:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/fb-workspace.mjs" focus <repo> [feature ...] [--task <id>] [--related <repo,repo>]
node "${CLAUDE_PLUGIN_ROOT}/scripts/fb-workspace.mjs" clear-focus
```

Focus is local transient memory stored in `.feature-books-workspace/state.local.json`. It guides
context selection but never changes repository-local Feature Books or their relationships.

