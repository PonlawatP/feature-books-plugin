#!/usr/bin/env node
// Auto-book: after a turn that changed code, make sure the Feature Books reflect it.
// A NEW feature gets a new book; a CHANGED feature gets a fresh Change Log entry and an explicit
// lifecycle decision. Feature status reflects the implementation scope completed in this turn,
// never the completion of every related task card.
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
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import { loadNotes, ownersOf, findVaultDir } from "./_lib.mjs";

const DEBUG = process.env.FB_AUTOBOOK_DEBUG === "1";
const dbg = (m) => { if (DEBUG) process.stderr.write(`[fb-autobook] ${m}\n`); };

// A hook must never break the session — any doubt, let the turn end.
const pass = () => process.exit(0);
const killed = () => ["0", "off", "false"].includes((process.env.FB_AUTOBOOK || "").toLowerCase());

const MAX_REPROMPTS = 3;
const STATE_FILE = ".fb-autobook.json";
const BASELINE_FILE = ".fb-autobook-baselines.json";
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

function statusEntries(repoRoot) {
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
  if (!out) return new Map();
  const entries = new Map();
  for (const line of out
    .split("\n")
    .filter(Boolean)) {
    const status = line.slice(0, 2);
    const raw = line.slice(3).trim();
    // For rename/copy porcelain records, ownership follows the destination path.
    const file = raw.includes(" -> ") ? raw.split(" -> ").at(-1) : raw;
    const normalized = file.replace(/\\/g, "/");
    if (normalized.startsWith(".feature-books/") || normalized.startsWith(".claude/")) continue;
    entries.set(normalized, status);
  }
  return entries;
}

function fileFingerprint(repoRoot, file, status) {
  const hash = crypto.createHash("sha256");
  hash.update(status || "");
  const abs = path.join(repoRoot, file);
  try {
    const stat = fs.statSync(abs);
    if (stat.isFile()) hash.update(fs.readFileSync(abs));
    else hash.update(`<non-file:${stat.mode}>`);
  } catch {
    hash.update("<missing>");
  }
  return hash.digest("hex");
}

function workingTreeSnapshot(repoRoot) {
  const entries = statusEntries(repoRoot);
  if (entries === null) return null;
  return Object.fromEntries(
    [...entries].map(([file, status]) => [file, fileFingerprint(repoRoot, file, status)])
  );
}

function changedFiles(repoRoot, baseline = null) {
  const current = workingTreeSnapshot(repoRoot);
  if (current === null) return null;
  if (!baseline) return Object.keys(current);
  return Object.keys(current).filter((file) => current[file] !== baseline[file]);
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

// Feature changes must record the lifecycle decision made for this implementation scope. This is
// intentionally explicit: a deterministic hook cannot infer whether the user's requested scope is
// complete, and unrelated optional task cards must not keep a feature active.
function changelogHasStatusDecision(repoRoot, note, date) {
  let txt;
  try { txt = fs.readFileSync(path.join(repoRoot, note.file), "utf8"); }
  catch { return false; }
  const idx = txt.toLowerCase().indexOf("## change log");
  const region = idx >= 0 ? txt.slice(idx) : txt;
  return region
    .split(/\r?\n/)
    .some((line) => line.includes(date) && /status\s*:\s*(active|stable|paused|deprecated)\b/i.test(line));
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
    const ignored = new Set(cur.split(/\r?\n/).map((l) => l.trim()));
    const missing = [STATE_FILE, BASELINE_FILE].filter((f) => !ignored.has(f));
    if (!missing.length) return;
    const sep = cur && !cur.endsWith("\n") ? "\n" : "";
    fs.writeFileSync(gi, cur + sep + missing.join("\n") + "\n");
  } catch {}
}

