# Feature Books Governance Rules

This workspace uses **Feature Books** (stored in `.feature-books/`) as the authoritative knowledge graph of business logic, architectural boundaries, and code fences.

## 1. Before Editing Code (Read Context First)
- **Check for `.feature-books/`**: If this folder exists in the workspace, Feature Books rules apply unconditionally.
- **Find the owning book**: Match the files you plan to touch against the `core_files` fences in `.feature-books/features/` (or `shared/`, `api/`).
- **Read 1-hop only**: Load ONLY the owning feature book and its direct 1st-degree neighbors (`depends_on` and `impacts`). **DO NOT** read the entire vault or execute broad multi-file searches — this conserves token quota and keeps focus on the relevant feature.
- **Review Business Rules**: Understand the documented business rules and constraints before modifying code.

## 2. Respect Code Fences
- Only touch files inside the feature's `core_files`.
- If a change requires editing files outside the current feature's fence, verify whether they belong to another feature or represent a new capability that requires its own feature book.

## 3. After Editing Code (Mandatory Reconciliation)
Before finishing any turn that modified or created code files:
1. **Claim new files**: For any created or untracked file, add it to the owning feature's `core_files` (or run `node "<plugin-root>/scripts/fb-claim.mjs" <file> <feature-id>`).
2. **Update the Change Log**: In the owning feature book, add a dated row under `## Change Log`:
   `| YYYY-MM-DD | <summary of change>; status: <active|stable> |`
3. **Reconcile Lifecycle Status**: Update the frontmatter `status` (`active` if implementation is in progress, `stable` when complete).
4. **Verify Graph Consistency**: Run `node "<plugin-root>/scripts/graph-lint.mjs"` and ensure 0 errors.

A code modification task is **not complete** until the matching Feature Book reflects the code as it stands.
