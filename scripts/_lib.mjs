// Shared helpers for Feature Books scripts. Dependency-free (Node >= 16, ESM).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Read the installed plugin's own version from its plugin.json. Deterministic file read only.
// Codex sets PLUGIN_ROOT and also exposes CLAUDE_PLUGIN_ROOT for compatibility.
export function getPluginVersion() {
  const candidates = [];
  for (const root of [process.env.PLUGIN_ROOT, process.env.CLAUDE_PLUGIN_ROOT]) {
    if (!root) continue;
    candidates.push(path.join(root, ".codex-plugin", "plugin.json"));
    candidates.push(path.join(root, ".claude-plugin", "plugin.json"));
  }
  const here = path.dirname(fileURLToPath(import.meta.url));
  candidates.push(path.join(here, "..", ".codex-plugin", "plugin.json"));
  candidates.push(path.join(here, "..", ".claude-plugin", "plugin.json"));
  for (const p of candidates) {
    try { return JSON.parse(fs.readFileSync(p, "utf8")).version || null; } catch { /* try next */ }
  }
  return null;
}

// Read a Claude Code or Codex hook payload. Both hosts send JSON on stdin.
export async function readHookPayload() {
  if (process.stdin.isTTY) return null;
  let data = "";
  try { for await (const chunk of process.stdin) data += chunk; } catch { return null; }
  if (!data.trim()) return null;
  try { return JSON.parse(data); } catch { return null; }
}

// Claude edit tools provide file_path/path. Codex apply_patch provides the full patch in
// tool_input.command, so extract every file header from that patch.
export function hookTargetFiles(payload) {
  const input = payload?.tool_input || {};
  const files = [];
  for (const value of [input.file_path, input.path]) {
    if (typeof value === "string" && value.trim()) files.push(value.trim());
  }
  if (typeof input.command === "string") {
    const re = /^\*\*\* (?:(?:Add|Update|Delete) File|Move to): (.+)$/gm;
    for (const match of input.command.matchAll(re)) files.push(match[1].trim());
  }
  return [...new Set(files)];
}

export function repoRelativePath(file, cwd = process.cwd()) {
  const repoRoot = findRepoRoot(cwd);
  const absolute = path.isAbsolute(file) ? file : path.resolve(cwd, file);
  return path.relative(repoRoot, absolute).replace(/\\/g, "/").replace(/^\.\//, "");
}

// Single source of truth for the seeded Obsidian graph colors, shared by fb-init and fb-fix.
// rgb as a packed integer = (r<<16)|(g<<8)|b
export const DEFAULT_GRAPH_JSON = {
  "collapse-filter": true,
  search: "",
  showTags: false,
  showAttachments: false,
  hideUnresolved: false,
  showOrphans: true,
  "collapse-color-groups": false,
  colorGroups: [
    { query: "path:features", color: { a: 1, rgb: 3705853 } },  // blue
    { query: "path:specs",    color: { a: 1, rgb: 1357990 } },  // teal   — plain-language counterpart to features
    { query: "path:states",   color: { a: 1, rgb: 4176208 } },  // green
    { query: "path:shared",   color: { a: 1, rgb: 10711543 } }, // purple
    { query: "path:apis",     color: { a: 1, rgb: 14391812 } }, // amber
    { query: "path:tasks/issues",    color: { a: 1, rgb: 15158332 } }, // red    — new, untriaged
    { query: "path:tasks/decisions", color: { a: 1, rgb: 15965202 } }, // orange — triaged, awaiting confirmation
    { query: "path:tasks/backlog",   color: { a: 1, rgb: 10181046 } }, // slate   — accepted, planned later
    { query: "path:tasks/hold",      color: { a: 1, rgb: 16705372 } }, // yellow  — blocked, waiting to resume
    { query: "path:tasks/action",    color: { a: 1, rgb: 3447003 } },  // cyan/blue — confirmed, in progress
    { query: "path:tasks/done",      color: { a: 1, rgb: 9807270 } },  // gray    — completed
    { query: "path:tasks/cancelled", color: { a: 1, rgb: 6513507 } },  // dark gray — intentionally closed
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

// Single source of truth for the seeded Obsidian appearance (fonts + accent color),
// shared by fb-init and fb-fix.
export const DEFAULT_APPEARANCE_JSON = {
  interfaceFontFamily: "Noto Sans,Noto Sans Thai Looped",
  textFontFamily: "Noto Sans,Noto Sans Thai Looped",
  monospaceFontFamily: "Noto Sans Mono,Noto Sans Thai Looped",
  accentColor: "#5cf58f",
};

// Find the vault root (.feature-books) walking up from cwd
export function findVaultDir(start = process.cwd()) {
  let dir = path.resolve(start);
  for (;;) {
    const candidate = path.join(dir, ".feature-books");
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

// Read the configured prose language for every workflow that creates or edits docs.
// Keep the fallback here so deterministic scripts and AI-driven commands agree.
export function readContentLanguage(vaultDir = findVaultDir()) {
  if (!vaultDir) return "English";
  try {
    const config = JSON.parse(fs.readFileSync(path.join(vaultDir, ".fbconfig.json"), "utf8"));
    return typeof config.language === "string" && config.language.trim()
      ? config.language.trim()
      : "English";
  } catch {
    return "English";
  }
}

// repo root = the folder that contains .feature-books
export function findRepoRoot(start = process.cwd()) {
  const v = findVaultDir(start);
  return v ? path.dirname(v) : process.cwd();
}

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === ".obsidian" || name.startsWith(".")) continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (name.endsWith(".md")) out.push(full);
  }
  return out;
}

function stripQuotes(s) {
  s = s.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))
    s = s.slice(1, -1);
  return s.trim();
}
// "[[feat-x]]" -> "feat-x"
function unwrapLink(s) {
  const m = stripQuotes(s).match(/^\[\[(.+?)\]\]$/);
  return m ? m[1].trim() : stripQuotes(s);
}

