#!/usr/bin/env node
// Deterministic PostToolUse hook (Edit/Write/MultiEdit) — plain fence lookup against .feature-books/,
// no AI/LLM call. Fires unconditionally after every edit so keeping Feature Books current does not
// depend on the model remembering to check on its own.
import { hookTargetFiles, loadNotes, ownersOf, readHookPayload, repoRelativePath } from "./_lib.mjs";

const arg = process.argv[2];
const payload = arg ? null : await readHookPayload();
const isHook = !!payload;
const files = arg ? [arg] : hookTargetFiles(payload);
if (!files.length) process.exit(0);
const notes = loadNotes();
const messages = [];
for (const file of files) {
  const rel = repoRelativePath(file, payload?.cwd || process.cwd());
  if (rel.startsWith(".feature-books/tasks/")) {
    messages.push(`[feature-books] Edited task card ${rel}. Run fb-tasks-lint.mjs before finishing if its metadata or stage changed.`);
  } else if (rel.startsWith(".feature-books/")) {
    messages.push(`[feature-books] Edited Feature Book ${rel}. Run graph-lint.mjs if graph metadata changed.`);
  } else if (!rel.startsWith(".claude/") && !rel.startsWith(".codex/")) {
    const owners = ownersOf(rel, notes);
    if (owners.length) {
      const ids = owners.map((o) => o.id).join(", ");
      messages.push(`[feature-books] Edited ${rel} inside the fence of ${ids}. Update its Change Log and run diff-impact.mjs before finishing.`);
    } else {
      messages.push(`[feature-books] Edited ${rel}, which is outside every feature fence. Use the feature-books workflow to sync, claim, or create its owner.`);
    }
  }
}
if (!messages.length) process.exit(0);
const message = messages.join("\n");
if (isHook) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: message },
  }));
} else console.error(message);
process.exit(0);
