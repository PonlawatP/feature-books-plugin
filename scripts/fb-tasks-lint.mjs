#!/usr/bin/env node
// Task card health check: required fields present, enum values valid, status matches the folder
// the card physically lives in (catches drift after a manual drag between tasks/ stages), and
// related links point to real feature-book ids. Deterministic — no AI/LLM call.
//
// tasks/issues/ is the inbox: cards there may be hand-created directly in Obsidian with no
// frontmatter at all, or an incomplete one — that's expected and NOT an error, it's what /fb-triage
// is for. Full schema compliance is only required once a card has actually been triaged, i.e. for
// anything in decisions/, action/, or done/.
import { loadTasks, loadNotes, findVaultDir, TASK_KINDS, TASK_STATUSES, TASK_EFFORTS, TASK_FOLDER_STATUS } from "./_lib.mjs";

const vault = findVaultDir();
if (!vault) { console.error("✗ Could not find .feature-books/ (run from inside the repo)"); process.exit(1); }

const tasks = loadTasks(vault);
const notes = loadNotes(vault);
const noteIds = new Set(notes.map((n) => n.id));

const errors = [];
const warnings = [];
const info = [];

for (const t of tasks) {
  const inInbox = t.folder === "issues";
  if (inInbox) {
    // Pre-triage: don't error on missing/invalid schema — just nudge that it's waiting.
    if (!t.hasFrontmatter) info.push(`${t.file}: no frontmatter yet (hand-created?) — run /fb-triage`);
    else if (t.needsNormalization) info.push(`${t.file}: incomplete frontmatter — run /fb-triage`);
  } else {
    // Triaged or beyond: full schema is mandatory.
    if (!t.title) errors.push(`${t.file}: missing "title"`);
    if (!TASK_KINDS.includes(t.kind)) errors.push(`${t.file}: kind "${t.kind}" is not one of ${TASK_KINDS.join("|")}`);
    if (!TASK_STATUSES.includes(t.status)) errors.push(`${t.file}: status "${t.status}" is not one of ${TASK_STATUSES.join("|")}`);
    if (t.effort && !TASK_EFFORTS.includes(t.effort)) errors.push(`${t.file}: effort "${t.effort}" is not one of ${TASK_EFFORTS.join("|")}`);
    if (!t.effort) warnings.push(`${t.file}: status is "${t.status}" but effort was never estimated (should have been set by /fb-triage)`);
  }

  // id should match filename regardless of triage state, same convention as feature books.
  const base = t.file.split("/").pop().replace(/\.md$/, "");
  if (t.id !== base) warnings.push(`${t.file}: id "${t.id}" does not match filename "${base}"`);

  const expected = t.folder ? TASK_FOLDER_STATUS[t.folder] : null;
  if (expected && t.status && t.status !== expected) {
    warnings.push(`${t.file}: lives in tasks/${t.folder}/ but status is "${t.status}" (expected "${expected}") — update the frontmatter after a manual drag`);
  }

  for (const rel of t.related) {
    if (!noteIds.has(rel)) warnings.push(`${t.id}: related link "[[${rel}]]" does not match any feature-book id`);
  }
}

console.log(`Checked ${tasks.length} task card(s) in tasks/\n`);
if (errors.length) { console.log("ERRORS:"); errors.forEach((e) => console.log("  ✗ " + e)); }
if (warnings.length) { console.log("\nWARNINGS:"); warnings.forEach((w) => console.log("  ⚠ " + w)); }
if (info.length) { console.log("\nINBOX (not yet triaged):"); info.forEach((i) => console.log("  · " + i)); }
if (!errors.length && !warnings.length && !info.length) console.log("✓ Tasks are consistent, no issues found");

process.exit(errors.length ? 1 : 0);