// Minimal YAML frontmatter parser for the subset our schema uses
export function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const lines = m[1].split("\n");
  const data = {};
  let currentKey = null;
  for (const raw of lines) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    const list = raw.match(/^\s*-\s+(.*)$/);
    if (list && currentKey) {
      data[currentKey].push(list[1]);
      continue;
    }
    const kv = raw.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (kv) {
      const key = kv[1];
      const val = kv[2].trim();
      if (val === "" ) { data[key] = []; currentKey = key; }
      else if (val === "[]") { data[key] = []; currentKey = null; }
      else if (val.startsWith("[") && val.endsWith("]")) {
        data[key] = val.slice(1, -1).split(",").map(s => s.trim()).filter(Boolean);
        currentKey = null;
      } else { data[key] = val; currentKey = null; }
    }
  }
  return data;
}

// Load all feature-book notes in the vault (excludes tasks/ — those have a different schema
// and are loaded separately via loadTasks() — and excludes specs/, which holds plain-language
// product specs with no id/type/status/depends_on schema and are never graph nodes).
export function loadNotes(vaultDir = findVaultDir()) {
  if (!vaultDir) return [];
  const repoRoot = path.dirname(vaultDir);
  return walk(vaultDir)
    .filter((file) => {
      const rel = path.relative(vaultDir, file).replace(/\\/g, "/");
      return !rel.startsWith("tasks/") && !rel.startsWith("specs/");
    })
    .map((file) => {
      const fm = parseFrontmatter(fs.readFileSync(file, "utf8")) || {};
      const arr = (k) => (Array.isArray(fm[k]) ? fm[k] : fm[k] ? [fm[k]] : []);
      return {
        file: path.relative(repoRoot, file).replace(/\\/g, "/"),
        id: fm.id || path.basename(file, ".md"),
        title: fm.title || "",
        type: fm.type || "",
        status: fm.status || "",
        depends_on: arr("depends_on").map(unwrapLink),
        impacts: arr("impacts").map(unwrapLink),
        core_files: arr("core_files").map(stripQuotes),
        related_states: arr("related_states").map(stripQuotes),
        capability: stripQuotes(String(fm.capability || "")),
        role: stripQuotes(String(fm.role || "")),
        cross_repo: arr("cross_repo").map(stripQuotes),
        related_files: arr("related_files").map(stripQuotes),
      };
    });
}

