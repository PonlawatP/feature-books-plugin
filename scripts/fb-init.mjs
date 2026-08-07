#!/usr/bin/env node
// Bootstrap a new project: create the .feature-books/ skeleton + seed .obsidian/graph.json/appearance.json
// so the graph is colored (and fonts/accent set) immediately without opening Obsidian to configure it.
// Usage: node fb-init.mjs [targetDir]  (default = cwd)   add --force to overwrite graph.json/appearance.json
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_GRAPH_JSON, DEFAULT_APPEARANCE_JSON, getPluginVersion } from "./_lib.mjs";

const args = process.argv.slice(2);
const force = args.includes("--force");
const target = path.resolve(args.find((a) => !a.startsWith("--")) || process.cwd());
const vault = path.join(target, ".feature-books");

const GRAPH_JSON = DEFAULT_GRAPH_JSON;
const APPEARANCE_JSON = DEFAULT_APPEARANCE_JSON;

const INDEX_MD = `# Feature Books — Index

The source of truth for business logic and feature relationships.
Open this \`.feature-books/\` folder as an Obsidian vault and view it in Graph View (colors are preset).

> Content language is set in \`.fbconfig.json\` (default: English). Change it with \`/fb-config set <language>\`.

\`\`\`dataview
TABLE status, owner, length(impacts) AS "Impacts", last_reviewed
FROM "features"
WHERE type = "feature"
SORT last_reviewed ASC
\`\`\`

> Install the **Dataview** community plugin for the table to work.

## Specs

Plain-language product specs live under \`specs/\` — no frontmatter, no source paths, written for
someone who wants to know what a feature does and why, not how it's implemented. Create or refresh
one with \`/fb-spec-new <topic>\`; it checks first whether a Feature Book already exists for the
topic (most specs are written before implementation, so usually none will).

\`\`\`dataview
LIST
FROM "specs"
\`\`\`

## Tasks

Issue/task cards live under \`tasks/\`: \`issues/\` (new) → \`decisions/\` (triaged), then manually
move them to \`backlog/\` (accepted for later), \`hold/\` (blocked), or \`action/\` (in progress).
Terminal folders are \`done/\` (completed) and \`cancelled/\` (intentionally closed).
Create a card with \`/fb-task\`, triage the inbox with \`/fb-triage\`.

\`\`\`dataview
TABLE kind, status, effort, related
FROM "tasks"
SORT created DESC
\`\`\`
`;

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function writeIfAbsent(p, content, label) {
  if (fs.existsSync(p) && !force) { console.log(`• skip (already exists): ${label}`); return false; }
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, content);
  console.log(`✓ wrote: ${label}${fs.existsSync(p) && force ? " (force)" : ""}`);
  return true;
}

console.log(`Bootstrapping Feature Books at: ${target}\n`);
for (const d of ["features", "states", "shared", "apis"]) ensureDir(path.join(vault, d));
console.log("✓ created folders features/ states/ shared/ apis/");
ensureDir(path.join(vault, "specs"));
console.log("✓ created folder specs/ (plain-language product specs — no frontmatter schema, not a graph node)");
const taskFolders = ["issues", "decisions", "backlog", "hold", "action", "done", "cancelled"];
for (const folder of taskFolders) ensureDir(path.join(vault, "tasks", folder));
console.log(`✓ created task folders: ${taskFolders.join(", ")}`);

writeIfAbsent(path.join(vault, "_index.md"), INDEX_MD, ".feature-books/_index.md");
writeIfAbsent(
  path.join(vault, ".fbconfig.json"),
  JSON.stringify({ language: "English", pluginVersion: getPluginVersion() }, null, 2) + "\n",
  ".feature-books/.fbconfig.json (content language + plugin version stamp)"
);
writeIfAbsent(
  path.join(vault, ".obsidian", "graph.json"),
  JSON.stringify(GRAPH_JSON, null, 2) + "\n",
  ".feature-books/.obsidian/graph.json (color groups)"
);
writeIfAbsent(
  path.join(vault, ".obsidian", "appearance.json"),
  JSON.stringify(APPEARANCE_JSON, null, 2) + "\n",
  ".feature-books/.obsidian/appearance.json (fonts + accent color)"
);
writeIfAbsent(
  path.join(vault, ".gitignore"),
  "# Feature Books local state (transient — do not commit)\n.fb-autobook.json\n",
  ".feature-books/.gitignore (ignore auto-book state)"
);

console.log("\nDone — open .feature-books/ in Obsidian; the graph will be colored by type and fonts/accent color set immediately.");
console.log("(Remember to install the Dataview community plugin for the table in _index.md)");
console.log("If Obsidian settings ever get reset or edited away from this, run /fb-fix to restore them.");
console.log("Create your first task card with /fb-task, and process the inbox with /fb-triage.");
