#!/usr/bin/env node
// Auto-book: after a turn that changed code, make sure the Feature Books reflect it.
// A NEW feature gets a new book; a CHANGED feature gets a fresh Change Log entry.
// The user never has to run /fb-new, /fb-claim or /fb-impact by hand.
//
// Three runtimes, one brain (analyze()):
//   • Claude Code / Codex — default mode reads the Stop-hook payload on stdin and, if books
//     are out of sync, prints {"decision":"block","reason":…} so the turn continues until fixed.
//   • OpenCode     — `--report [--cwd <dir>]`: prints {"action":"block"|"pass","reason":…}
//     for the plugin's session.idle handler, which re-prompts the model via the SDK.
//
// Self-limiting: caps re-prompts on an unchanged pending set (MAX_REPROMPTS) so it can never
// trap the session, and self-terminates the moment the books reflect the change. Kill switch:
// FB_AUTOBOOK=0.
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { loadNotes, ownersOf, findVaultDir } from "./_lib.mjs";

const DEBUG = process.env.FB_AUTOBOOK_DEBUG === "1";
const dbg = (m) => { if (DEBUG) process.stderr.write(`[fb-autobook] ${m}\n`); };

// A hook must never break the session — any doubt, let the turn end.
const pass = () => process.exit(0);
const killed = () => ["0", "off", "false"].includes((process.env.FB_AUTOBOOK || "").toLowerCase());

const MAX_REPROMPTS = 3;
const STATE_FILE = ".fb-autobook.json";
// Only these count as "code" for orphan (new-feature) detection. Files already owned by
// a book are always relevant regardless of extension.
const CODE_EXT = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue", ".svelte", ".py", ".go",
  ".rs", ".java", ".rb", ".php", ".cs", ".kt", ".swift", ".scala", ".c", ".cc",
  ".cpp", ".h", ".hpp", ".dart", ".astro", ".sql",
]);

async function readPayload() {
  if (process.stdin.isTTY) return {};
  let data = "";
  try { for await (const c of process.stdin) data += c; } catch { return {}; }
  if (!data.trim()) return {};
  try { return JSON.parse(data); } catch { return {}; }
}

function changedFiles(repoRoot) {
  let out;
  try {
    // Strip only trailing newlines — a plain .trim() would eat the leading
    // space of the first porcelain line (e.g. " M src/…"), shifting slice(3)
    // by one char and corrupting the path ("src" -> "rc").
    out = execSync("git status --porcelain --untracked-files=all", { cwd: repoRoot })
      .toString().replace(/[\r\n]+$/, "");
  } catch {
    return null; // not a git repo / git missing -> can't detect -> don't block
  }
  if (!out) return [];
  return out
    .split("\n")
    .map((l) => l.slice(3).trim().replace(/\\/g, "/"))
    .filter(Boolean)
    .filter((f) => !f.startsWith(".feature-books/") && !f.startsWith(".claude/"));
}

// True if the note's Change Log region already contains `date` (YYYY-MM-DD).
function changelogHasDate(repoRoot, note, date) {
  let txt;
  try { txt = fs.readFileSync(path.join(repoRoot, note.file), "utf8"); }
  catch { return false; }
  const idx = txt.toLowerCase().indexOf("## change log");
  const region = idx >= 0 ? txt.slice(idx) : txt;
  return region.includes(date);
}

function readLanguage(vault) {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(vault, ".fbconfig.json"), "utf8"));
    if (cfg.language) return cfg.language;
  } catch {}
  return "English";
}

// Keep the transient state file out of git (self-heals older vaults with no .gitignore).
function ensureGitignore(vault) {
  try {
    const gi = path.join(vault, ".gitignore");
    let cur = "";
    try { cur = fs.readFileSync(gi, "utf8"); } catch {}
    if (cur.split(/\r?\n/).some((l) => l.trim() === STATE_FILE)) return;
    const sep = cur && !cur.endsWith("\n") ? "\n" : "";
    fs.writeFileSync(gi, cur + sep + STATE_FILE + "\n");
  } catch {}
}

const statePath = (vault) => path.join(vault, STATE_FILE);
function readState(vault) {
  try { return JSON.parse(fs.readFileSync(statePath(vault), "utf8")); } catch { return null; }
}
function writeState(vault, s) {
  try { ensureGitignore(vault); fs.writeFileSync(statePath(vault), JSON.stringify(s)); } catch {}
}
function clearState(vault) {
  try { fs.rmSync(statePath(vault), { force: true }); } catch {}
}

