#!/usr/bin/env node
// Check which feature's fence a to-be-edited file belongs to — use as a PreToolUse hook or call directly.
// Advisory by default (does not block); set FENCE_STRICT=1 to block (exit 2).
import { hookTargetFiles, loadNotes, ownersOf, readHookPayload, repoRelativePath } from "./_lib.mjs";

const STRICT = process.env.FENCE_STRICT === "1";
const arg = process.argv[2];
const payload = arg ? null : await readHookPayload();
const isHook = !!payload;
const files = arg ? [arg] : hookTargetFiles(payload);
if (!files.length) process.exit(0);
const notes = loadNotes();
const messages = [];
let hasOrphan = false;
for (const file of files) {
  const rel = repoRelativePath(file, payload?.cwd || process.cwd());
  if (rel.startsWith(".feature-books/") || rel.startsWith(".claude/") || rel.startsWith(".codex/")) continue;
  const owners = ownersOf(rel, notes);
  if (owners.length) {
    const ids = owners.map((o) => o.id).join(", ");
    const impacts = [...new Set(owners.flatMap((o) => o.impacts))];
    messages.push(`[feature-books] ${rel} is inside the fence of: ${ids}.`);
    if (impacts.length) messages.push(`[feature-books] Watch for impact on: ${impacts.join(", ")}.`);
  } else {
    hasOrphan = true;
    messages.push(`[feature-books] ⚠ "${rel}" is not in any feature's core_files — consider claiming it or confirm the edit is intentional.`);
  }
}
if (!messages.length) process.exit(0);
const message = messages.join("\n");
if (!isHook) {
  console.error(message);
  process.exit(STRICT && hasOrphan ? 2 : 0);
}
if (STRICT && hasOrphan) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: message,
    },
  }));
} else {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: message },
  }));
}
process.exit(0);
