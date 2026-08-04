#!/usr/bin/env node
// Workspace-level catalog and Obsidian portal for repository-local Feature Books vaults.
// The portal is derived metadata only: each repository's .feature-books/ remains authoritative.
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_APPEARANCE_JSON, DEFAULT_GRAPH_JSON, parseFrontmatter } from "./_lib.mjs";

const PORTAL_DIR = ".feature-books-workspace";
const CONFIG_FILE = "workspace.json";
const STATE_FILE = "state.local.json";
const BOOK_FOLDERS = ["features", "states", "shared", "apis"];
const TASK_FOLDERS = ["issues", "decisions", "action", "done"];
const WORKSPACE_GRAPH_JSON = {
  ...DEFAULT_GRAPH_JSON,
  search: "-file:_index",
  colorGroups: [
    ...DEFAULT_GRAPH_JSON.colorGroups,
    { query: "path:data-dicts", color: { a: 1, rgb: Number.parseInt("FF6B6B", 16) } },
    { query: "path:research", color: { a: 1, rgb: Number.parseInt("4DD0E1", 16) } },
    { query: "path:pocs", color: { a: 1, rgb: Number.parseInt("FDD835", 16) } },
    { query: "path:summary_reports", color: { a: 1, rgb: Number.parseInt("EC407A", 16) } },
    { query: "path:repos", color: { a: 1, rgb: Number.parseInt("78909C", 16) } },
  ],
};

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}

function normalizeRel(value) {
  const normalized = value.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/$/, "");
  if (!normalized || normalized === "." || path.isAbsolute(value) || normalized.startsWith("../")) {
    fail(`Repository paths must stay inside the workspace: ${value}`);
  }
  return normalized;
}

function findWorkspace(start = process.cwd()) {
  let dir = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(dir, PORTAL_DIR, CONFIG_FILE))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function portalPaths(root) {
  const portal = path.join(root, PORTAL_DIR);
  return {
    portal,
    config: path.join(portal, CONFIG_FILE),
    state: path.join(portal, STATE_FILE),
    catalog: path.join(portal, "catalog.json"),
    index: path.join(portal, "_index.md"),
    repos: path.join(portal, "repos"),
  };
}

function isGitRepo(dir) {
  const dotGit = path.join(dir, ".git");
  if (!fs.existsSync(dotGit)) return false;
  try {
    const stat = fs.statSync(dotGit);
    return stat.isFile() || (stat.isDirectory() && fs.readdirSync(dotGit).length > 0);
  } catch { return false; }
}

