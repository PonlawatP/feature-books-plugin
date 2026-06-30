// Install Feature Books plugin for OpenCode in the current project.
// Run: node scripts/install-opencode.mjs   (from the plugin repo root)
//   or: node ../feature-books-plugin/scripts/install-opencode.mjs   (from your project)
//
// What it does:
//   1. Creates .opencode/plugins/ in the target directory
//   2. Copies feature-books.ts plugin file there
//   3. Copies scripts/ to feature-books-scripts/ in the target directory
//   4. Links skills/feature-books to ~/.claude/skills/feature-books
//   5. Prints next steps

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import os from "node:os";

const IS_WIN = os.platform() === "win32";

// Resolve the plugin repo root — the directory containing scripts/ and .opencode/
function findPluginRoot() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  // When run as: node scripts/install-opencode.mjs
  const scriptDir = __dirname;
  const parent = path.resolve(scriptDir, "..");
  if (
    fs.existsSync(path.join(parent, "scripts")) &&
    fs.existsSync(path.join(parent, ".opencode"))
  ) {
    return parent;
  }
  // When run as: node ../feature-books-plugin/scripts/install-opencode.mjs
  const grandparent = path.resolve(scriptDir, "..", "..");
  if (
    fs.existsSync(path.join(grandparent, "scripts")) &&
    fs.existsSync(path.join(grandparent, ".opencode"))
  ) {
    return grandparent;
  }
  // Fallback: cwd
  const cwd = process.cwd();
  if (
    fs.existsSync(path.join(cwd, "scripts")) &&
    fs.existsSync(path.join(cwd, ".opencode"))
  ) {
    return cwd;
  }
  console.error(
    "Error: cannot find plugin repo root (expected scripts/ and .opencode/).\n" +
      "Run from the feature-books-plugin directory or pass the path as an argument."
  );
  process.exit(1);
}

function linkSkill(pluginRoot) {
  const src = path.resolve(pluginRoot, "skills", "feature-books");
  const home = os.homedir();
  const destDir = path.join(home, ".claude", "skills");
  const dest = path.join(destDir, "feature-books");

  if (!fs.existsSync(src)) {
    console.log("  ⚠  skills/feature-books not found, skipping skill link");
    return;
  }

  if (fs.existsSync(dest)) {
    console.log(`  ✓ skill already linked at ${dest}`);
    return;
  }

  fs.mkdirSync(destDir, { recursive: true });

  try {
    if (IS_WIN) {
      execSync(
        `New-Item -ItemType Junction -Path "${dest}" -Target "${src}" -Force`,
        { shell: "powershell" }
      );
    } else {
      fs.symlinkSync(src, dest, "junction");
    }
    console.log(`  ✓ skill linked → ${dest}`);
  } catch (e) {
    console.log(`  ⚠  could not link skill: ${e.message}`);
    console.log(`     Manual: copy "${src}" to "${dest}"`);
  }
}

function install(targetDir, pluginRoot) {
  const opener = "\n  " + "=".repeat(56) + "\n";
  console.log(`${opener}  Installing Feature Books for OpenCode\n`);

  // 1. Copy plugin file
  const pluginSrc = path.resolve(pluginRoot, ".opencode", "plugins", "feature-books.ts");
  const pluginDestDir = path.resolve(targetDir, ".opencode", "plugins");
  const pluginDest = path.join(pluginDestDir, "feature-books.ts");

  if (!fs.existsSync(pluginSrc)) {
    console.error(`  ✗ plugin not found at ${pluginSrc}`);
    process.exit(1);
  }

  fs.mkdirSync(pluginDestDir, { recursive: true });
  fs.copyFileSync(pluginSrc, pluginDest);
  console.log(`  ✓ plugin copied → ${path.relative(targetDir, pluginDest)}`);

  // 2. Copy scripts
  const scriptsSrc = path.resolve(pluginRoot, "scripts");
  const scriptsDest = path.resolve(targetDir, "feature-books-scripts");

  if (!fs.existsSync(scriptsSrc)) {
    console.error(`  ✗ scripts not found at ${scriptsSrc}`);
    process.exit(1);
  }

  fs.mkdirSync(scriptsDest, { recursive: true });
  for (const name of fs.readdirSync(scriptsSrc)) {
    if (name === "install-opencode.mjs") continue; // don't copy self
    fs.copyFileSync(
      path.join(scriptsSrc, name),
      path.join(scriptsDest, name)
    );
  }
  console.log(
    `  ✓ scripts copied → ${path.relative(targetDir, scriptsDest)}/ (${fs.readdirSync(scriptsSrc).length - 1} files)`
  );

  // 3. Link skill
  linkSkill(pluginRoot);

  // 4. Print next steps
  console.log(`\n  ─── Setup complete ───\n`);
  console.log(`  Next steps:`);
  console.log(`  1. Initialize .feature-books/ vault:`);
  console.log(`     use fb-init tool`);
  console.log(`  2. Create the first feature book:`);
  console.log(`     use fb-new tool`);
  console.log(`\n  The plugin is auto-discovered by OpenCode via`);
  console.log(`  .opencode/plugins/feature-books.ts`);
  console.log(`  ${"=".repeat(56)}\n`);
}

// --- main ---

const targetDir = path.resolve(process.argv[2] || process.cwd());
const pluginRoot = findPluginRoot();

if (!fs.existsSync(targetDir)) {
  console.error(`Error: target directory "${targetDir}" does not exist`);
  process.exit(1);
}

install(targetDir, pluginRoot);
