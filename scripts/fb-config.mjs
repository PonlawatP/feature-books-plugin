#!/usr/bin/env node
// Get or set the language used when writing Feature Books content. Default: English.
// Usage:
//   node fb-config.mjs                -> print the current language
//   node fb-config.mjs get
//   node fb-config.mjs set <language>
import fs from "node:fs";
import path from "node:path";
import { findVaultDir } from "./_lib.mjs";

const vault = findVaultDir();
if (!vault) { console.error("✗ Could not find .feature-books/ (run from inside the repo)"); process.exit(1); }

const cfgPath = path.join(vault, ".fbconfig.json");
const DEFAULT = { language: "English" };

function read() {
  try { return { ...DEFAULT, ...JSON.parse(fs.readFileSync(cfgPath, "utf8")) }; }
  catch { return { ...DEFAULT }; }
}

const [cmd, ...rest] = process.argv.slice(2);

if (!cmd || cmd === "get") {
  console.log(read().language);
  process.exit(0);
}

if (cmd === "set") {
  const lang = rest.join(" ").trim();
  if (!lang) { console.error("✗ Usage: fb-config.mjs set <language>"); process.exit(1); }
  const cfg = read();
  cfg.language = lang;
  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n");
  console.log(`✓ Language set to: ${lang}`);
  console.log("Applies to feature books created/edited from the next run onward (existing books are not retranslated).");
  process.exit(0);
}

console.error(`✗ Unknown command: ${cmd} (use: get | set <language>)`);
process.exit(1);
