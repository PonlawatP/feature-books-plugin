#!/usr/bin/env node
// Create a new Feature Book markdown file under .feature-books/.
// Builds frontmatter from the schema, validates the id prefix, refuses to overwrite,
// writes bidirectional relations into linked notes, then runs graph-lint.
// Usage:
//   node fb-new.mjs <type> <id> [--title "..."] [--depends_on a,b] [--impacts a,b]
//                                [--core_files glob,glob] [--related_states s1,s2]
//   <type> = feature | state | shared | api
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { findVaultDir } from "./_lib.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

// --- parse args: positional <type> <id>, then --flag value pairs ---
const argv = process.argv.slice(2);
const positional = [];
const flags = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith("--")) {
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) flags[key] = "true";
    else { flags[key] = next; i++; }
  } else positional.push(a);
}
const [type, id] = positional;
const list = (k) => (flags[k] ? flags[k].split(",").map((s) => s.trim()).filter(Boolean) : []);
const title = flags.title || "";
const depends_on = list("depends_on");
const impacts = list("impacts");
const core_files = list("core_files");
const related_states = list("related_states");

if (!type || !id) {
  console.error("✗ Usage: fb-new.mjs <type> <id> [--title ... --depends_on a,b --impacts a,b --core_files glob,glob --related_states s1,s2]");
  process.exit(1);
}

const prefixMap = { feature: "feat-", state: "state-", shared: "shared-", api: "api-" };
const folderMap = { feature: "features", state: "states", shared: "shared", api: "apis" };
const expected = prefixMap[type];
if (!expected) { console.error(`✗ Unknown type "${type}" (use: feature | state | shared | api)`); process.exit(1); }
if (!id.startsWith(expected)) { console.error(`✗ id "${id}" must start with "${expected}" for type "${type}"`); process.exit(1); }

const vault = findVaultDir();
if (!vault) { console.error("✗ No .feature-books/ vault found. Run fb-init first."); process.exit(1); }

const folder = folderMap[type];
const folderPath = path.join(vault, folder);
fs.mkdirSync(folderPath, { recursive: true });
const filePath = path.join(folderPath, `${id}.md`);
if (fs.existsSync(filePath)) {
  console.error(`✗ ${id}.md already exists at .feature-books/${folder}/${id}.md (not overwriting)`);
  process.exit(1);
}

// content language (for the Business Rules placeholder)
let language = "English";
try {
  const cfg = JSON.parse(fs.readFileSync(path.join(vault, ".fbconfig.json"), "utf8"));
  if (cfg.language) language = cfg.language;
} catch {}

const today = new Date().toISOString().split("T")[0];

// --- build frontmatter ---
const lines = ["---", `id: ${id}`, `type: ${type}`, `status: draft`, `last_reviewed: ${today}`];
if (title) lines.push(`title: ${title}`);

// depends_on / impacts use Obsidian wikilinks so the graph draws edges; fences are plain.
const writeLinks = (key, vals) => {
  if (!vals.length) return;
  lines.push(`${key}:`);
  vals.forEach((v) => lines.push(`  - "[[${v}]]"`));
};
const writePlain = (key, vals) => {
  if (!vals.length) return;
  lines.push(`${key}:`);
  vals.forEach((v) => lines.push(`  - ${v}`));
};
writeLinks("depends_on", depends_on);
writeLinks("impacts", impacts);
writePlain("core_files", core_files);
writePlain("related_states", related_states);

lines.push(
  "---",
  "",
  `# ${title || id}`,
  "",
  "## Business Rules",
  "",
  `<!-- Describe the business logic here, in ${language} -->`,
  "",
  "## Change Log",
  "",
  "| Date | Change |",
  "|------|--------|",
  `| ${today} | Created |`,
  ""
);

fs.writeFileSync(filePath, lines.join("\n"));
console.log(`✓ Created .feature-books/${folder}/${id}.md`);

// --- bidirectional relations: inject the reciprocal link into each linked note ---
function findNoteFile(linkedId) {
  for (const f of ["features", "states", "shared", "apis"]) {
    const p = path.join(vault, f, `${linkedId}.md`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

for (const linkedId of [...depends_on, ...impacts]) {
  const linkedFile = findNoteFile(linkedId);
  if (!linkedFile) {
    console.log(`  ⚠ ${linkedId} has no note yet — reciprocal link skipped (run fb-new for it later)`);
    continue;
  }
  const content = fs.readFileSync(linkedFile, "utf8");
  // if A impacts B, then B must depends_on A (and vice versa)
  const field = impacts.includes(linkedId) ? "depends_on" : "impacts";
  if (content.includes(`[[${id}]]`)) continue; // already linked
  let updated;
  if (new RegExp(`^${field}:\\s*$`, "m").test(content)) {
    updated = content.replace(new RegExp(`(^${field}:\\s*$)`, "m"), `$1\n  - "[[${id}]]"`);
  } else {
    updated = content.replace(/^---\n/, `---\n${field}:\n  - "[[${id}]]"\n`);
  }
  fs.writeFileSync(linkedFile, updated);
  console.log(`  ✓ linked back: ${linkedId} ${field} ${id}`);
}

// --- run graph-lint and surface the result ---
try {
  const lint = execSync(`node "${path.join(SCRIPT_DIR, "graph-lint.mjs")}"`, { encoding: "utf8", cwd: process.cwd() });
  console.log("\n--- graph-lint ---\n" + lint);
} catch (e) {
  // graph-lint exits 1 on errors; still show its output
  console.log("\n--- graph-lint ---\n" + (e.stdout || e.message || ""));
}