// Pure analysis: which feature books are out of sync with the changed code?
function pendingSet(repoRoot, vault, changed, today) {
  const notes = loadNotes(vault);
  const stale = new Map(); // id -> { title, file, files:Set }
  const orphans = [];
  for (const f of changed) {
    const owners = ownersOf(f, notes);
    if (owners.length) {
      for (const o of owners) {
        if (changelogHasDate(repoRoot, o, today)) continue; // book already touched today
        if (!stale.has(o.id)) stale.set(o.id, { title: o.title, file: o.file, files: new Set() });
        stale.get(o.id).files.add(f);
      }
    } else if (CODE_EXT.has(path.extname(f).toLowerCase())) {
      orphans.push(f);
    }
  }
  return { stale, orphans };
}

function buildMessage({ orphans, stale, today, language }) {
  const L = [];
  L.push("[feature-books] Update the Feature Book(s) before ending this turn.");
  L.push("");
  L.push(
    `You changed code but the matching Feature Book(s) don't reflect it yet. ` +
    `Do this now, then finish normally. Write all book prose in ${language} ` +
    `(per .feature-books/.fbconfig.json); keep ids, paths and code unchanged. ` +
    `The feature-books skill has the schema + rules.`
  );

  if (stale.size) {
    L.push("");
    L.push(`Changed features missing a Change Log entry for ${today}:`);
    for (const [id, v] of stale) {
      const files = [...v.files].join(", ");
      L.push(`  • ${id}${v.title ? ` (${v.title})` : ""} — ${files}`);
      L.push(
        `    → In ${v.file}: add a Change Log row "| ${today} | <what changed> |", ` +
        `and refresh Business Rules / State Flow / Edge Cases if the logic changed.`
      );
    }
  }

  if (orphans.length) {
    L.push("");
    L.push("Changed code files not owned by any Feature Book:");
    for (const f of orphans) L.push(`  • ${f}`);
    L.push("    → If these belong to an existing feature, use the feature-books workflow to claim them.");
    L.push("    → If this is a NEW feature, use the feature-books workflow to create a book (feature feat-<name>, set core_files), then fill in Overview + Business Rules.");
  }

  L.push("");
  L.push("After updating, run graph-lint.mjs from the installed Feature Books plugin.");
  L.push("(Re-checked when you finish; it goes quiet once the books reflect the change. Disable with FB_AUTOBOOK=0.)");
  return L.join("\n");
}

// The shared brain. Returns { decision: "block"|"pass", reason? }. Applies the loop guard.
function analyze(cwd) {
  const vault = findVaultDir(cwd);
  if (!vault) { dbg("no .feature-books vault"); return { decision: "pass" }; }
  const repoRoot = path.dirname(vault);

  const changed = changedFiles(repoRoot);
  if (changed === null) { dbg("git unavailable"); return { decision: "pass" }; }
  if (!changed.length) { clearState(vault); return { decision: "pass" }; }

  const today = new Date().toISOString().split("T")[0];
  const { stale, orphans } = pendingSet(repoRoot, vault, changed, today);
  if (!stale.size && !orphans.length) { dbg("all books fresh"); clearState(vault); return { decision: "pass" }; }

  // Loop guard: cap re-prompts on an identical pending set.
  const signature = JSON.stringify({ o: [...orphans].sort(), s: [...stale.keys()].sort() });
  const prev = readState(vault);
  const count = prev && prev.signature === signature ? (prev.count || 0) + 1 : 1;
  if (count > MAX_REPROMPTS) {
    dbg(`gave up after ${MAX_REPROMPTS} re-prompts on unchanged pending set`);
    clearState(vault);
    return { decision: "pass" };
  }
  writeState(vault, { signature, count });

  return { decision: "block", reason: buildMessage({ orphans, stale, today, language: readLanguage(vault) }) };
}

async function main() {
  const argv = process.argv.slice(2);
  const report = argv.includes("--report");

  if (killed()) {
    if (report) process.stdout.write(JSON.stringify({ action: "pass" }));
    process.exit(0);
  }

  let cwd;
  if (report) {
    const i = argv.indexOf("--cwd");
    cwd = i >= 0 && argv[i + 1] ? argv[i + 1] : process.cwd();
  } else {
    const payload = await readPayload();
    cwd = payload.cwd && fs.existsSync(payload.cwd) ? payload.cwd : process.cwd();
  }

  const res = analyze(cwd);

  if (report) {
    process.stdout.write(
      res.decision === "block"
        ? JSON.stringify({ action: "block", reason: res.reason })
        : JSON.stringify({ action: "pass" })
    );
    process.exit(0);
  }

  // Claude Code and Codex share this Stop-hook protocol.
  if (res.decision === "block") process.stdout.write(JSON.stringify({ decision: "block", reason: res.reason }));
  process.exit(0);
}

main().catch((e) => { dbg("error: " + (e && e.message)); pass(); });
