#!/usr/bin/env node
// Map git diff -> owning features -> summarize the blast radius (impacts)
import { execSync } from "node:child_process";
import { loadNotes, ownersOf, findRepoRoot } from "./_lib.mjs";

const repoRoot = findRepoRoot();
const notes = loadNotes();
const byId = new Map(notes.map((n) => [n.id, n]));

function changedFiles() {
  try {
    const out = execSync("git status --porcelain --untracked-files=all", { cwd: repoRoot })
      .toString().trim();
    if (!out) return [];
    return out.split("\n").map((l) => l.slice(3).trim()).filter(Boolean)
      .filter((f) => !f.startsWith(".feature-books/") && !f.startsWith(".claude/"));
  } catch {
    console.error("✗ Could not run git (not a git repo yet?)"); return null;
  }
}

const files = changedFiles();
if (files === null) process.exit(1);
if (!files.length) { console.log("No changed files — nothing to analyze"); process.exit(0); }

const touchedFeatures = new Set();
const orphans = [];
for (const f of files) {
  const owners = ownersOf(f, notes);
  if (!owners.length) orphans.push(f);
  else owners.forEach((o) => touchedFeatures.add(o.id));
}

console.log(`${files.length} changed file(s)\n`);
console.log("Features touched:");
const impacted = new Set();
for (const id of touchedFeatures) {
  const n = byId.get(id);
  console.log(`  • ${id} (${n.title})`);
  n.impacts.forEach((i) => impacted.add(i));
}
if (!touchedFeatures.size) console.log("  (no changed file matches any feature's fence)");

// Downstream features to verify (excluding the ones being edited)
const toCheck = [...impacted].filter((i) => !touchedFeatures.has(i));
console.log("\nShould test / re-verify (blast radius):");
if (toCheck.length) toCheck.forEach((i) => {
  const n = byId.get(i);
  console.log(`  → ${i}${n ? " (" + n.title + ")" : ""}`);
});
else console.log("  (no additional downstream)");

if (orphans.length) {
  console.log("\n⚠ Orphan files (not inside any feature's fence):");
  orphans.forEach((f) => console.log(`  ? ${f}`));
}