const baselinePath = (vault) => path.join(vault, BASELINE_FILE);
function readBaselines(vault) {
  try { return JSON.parse(fs.readFileSync(baselinePath(vault), "utf8")); } catch { return {}; }
}
function writeBaseline(vault, sessionId, baseline) {
  try {
    ensureGitignore(vault);
    const all = readBaselines(vault);
    all[sessionId] = { createdAt: new Date().toISOString(), files: baseline };
    // Bound transient state for long-lived repositories with many sessions.
    const recent = Object.fromEntries(
      Object.entries(all)
        .sort(([, a], [, b]) => String(b?.createdAt || "").localeCompare(String(a?.createdAt || "")))
        .slice(0, 50)
    );
    fs.writeFileSync(baselinePath(vault), JSON.stringify(recent));
  } catch {}
}
function readBaseline(vault, sessionId) {
  const entry = readBaselines(vault)[sessionId];
  return entry && entry.files ? entry.files : null;
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
        const hasFreshLog = changelogHasDate(repoRoot, o, today);
        const hasLifecycleDecision = o.type !== "feature" || changelogHasStatusDecision(repoRoot, o, today);
        if (hasFreshLog && hasLifecycleDecision) continue; // book already reconciled today
        if (!stale.has(o.id)) stale.set(o.id, {
          title: o.title,
          file: o.file,
          type: o.type,
          status: o.status,
          hasFreshLog,
          files: new Set(),
        });
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
  L.push("[feature-books] Reconcile the Feature Book(s) before ending this turn.");
  L.push("");
  L.push(
    `You changed code but the matching Feature Book(s) don't reflect it yet. ` +
    `Do this now, then finish normally. Write all book prose in ${language} ` +
    `(per .feature-books/.fbconfig.json); keep ids, paths and code unchanged. ` +
    `The feature-books skill has the schema + rules.`
  );
  L.push(
    `These files were changed during this session (pre-existing untouched git diffs are excluded). ` +
    `Reconcile the books autonomously; do not stop merely because the Feature Book is documentation or fenced.`
  );

  if (stale.size) {
    L.push("");
    L.push(`Changed books missing a fresh Change Log and/or feature lifecycle decision for ${today}:`);
    for (const [id, v] of stale) {
      const files = [...v.files].join(", ");
      L.push(`  • ${id}${v.title ? ` (${v.title})` : ""} — ${files}`);
      if (v.type === "feature") {
        L.push(
          `    → Reconcile the implementation lifecycle for THIS requested scope (current status: ${v.status || "missing"}). ` +
          `Use status: stable when the requested scope completed successfully, or status: active when it remains unfinished. ` +
          `A stable feature may still have unrelated/optional task cards and may become active again in a later sprint. ` +
          `Do not derive feature status by counting related tasks. Use paused or deprecated only when the user explicitly decided that.`
        );
        L.push(
          `    → In ${v.file}: set the frontmatter status and add a Change Log row ` +
          `"| ${today} | <what changed>; status: <active|stable> |". Refresh Business Rules / State Flow / Edge Cases if logic changed.`
        );
      } else {
        L.push(
          `    → In ${v.file}: add a Change Log row "| ${today} | <what changed> |", ` +
          `and refresh Business Rules / State Flow / Edge Cases if the logic changed.`
        );
      }
    }
  }

  if (orphans.length) {
    L.push("");
    L.push("Changed code files not owned by any Feature Book:");
    for (const f of orphans) L.push(`  • ${f}`);
    L.push("    → First decide ownership from the USER-REQUESTED CAPABILITY and its business rules, not from file proximity, reused code, or which existing feature it relates to.");
    L.push("    → Claim into an existing book ONLY when these files implement the same user-facing capability and business-rule boundary already documented there.");
    L.push("    → A distinct capability/workflow/outcome gets a NEW feature book even when it depends on, extends, or lightly changes an existing feature. Express 'related to' with depends_on / impacts; a graph relationship is not ownership.");
    L.push("    → For mixed scopes, update the existing book for its owned changes AND create a new book for the new capability. When uncertain, prefer the narrower new book and link it to the existing feature.");
    L.push("    → For a new capability, CREATE the book automatically now (feature feat-<name>, set core_files), then fill in Overview + Business Rules. Infer the id/title/relations from the user's request when safe; ask the user only when the capability boundary or ownership is genuinely ambiguous.");
  }

  L.push("");
  L.push("After updating, run graph-lint.mjs from the installed Feature Books plugin.");
  L.push("(Re-checked when you finish; it goes quiet once the books reflect the change. Disable with FB_AUTOBOOK=0.)");
  return L.join("\n");
}

// The shared brain. Returns { decision: "block"|"pass", reason? }. Applies the loop guard.
function analyze(cwd, sessionId = "default") {
  const vault = findVaultDir(cwd);
  if (!vault) { dbg("no .feature-books vault"); return { decision: "pass" }; }
  const repoRoot = path.dirname(vault);

  const changed = changedFiles(repoRoot, readBaseline(vault, sessionId));
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
  const snapshot = argv.includes("--snapshot");

  if (killed()) {
    if (report) process.stdout.write(JSON.stringify({ action: "pass" }));
    process.exit(0);
  }

  let cwd;
  let sessionId = "default";
  if (report) {
    const i = argv.indexOf("--cwd");
    cwd = i >= 0 && argv[i + 1] ? argv[i + 1] : process.cwd();
    const s = argv.indexOf("--session-id");
    sessionId = s >= 0 && argv[s + 1] ? argv[s + 1] : sessionId;
  } else {
    const payload = await readPayload();
    cwd = payload.cwd && fs.existsSync(payload.cwd) ? payload.cwd : process.cwd();
    sessionId = payload.session_id || payload.sessionId || sessionId;
  }

  if (snapshot) {
    const vault = findVaultDir(cwd);
    if (!vault) return;
    const baseline = workingTreeSnapshot(path.dirname(vault));
    if (baseline !== null) writeBaseline(vault, sessionId, baseline);
    return;
  }

  const res = analyze(cwd, sessionId);

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
