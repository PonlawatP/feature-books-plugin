#!/usr/bin/env node
// Deterministic version check — plain file reads + string comparison, no AI/LLM involved.
// Compares the version stamped in .feature-books/.fbconfig.json (set by fb-init/fb-fix) against
// the currently installed plugin's own version (from plugin.json).
//
// Usage:
//   node fb-version-check.mjs            -> hook mode: silent when up to date, always exits 0
//   node fb-version-check.mjs check       -> verbose mode (used by /fb-version): always prints,
//                                            exits 1 on mismatch/unknown so callers can branch on it
import fs from "node:fs";
import path from "node:path";
import { findVaultDir, getPluginVersion, readHookPayload } from "./_lib.mjs";

const verbose = process.argv.includes("check") || process.argv.includes("--verbose");

const payload = verbose ? null : await readHookPayload();
const isAgy = Array.isArray(payload?.workspacePaths);

// In AGY PreInvocation, only run on first invocation to save turn overhead
if (isAgy && payload?.invocationNum && payload.invocationNum > 1) {
  process.stdout.write(JSON.stringify({}));
  process.exit(0);
}

const cwd = payload?.cwd || (isAgy && payload.workspacePaths[0]) || process.cwd();
const vault = findVaultDir(cwd);
if (!vault) {
  if (verbose) console.error("✗ Could not find .feature-books/ in this repo (run /fb-init first)");
  if (isAgy) process.stdout.write(JSON.stringify({}));
  process.exit(verbose ? 1 : 0);
}

const pluginVersion = getPluginVersion();
if (!pluginVersion) {
  if (verbose) console.error("✗ Could not read the installed plugin's own version");
  if (isAgy) process.stdout.write(JSON.stringify({}));
  process.exit(0);
}

let vaultVersion = null;
try {
  vaultVersion = JSON.parse(fs.readFileSync(path.join(vault, ".fbconfig.json"), "utf8")).pluginVersion || null;
} catch { /* no .fbconfig.json or unreadable -> treat as unknown */ }

function reportWarning(msg) {
  if (isAgy) {
    process.stdout.write(JSON.stringify({
      injectSteps: [{ ephemeralMessage: msg }]
    }));
  } else {
    console.log(msg);
  }
}

if (!vaultVersion) {
  reportWarning(
    `[feature-books] ⚠ This vault has no version stamp (created by an older plugin version, ` +
    `or before version tracking was added). Installed plugin is v${pluginVersion}. ` +
    `Run /fb-fix to restore Obsidian settings and stamp the vault with the current version.`
  );
  process.exit(verbose ? 1 : 0);
}

if (vaultVersion !== pluginVersion) {
  reportWarning(
    `[feature-books] ⚠ Vault version (v${vaultVersion}) does not match the installed plugin (v${pluginVersion}). ` +
    `Obsidian graph colors/appearance may be out of date. Run /fb-fix to update them.`
  );
  process.exit(verbose ? 1 : 0);
}

if (verbose) console.log(`✓ Vault is up to date with the installed plugin (v${pluginVersion})`);
if (isAgy) process.stdout.write(JSON.stringify({}));
process.exit(0);
