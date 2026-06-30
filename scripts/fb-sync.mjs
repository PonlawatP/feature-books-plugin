#!/usr/bin/env node
// Find source files not covered by any feature book's core_files fence.
// Usage: node fb-sync.mjs [glob]   (default: src/**/*.ts)
import { loadNotes, globToRegExp, findVaultDir } from "./_lib.mjs";
import { globSync } from "node:fs";
import path from "node:path";

const vault = findVaultDir();
if (!vault) { console.error("✗ Could not find .feature-books/ (run from inside the repo)"); process.exit(1); }

const scanGlob = process.argv[2] || "src/**/*.ts";
const repoRoot = path.dirname(vault);

const notes = loadNotes(vault);
const fencePatterns = notes.flatMap(n => (n.core_files || []).map(g => globToRegExp(g)));

const allFiles = globSync(scanGlob, { cwd: repoRoot, nodir: true });

const orphans = allFiles.filter(f => !fencePatterns.some(re => re.test(f.replace(/\\/g, "/"))));

console.log(`Scanned ${allFiles.length} files against ${notes.length} feature books\n`);
if (orphans.length === 0) {
  console.log("✓ All scanned files are inside at least one feature's fence");
} else {
  console.log("⚠ Orphan files (no feature book owns them):");
  orphans.forEach(f => console.log(`  ? ${f}`));
  console.log("\nTip: use fb-new to create a feature book for orphans, or update core_files in an existing book.");
}
