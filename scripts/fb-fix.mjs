#!/usr/bin/env node
// Restore .obsidian/graph.json (color groups) and .obsidian/appearance.json (fonts + accent color)
// to the Feature Books defaults. Unlike fb-init, this ALWAYS overwrites — use it when Obsidian
// settings drift, get reset, or get hand-edited away from spec.
// Usage: node fb-fix.mjs [targetDir]  (default = cwd's .feature-books/, found by walking up)
import fs from "node:fs";
import path from "node:path";
import { findVaultDir, DEFAULT_GRAPH_JSON, DEFAULT_APPEARANCE_JSON, getPluginVersion } from "./_lib.mjs";

const args = process.argv.slice(2);
const explicitTarget = args.find((a) => !a.startsWith("--"));

let vault;
if (explicitTarget) {
  vault = path.join(path.resolve(explicitTarget), ".feature-books");
  if (!fs.existsSync(vault)) {
    console.error(`✗ No .feature-books/ found at: ${vault}`);
    process.exit(1);
  }
} else {
  vault = findVaultDir();
  if (!vault) {
    console.error("✗ Could not find .feature-books/ (run from inside the repo, or pass a targetDir)");
    process.exit(1);
  }
}

function forceWrite(p, content, label) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const existed = fs.existsSync(p);
  fs.writeFileSync(p, content);
  console.log(`✓ ${existed ? "restored" : "wrote"}: ${label}`);
}

console.log(`Fixing Feature Books Obsidian settings at: ${vault}\n`);

forceWrite(
  path.join(vault, ".obsidian", "graph.json"),
  JSON.stringify(DEFAULT_GRAPH_JSON, null, 2) + "\n",
  ".feature-books/.obsidian/graph.json (default color groups)"
);
forceWrite(
  path.join(vault, ".obsidian", "appearance.json"),
  JSON.stringify(DEFAULT_APPEARANCE_JSON, null, 2) + "\n",
  ".feature-books/.obsidian/appearance.json (fonts + accent color)"
);

// Stamp .fbconfig.json with the current plugin version — fb-fix is exactly the operation that
// brings the vault's Obsidian settings back in line with the installed plugin, so this is where
// the version stamp gets updated too. Preserves the existing language setting.
const pluginVersion = getPluginVersion();
const cfgPath = path.join(vault, ".fbconfig.json");
let cfg = { language: "English" };
try { cfg = { ...cfg, ...JSON.parse(fs.readFileSync(cfgPath, "utf8")) }; } catch { /* use default */ }
cfg.pluginVersion = pluginVersion;
forceWrite(cfgPath, JSON.stringify(cfg, null, 2) + "\n", `.feature-books/.fbconfig.json (version stamp -> v${pluginVersion})`);

console.log("\nDone — reload/reopen the vault in Obsidian (Ctrl/Cmd+R) if colors don't refresh immediately.");