function discoverRepos(root) {
  const candidates = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const dir = path.join(root, entry.name);
    if (isGitRepo(dir) || fs.existsSync(path.join(dir, ".feature-books"))) {
      candidates.push({ name: entry.name, dir });
    }
  }
  return candidates.map(({ name, dir }) => ({
      name,
      path: normalizeRel(path.relative(root, dir) || name),
      vault: ".feature-books",
      enabled: true,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function loadWorkspace(start) {
  const root = findWorkspace(start);
  if (!root) fail(`No ${PORTAL_DIR}/${CONFIG_FILE} found. Run fb-workspace init first.`);
  const paths = portalPaths(root);
  const config = readJson(paths.config);
  if (!config || config.version !== 1 || !Array.isArray(config.repositories)) {
    fail(`Invalid workspace manifest: ${paths.config}`);
  }
  const names = new Set();
  for (const repo of config.repositories) {
    if (!repo || typeof repo.name !== "string" || !/^[A-Za-z0-9._-]+$/.test(repo.name)) {
      fail(`Invalid repository name in workspace manifest: ${repo?.name || "<missing>"}`);
    }
    if (names.has(repo.name)) fail(`Duplicate repository name in workspace manifest: ${repo.name}`);
    names.add(repo.name);
    normalizeRel(String(repo.path || ""));
    normalizeRel(String(repo.vault || ".feature-books"));
  }
  return { root, paths, config };
}

function repoLocation(root, repo) {
  const repoRoot = path.resolve(root, normalizeRel(repo.path));
  const relative = path.relative(root, repoRoot);
  if (relative.startsWith("..") || path.isAbsolute(relative)) fail(`Repository escapes workspace: ${repo.path}`);
  const vault = path.resolve(repoRoot, normalizeRel(repo.vault || ".feature-books"));
  const vaultRelative = path.relative(repoRoot, vault);
  if (vaultRelative.startsWith("..") || path.isAbsolute(vaultRelative)) fail(`Vault escapes repository ${repo.name}: ${repo.vault}`);
  return { repoRoot, vault };
}

function readBooks(vault, repoName) {
  const books = [];
  for (const folder of BOOK_FOLDERS) {
    const dir = path.join(vault, folder);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir).filter((file) => file.endsWith(".md")).sort()) {
      const text = fs.readFileSync(path.join(dir, name), "utf8");
      const fm = parseFrontmatter(text) || {};
      const id = String(fm.id || path.basename(name, ".md"));
      books.push({
        key: `${repoName}/${id}`,
        repo: repoName,
        id,
        type: String(fm.type || folder.replace(/s$/, "")),
        status: String(fm.status || "unknown"),
        title: String(fm.title || id),
        lastReviewed: String(fm.last_reviewed || ""),
        dependsOn: Array.isArray(fm.depends_on) ? fm.depends_on : [],
        impacts: Array.isArray(fm.impacts) ? fm.impacts : [],
        note: `repos/${repoName}/${folder}/${name}`,
      });
    }
  }
  return books;
}

function countTasks(vault) {
  return Object.fromEntries(TASK_FOLDERS.map((stage) => {
    const dir = path.join(vault, "tasks", stage);
    const count = fs.existsSync(dir)
      ? fs.readdirSync(dir).filter((name) => name.endsWith(".md")).length
      : 0;
    return [stage, count];
  }));
}

function safeLink(target, link) {
  fs.mkdirSync(path.dirname(link), { recursive: true });
  try {
    const stat = fs.lstatSync(link);
    if (!stat.isSymbolicLink()) fail(`Refusing to replace non-symlink portal entry: ${link}`);
    fs.unlinkSync(link);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  fs.symlinkSync(path.relative(path.dirname(link), target), link, "dir");
}

function renderDashboard(catalog, state) {
  const focusedBooks = state?.activeFeatures?.map((id) => catalog.books.find((book) => book.repo === state.activeRepo && book.id === id));
  const focus = state?.activeRepo
    ? `**${state.activeRepo}**${focusedBooks?.length ? ` → ${focusedBooks.map((book, index) => book ? `[${book.id}](${book.note})` : state.activeFeatures[index]).join(", ")}` : ""}${state.activeTask ? ` → ${state.activeTask}` : ""}`
    : "No active focus. Run `fb-workspace focus <repo> [feature...]`.";
  const rows = catalog.repositories.map((repo) =>
    `| ${repo.name} | ${repo.vaultPresent ? "✓" : "—"} | ${repo.bookCount} | ${repo.tasks.issues} | ${repo.tasks.action} |`
  ).join("\n");
  return `# Feature Books Workspace\n\n> Generated by \`fb-workspace sync\`. Repository vaults remain the source of truth. Install the **Dataview** community plugin for the live tables below.\n\n## Current Focus\n\n${focus}\n\n## Repositories\n\n| Repository | Vault | Books | Inbox | In progress |\n|---|---:|---:|---:|---:|\n${rows || "| — | — | 0 | 0 | 0 |"}\n\n## Feature Books\n\n\`\`\`dataview\nTABLE split(file.folder, "/")[1] AS Repository, type AS Type, status AS Status, last_reviewed AS "Last reviewed"\nFROM "repos"\nWHERE contains(list("feature", "state", "shared", "api"), type)\nSORT split(file.folder, "/")[1] ASC, type ASC, file.name ASC\n\`\`\`\n\n## Active Tasks\n\n\`\`\`dataview\nTABLE split(file.folder, "/")[1] AS Repository, kind AS Kind, status AS Status, effort AS Effort, related AS Related\nFROM "repos"\nWHERE contains(file.folder, "/tasks/action") OR contains(file.folder, "/tasks/issues")\nSORT status ASC, file.name ASC\n\`\`\`\n\n## Specs and Knowledge\n\n\`\`\`dataview\nTABLE split(file.folder, "/")[1] AS Repository, file.folder AS Category\nFROM "repos"\nWHERE contains(file.folder, "/specs") OR contains(file.folder, "/research") OR contains(file.folder, "/data-dicts") OR contains(file.folder, "/pocs") OR contains(file.folder, "/summary_reports")\nSORT split(file.folder, "/")[1] ASC, file.folder ASC, file.name ASC\n\`\`\`\n`;
}

function writeWorkspaceSettings(paths, force = false) {
  const obsidian = path.join(paths.portal, ".obsidian");
  fs.mkdirSync(obsidian, { recursive: true });
  const settings = [
    [path.join(obsidian, "graph.json"), WORKSPACE_GRAPH_JSON],
    [path.join(obsidian, "appearance.json"), DEFAULT_APPEARANCE_JSON],
  ];
  for (const [file, value] of settings) {
    if (force || !fs.existsSync(file)) writeJson(file, value);
  }
}

function syncWorkspace(workspace) {
  const { root, paths, config } = workspace;
  fs.mkdirSync(paths.repos, { recursive: true });
  const repositories = [];
  const books = [];
  const activeRepoNames = new Set(config.repositories.filter((item) => item.enabled !== false).map((item) => item.name));
  for (const name of fs.readdirSync(paths.repos)) {
    if (activeRepoNames.has(name)) continue;
    const entry = path.join(paths.repos, name);
    if (fs.lstatSync(entry).isSymbolicLink()) fs.unlinkSync(entry);
  }
  for (const repo of config.repositories.filter((item) => item.enabled !== false)) {
    const { vault } = repoLocation(root, repo);
    const vaultPresent = fs.existsSync(vault) && fs.statSync(vault).isDirectory();
    const repoBooks = vaultPresent ? readBooks(vault, repo.name) : [];
    const tasks = vaultPresent ? countTasks(vault) : Object.fromEntries(TASK_FOLDERS.map((stage) => [stage, 0]));
    repositories.push({ name: repo.name, path: repo.path, vault: repo.vault, vaultPresent, bookCount: repoBooks.length, tasks });
    books.push(...repoBooks);
    const link = path.join(paths.repos, repo.name);
    if (vaultPresent) safeLink(vault, link);
    else if (fs.existsSync(link) && fs.lstatSync(link).isSymbolicLink()) fs.unlinkSync(link);
  }
  const catalog = { version: 1, generatedAt: new Date().toISOString(), repositories, books };
  writeJson(paths.catalog, catalog);
  fs.writeFileSync(paths.index, renderDashboard(catalog, readJson(paths.state)));
  return catalog;
}

function init(targetArg) {
  const root = path.resolve(targetArg || process.cwd());
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) fail(`Workspace directory not found: ${root}`);
  const paths = portalPaths(root);
  fs.mkdirSync(path.join(paths.portal, ".obsidian"), { recursive: true });
  fs.mkdirSync(paths.repos, { recursive: true });
  if (!fs.existsSync(paths.config)) {
    writeJson(paths.config, { version: 1, repositories: discoverRepos(root) });
  }
  if (!fs.existsSync(paths.state)) writeJson(paths.state, { activeRepo: null, activeFeatures: [], activeTask: null, relatedRepos: [], updatedAt: null });
  fs.writeFileSync(path.join(paths.portal, ".gitignore"), `${STATE_FILE}\n`);
  writeWorkspaceSettings(paths);
  const workspace = loadWorkspace(root);
  const catalog = syncWorkspace(workspace);
  console.log(`✓ Initialized Feature Books workspace at ${paths.portal}`);
  console.log(`✓ Registered ${workspace.config.repositories.length} repositories; ${catalog.repositories.filter((repo) => repo.vaultPresent).length} have vaults`);
  console.log(`Open ${paths.portal} as an Obsidian vault.`);
}

function fix(start) {
  const workspace = loadWorkspace(start);
  writeWorkspaceSettings(workspace.paths, true);
  syncWorkspace(workspace);
  console.log("✓ Restored workspace graph colors, appearance, and Dataview dashboard");
}

function sync(start) {
  const workspace = loadWorkspace(start);
  const catalog = syncWorkspace(workspace);
  console.log(`✓ Synced ${catalog.repositories.length} repositories and ${catalog.books.length} books`);
  for (const repo of catalog.repositories.filter((item) => !item.vaultPresent)) console.log(`• ${repo.name}: no .feature-books/ vault`);
}

function status(start, json = false) {
  const workspace = loadWorkspace(start);
  const catalog = syncWorkspace(workspace);
  const state = readJson(workspace.paths.state, {});
  if (json) {
    console.log(JSON.stringify({ workspace: workspace.root, state, catalog }, null, 2));
    return;
  }
  console.log(`Workspace: ${workspace.root}`);
  console.log(`Focus: ${state.activeRepo || "none"}${state.activeFeatures?.length ? ` / ${state.activeFeatures.join(", ")}` : ""}${state.activeTask ? ` / ${state.activeTask}` : ""}`);
  for (const repo of catalog.repositories) {
    console.log(`- ${repo.name}: ${repo.vaultPresent ? `${repo.bookCount} books, ${repo.tasks.action} active tasks` : "no vault"}`);
  }
}

function focus(start, args) {
  const workspace = loadWorkspace(start);
  const clear = args.includes("--clear");
  if (clear) {
    writeJson(workspace.paths.state, { activeRepo: null, activeFeatures: [], activeTask: null, relatedRepos: [], updatedAt: new Date().toISOString() });
    syncWorkspace(workspace);
    console.log("✓ Cleared workspace focus");
    return;
  }
  const repoName = args[0];
  if (!repoName) fail("Usage: fb-workspace focus <repo> [feature ...] [--task <id>] [--related <repo,repo>]");
  const repo = workspace.config.repositories.find((item) => item.name === repoName && item.enabled !== false);
  if (!repo) fail(`Repository is not registered: ${repoName}`);
  const features = [];
  let task = null;
  let related = [];
  for (let index = 1; index < args.length; index += 1) {
    const value = args[index];
    if (value === "--task") {
      task = args[index + 1] || fail("--task requires an ID");
      index += 1;
    } else if (value === "--related") {
      related = (args[index + 1] || fail("--related requires a comma-separated repository list"))
        .split(",").map((item) => item.trim()).filter(Boolean);
      index += 1;
    } else if (value.startsWith("--")) fail(`Unknown focus option: ${value}`);
    else features.push(value);
  }
  for (const name of related) {
    if (!workspace.config.repositories.some((item) => item.name === name)) fail(`Related repository is not registered: ${name}`);
  }
  const { vault } = repoLocation(workspace.root, repo);
  const knownIds = new Set(fs.existsSync(vault) ? readBooks(vault, repoName).map((book) => book.id) : []);
  for (const id of features) if (!knownIds.has(id)) fail(`Feature Book not found in ${repoName}: ${id}`);
  const state = { activeRepo: repoName, activeFeatures: features, activeTask: task, relatedRepos: related, updatedAt: new Date().toISOString() };
  writeJson(workspace.paths.state, state);
  syncWorkspace(workspace);
  console.log(`✓ Focused ${repoName}${features.length ? ` / ${features.join(", ")}` : ""}${task ? ` / ${task}` : ""}`);
}

const [command = "status", ...args] = process.argv.slice(2);
if (command === "init") init(args[0]);
else if (command === "sync") sync(args[0] || process.cwd());
else if (command === "fix") fix(process.cwd());
else if (command === "status") status(process.cwd(), args.includes("--json"));
else if (command === "focus") focus(process.cwd(), args);
else if (command === "clear-focus") focus(process.cwd(), ["--clear"]);
else fail("Usage: fb-workspace <init|fix|sync|status|focus|clear-focus>");
