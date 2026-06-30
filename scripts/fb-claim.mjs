#!/usr/bin/env node
// Add a file to a feature book's core_files fence.
// Usage: node fb-claim.mjs "<file-path>" <feature-id> [--glob]
//   --glob: convert file to directory glob (e.g. src/foo/bar.ts -> src/foo/**)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { findVaultDir, loadNotes } from "./_lib.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const filePath = process.argv[2];
const featureId = process.argv[3];
const useGlob = process.argv.includes("--glob");

if (!filePath || !featureId) {
  console.error("✗ Usage: fb-claim.mjs <file-path> <feature-id> [--glob]");
  process.exit(1);
}

const vault = findVaultDir();
if (!vault) { console.error("✗ No .feature-books/ vault found. Run fb-init first."); process.exit(1); }

const repoRoot = path.dirname(vault);

// Normalize to repo-relative, forward-slash
const relPath = path.relative(repoRoot, path.resolve(filePath)).replace(/\\/g, "/");
const pattern = useGlob
  ? path.dirname(relPath).replace(/\\/g, "/") + "/**"
  : relPath;

// Find the feature book
const notes = loadNotes(vault);
const feature = notes.find(n => n.id === featureId);
if (!feature) {
  console.error(`✗ Feature "${featureId}" not found in .feature-books/`);
  console.error("  Available features: " + notes.filter(n => n.type === "feature").map(n => n.id).join(", "));
  process.exit(1);
}

// Already claimed?
if (feature.core_files.includes(pattern)) {
  console.log(`✓ "${pattern}" is already in ${featureId}'s core_files`);
  process.exit(0);
}

// Read the actual note file
const featureFilePath = path.join(vault, feature.file);
let content = fs.readFileSync(featureFilePath, "utf8");
const lines = content.split("\n");

// Find frontmatter boundaries and core_files section
let fmEnd = -1;
let coreFilesIdx = -1;
let lastItemIdx = -1;

for (let i = 1; i < lines.length; i++) {
  if (lines[i].trim() === "---") { fmEnd = i; break; }
  if (lines[i].trimStart().startsWith("core_files:")) {
    coreFilesIdx = i;
    lastItemIdx = i;
  } else if (coreFilesIdx >= 0 && lines[i].trimStart().startsWith("- ")) {
    lastItemIdx = i;
  }
}

if (fmEnd < 0) {
  console.error("✗ Invalid feature book file (no frontmatter): " + feature.file);
  process.exit(1);
}

if (coreFilesIdx >= 0) {
  lines.splice(lastItemIdx + 1, 0, `  - ${pattern}`);
} else {
  lines.splice(fmEnd, 0, `core_files:`, `  - ${pattern}`);
}

fs.writeFileSync(featureFilePath, lines.join("\n"));
console.log(`✓ Claimed "${pattern}" → ${featureId} (${feature.file})`);
console.log("\nRun graph-lint to validate...");

try {
  const lint = execSync(
    `node "${path.join(SCRIPT_DIR, "graph-lint.mjs")}"`,
    { encoding: "utf8", cwd: process.cwd() }
  );
  console.log(lint);
} catch (e) {
  console.log(e.stdout || e.message || "");
}
