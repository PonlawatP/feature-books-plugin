// Shared helpers for Feature Books scripts. Dependency-free (Node >= 16, ESM).
import fs from "node:fs";
import path from "node:path";

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

// Load all notes in the vault
export function loadNotes(vaultDir = findVaultDir()) {
  if (!vaultDir) return [];
  const repoRoot = path.dirname(vaultDir);
  return walk(vaultDir).map((file) => {
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
