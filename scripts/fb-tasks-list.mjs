#!/usr/bin/env node
// List task/issue cards under tasks/. Pure deterministic listing (frontmatter read only) — used by
// /fb-triage to reliably find every untriaged card instead of relying on the model to glob for them.
// Usage:
//   node fb-tasks-list.mjs               -> list every card, all stages
//   node fb-tasks-list.mjs new           -> filter by any task status
//   node fb-tasks-list.mjs --inbox       -> everything physically in tasks/issues/, regardless of
//                                            its status field or whether it even has frontmatter —
//                                            this is what /fb-triage uses, so a card created by
//                                            hand directly in Obsidian (no/partial frontmatter) is
//                                            still picked up, not just ones made via /fb-task
//   node fb-tasks-list.mjs --json [...]  -> machine-readable output (combine with either mode above)
import { loadTasks, findVaultDir } from "./_lib.mjs";

const vault = findVaultDir();
if (!vault) { console.error("✗ Could not find .feature-books/ (run from inside the repo)"); process.exit(1); }

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const inbox = args.includes("--inbox");
const statusFilter = args.find((a) => !a.startsWith("--"));

let tasks = loadTasks(vault);
if (inbox) tasks = tasks.filter((t) => t.folder === "issues");
else if (statusFilter) tasks = tasks.filter((t) => t.status === statusFilter);

if (asJson) {
  console.log(JSON.stringify(tasks, null, 2));
  process.exit(0);
}

const label = inbox ? "in tasks/issues/ (inbox)" : statusFilter ? `with status "${statusFilter}"` : "";
if (!tasks.length) {
  console.log(`No task cards found${label ? " " + label : ""}`);
  process.exit(0);
}

console.log(`${tasks.length} task card(s)${label ? " " + label : ""}:\n`);
for (const t of tasks) {
  const flags = [!t.hasFrontmatter ? "no-frontmatter" : t.needsNormalization ? "needs-normalization" : null].filter(Boolean);
  console.log(`  ${t.id} [${t.folder}/${t.status || "?"}${t.effort ? `/${t.effort}` : ""}]${flags.length ? ` (${flags.join(", ")})` : ""} "${t.title || "(no title)"}" — ${t.file}`);
}