// Task/issue card schema (tasks/) — a separate concept from feature books. Cards move physically
// between task lifecycle folders as they progress; only issues -> decisions is automated (by
// /fb-triage). Backlog, hold, action, done, and cancelled are manual decisions by the user.
export const TASK_KINDS = ["feature", "enhancement", "bug", "note"];
export const TASK_STATUSES = ["new", "triaged", "backlog", "hold", "in-progress", "done", "cancelled"];
export const TASK_EFFORTS = ["S", "M", "L", "XL"];
// Feature status describes the current implementation lifecycle, not whether every related
// task card is done. A stable feature may still have optional enhancements in the backlog and
// can return to active in a later sprint.
export const FEATURE_STATUSES = ["draft", "active", "stable", "paused", "deprecated"];
// Which status a card is expected to carry given which tasks/ subfolder it physically lives in —
// used by fb-tasks-lint.mjs to catch drift after a manual drag that forgot to update frontmatter.
export const TASK_FOLDER_STATUS = {
  issues: "new",
  decisions: "triaged",
  backlog: "backlog",
  hold: "hold",
  action: "in-progress",
  done: "done",
  cancelled: "cancelled",
};

// Load all task/issue cards from tasks/ (any lifecycle subfolder)
export function loadTasks(vaultDir = findVaultDir()) {
  if (!vaultDir) return [];
  const repoRoot = path.dirname(vaultDir);
  const tasksDir = path.join(vaultDir, "tasks");
  if (!fs.existsSync(tasksDir)) return [];
  return walk(tasksDir).map((file) => {
    const raw = fs.readFileSync(file, "utf8");
    const parsed = parseFrontmatter(raw); // null if the file has no --- frontmatter block at all
    const fm = parsed || {};
    const arr = (k) => (Array.isArray(fm[k]) ? fm[k] : fm[k] ? [fm[k]] : []);
    const relFromVault = path.relative(vaultDir, file).replace(/\\/g, "/"); // tasks/<folder>/<file>.md
    const folder = relFromVault.split("/")[1] || null;
    const idSlug = path.basename(file, ".md");
    // A card needs normalization if it lacks frontmatter entirely, is missing a required field,
    // or its stamped id doesn't match its own filename (e.g. hand-created directly in Obsidian).
    const needsNormalization =
      !parsed || !fm.title || !fm.kind || !fm.status || !fm.created || (fm.id && fm.id !== idSlug);
    return {
      file: path.relative(repoRoot, file).replace(/\\/g, "/"),
      folder,
      hasFrontmatter: parsed !== null,
      needsNormalization,
      id: fm.id || idSlug,
      title: fm.title || "",
      kind: fm.kind || "",
      status: fm.status || "",
      // the YAML literal `null` is parsed by our minimal parser as the string "null" — normalize it
      effort: fm.effort && fm.effort !== "null" ? fm.effort : null,
      related: arr("related").map(unwrapLink),
      capability: stripQuotes(String(fm.capability || "")),
      hold_reason: stripQuotes(String(fm.hold_reason || "")),
      resume_when: stripQuotes(String(fm.resume_when || "")),
      held_at: stripQuotes(String(fm.held_at || "")),
      cancellation_reason: stripQuotes(String(fm.cancellation_reason || "")),
      cancelled_at: stripQuotes(String(fm.cancelled_at || "")),
      created: fm.created || "",
    };
  });
}

// glob -> RegExp (supports ** and *)
export function globToRegExp(glob) {
  let re = "^";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") { re += ".*"; i++; if (glob[i + 1] === "/") i++; }
      else re += "[^/]*";
    } else if ("\\^$+?.()|[]{}".includes(c)) re += "\\" + c;
    else re += c;
  }
  return new RegExp(re + "$");
}

// Which notes' fences contain this (repo-relative) file path
export function ownersOf(relPath, notes) {
  const p = relPath.replace(/\\/g, "/").replace(/^\.\//, "");
  return notes.filter((n) => n.core_files.some((g) => globToRegExp(g).test(p)));
}
