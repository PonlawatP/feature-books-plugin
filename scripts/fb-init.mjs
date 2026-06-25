#!/usr/bin/env node
// Bootstrap a new project: create the .feature-books/ skeleton + seed .obsidian/graph.json (4 color groups)
// so the graph is colored immediately without opening Obsidian to configure it.
// Usage: node fb-init.mjs [targetDir]  (default = cwd)   add --force to overwrite graph.json
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const force = args.includes("--force");
const target = path.resolve(args.find((a) => !a.startsWith("--")) || process.cwd());
const vault = path.join(target, ".feature-books");

// rgb as a packed integer = (r<<16)|(g<<8)|b
const GRAPH_JSON = {
  "collapse-filter": true,
  search: "",
  showTags: false,
  showAttachments: false,
  hideUnresolved: false,
  showOrphans: true,
  "collapse-color-groups": false,
  colorGroups: [
    { query: "path:features", color: { a: 1, rgb: 3705853 } },  // blue
    { query: "path:states",   color: { a: 1, rgb: 4176208 } },  // green
    { query: "path:shared",   color: { a: 1, rgb: 10711543 } }, // purple
    { query: "path:apis",     color: { a: 1, rgb: 14391812 } }, // amber
  ],
  "collapse-display": true,
  showArrow: true,
  textFadeMultiplier: 0,
  nodeSizeMultiplier: 1,
  lineSizeMultiplier: 1,
  "collapse-forces": true,
  centerStrength: 0.5187,
  repelStrength: 10,
  linkStrength: 1,
  linkDistance: 250,
  scale: 0.7,
  close: false,
};

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

writeIfAbsent(path.join(vault, "_index.md"), INDEX_MD, ".feature-books/_index.md");
writeIfAbsent(
  path.join(vault, ".fbconfig.json"),
  JSON.stringify({ language: "English" }, null, 2) + "\n",
  ".feature-books/.fbconfig.json (content language, default English)"
);
writeIfAbsent(
  path.join(vault, ".obsidian", "graph.json"),
  JSON.stringify(GRAPH_JSON, null, 2) + "\n",
  ".feature-books/.obsidian/graph.json (4 color groups)"
);

console.log("\nDone — open .feature-books/ in Obsidian; the graph will be colored by type immediately.");
console.log("(Remember to install the Dataview community plugin for the table in _index.md)");
