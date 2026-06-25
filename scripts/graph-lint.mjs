#!/usr/bin/env node
// Graph health check: are relations bidirectional, do links point to real ids, does id match filename?
import { loadNotes, findVaultDir } from "./_lib.mjs";
import path from "node:path";

const vault = findVaultDir();
if (!vault) { console.error("✗ Could not find .feature-books/ (run from inside the repo)"); process.exit(1); }

const notes = loadNotes(vault);
const byId = new Map(notes.map((n) => [n.id, n]));
const errors = [];
const warnings = [];

for (const n of notes) {
  // id must match the filename
  const base = path.basename(n.file, ".md");
  if (n.id !== base) errors.push(`${n.file}: id "${n.id}" does not match filename "${base}"`);

  // links must point to existing nodes
  for (const dep of [...n.depends_on, ...n.impacts]) {
    if (!byId.has(dep)) errors.push(`${n.id}: references "[[${dep}]]" which does not exist`);
  }
  // bidirectional: A impacts B => B depends_on A
  for (const b of n.impacts) {
    const target = byId.get(b);
    if (target && !target.depends_on.includes(n.id))
      warnings.push(`${n.id} impacts ${b}, but ${b} does not list ${n.id} in depends_on (one-sided relation)`);
  }
  // A depends_on B => B impacts A
  for (const b of n.depends_on) {
    const target = byId.get(b);
    if (target && !target.impacts.includes(n.id))
      warnings.push(`${n.id} depends_on ${b}, but ${b} does not list ${n.id} in impacts (one-sided relation)`);
  }
}

console.log(`Checked ${notes.length} feature books in the vault\n`);
if (errors.length) { console.log("ERRORS:"); errors.forEach((e) => console.log("  ✗ " + e)); }
if (warnings.length) { console.log("\nWARNINGS:"); warnings.forEach((w) => console.log("  ⚠ " + w)); }
if (!errors.length && !warnings.length) console.log("✓ Graph is consistent, no issues found");

process.exit(errors.length ? 1 : 0);
