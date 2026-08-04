#!/usr/bin/env node
// Deterministic PostToolUse hook (Edit/Write/MultiEdit) — plain fence lookup against .feature-books/,
// no AI/LLM call. Fires unconditionally after every edit so keeping Feature Books current does not
// depend on the model remembering to check on its own.
import { loadNotes, ownersOf } from "./_lib.mjs";

async function getTargetFile() {
  const arg = process.argv[2];
  if (arg) return arg;
  if (process.stdin.isTTY) return null;
  let data = "";
  for await (const chunk of process.stdin) data += chunk;
  if (!data.trim()) return null;
  try {
    const json = JSON.parse(data);
    return json?.tool_input?.file_path || json?.tool_input?.path || null;
  } catch { return null; }
}

const file = await getTargetFile();
if (!file) process.exit(0);

const rel = file.replace(/\\/g, "/").replace(/^.*?(?=src\/|\.feature-books\/|\.claude\/)/, "");

if (rel.startsWith(".feature-books/tasks/")) {
  console.error(
    `[feature-books] Edited a task card (${rel}). Run fb-tasks-lint.mjs before finishing if you ` +
    `changed status/effort/related, or moved it between tasks/ stages.`
  );
  process.exit(0);
}

if (rel.startsWith(".feature-books/")) {
  console.error(
    `[feature-books] Edited a Feature Book note (${rel}). If depends_on/impacts/id changed, ` +
    `run graph-lint.mjs before finishing this task.`
  );
  process.exit(0);
}

if (rel.startsWith(".claude/")) process.exit(0);

const notes = loadNotes();
const owners = ownersOf(rel, notes);
if (owners.length) {
  const ids = owners.map((o) => o.id).join(", ");
  console.error(
    `[feature-books] Edited a file inside the fence of: ${ids}. ` +
    `Update that note's Change Log (and core_files/impacts if scope changed) before finishing this task — ` +
    `run diff-impact.mjs for the full blast radius.`
  );
} else {
  console.error(
    `[feature-books] Edited "${rel}", which is not inside any feature's fence. ` +
    `Run /fb-sync to confirm, or /fb-new to create/extend the owning feature book.`
  );
}
process.exit(0);
