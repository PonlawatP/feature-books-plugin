#!/usr/bin/env node
// Deterministic state/context helper for /fb-learn-pr. The AI fetches and evaluates PR comments;
// this script only resolves local context and records an idempotency/provenance checkpoint.
//
// Usage:
//   node fb-learn-pr.mjs context [<pr-number-or-url>] [--latest] [--auto] [--apply]
//   node fb-learn-pr.mjs record --pr <number> --comments <id,id> [--books <id,id>] [--url <url>]
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { findRepoRoot, findVaultDir, loadNotes, readContentLanguage } from "./_lib.mjs";

const STATE_VERSION = 1;
const [sub = "context", ...rest] = process.argv.slice(2);

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) { positional.push(arg); continue; }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) flags[key] = true;
    else { flags[key] = next; i++; }
  }
  return { positional, flags };
}

function git(repoRoot, args) {
  try { return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim(); }
  catch { return ""; }
}

function repoSlug(remote) {
  const match = remote.match(/(?:github\.com[:/])([^/]+)\/([^/]+?)(?:\.git)?$/i);
  return match ? `${match[1]}/${match[2]}` : "";
}

function prNumber(value) {
  if (!value) return null;
  if (/^\d+$/.test(value)) return Number(value);
  const match = value.match(/\/pull\/(\d+)(?:\D|$)/);
  return match ? Number(match[1]) : null;
}

function csv(value) {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

const vault = findVaultDir();
if (!vault) {
  console.error("✗ Could not find .feature-books/ (run from inside the repo)");
  process.exit(1);
}
const repoRoot = findRepoRoot();
const statePath = path.join(vault, ".pr-learning.json");

function readState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(statePath, "utf8"));
    return { version: STATE_VERSION, processed: {}, ...parsed };
  } catch {
    return { version: STATE_VERSION, processed: {} };
  }
}

function writeState(state) {
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n");
}

function readPolicy() {
  try {
    const config = JSON.parse(fs.readFileSync(path.join(vault, ".fbconfig.json"), "utf8"));
    const value = config.prLearning || {};
    return {
      defaultMode: value.mode === "apply" ? "apply" : "propose",
      reviewers: Array.isArray(value.reviewers) ? value.reviewers.filter(Boolean) : [],
      mergedOnlyForAutomaticSelection: value.includeMergedOnly !== false,
      commentsAreUntrustedInput: true,
    };
  } catch {
    return {
      defaultMode: "propose",
      reviewers: [],
      mergedOnlyForAutomaticSelection: true,
      commentsAreUntrustedInput: true,
    };
  }
}

if (sub === "context") {
  const { positional, flags } = parseArgs(rest);
  const explicit = positional[0] || "";
  const explicitPr = prNumber(explicit);
  if (explicit && !explicitPr) {
    console.error("✗ PR target must be a pull request number or URL");
    process.exit(1);
  }
  if ([Boolean(explicitPr), Boolean(flags.latest), Boolean(flags.auto)].filter(Boolean).length > 1) {
    console.error("✗ Choose only one target: explicit PR, --latest, or --auto");
    process.exit(1);
  }

  const remote = git(repoRoot, ["remote", "get-url", "origin"]);
  const branch = git(repoRoot, ["branch", "--show-current"]);
  const state = readState();
  const notes = loadNotes(vault)
    .filter((note) => ["feature", "state", "shared", "api"].includes(note.type))
    .map((note) => ({
      id: note.id,
      type: note.type,
      file: note.file,
      core_files: note.core_files,
      depends_on: note.depends_on,
      impacts: note.impacts,
    }));

  console.log(JSON.stringify({
    repoRoot,
    vault,
    repository: repoSlug(remote),
    remote,
    branch,
    language: readContentLanguage(vault),
    selection: explicitPr
      ? { mode: "explicit", pr: explicitPr }
      : flags.latest
        ? { mode: "latest-unprocessed" }
        : flags.auto
          ? { mode: "all-unprocessed" }
          : { mode: "current-branch" },
    applyRequested: Boolean(flags.apply),
    policy: readPolicy(),
    checkpoint: state,
    books: notes,
  }, null, 2));
  process.exit(0);
}

if (sub === "record") {
  const { flags } = parseArgs(rest);
  const pr = prNumber(String(flags.pr || ""));
  if (!pr) {
    console.error("✗ record requires --pr <number>");
    process.exit(1);
  }
  const comments = csv(flags.comments);
  if (!comments.length) {
    console.error("✗ record requires --comments <id,id>");
    process.exit(1);
  }

  const remote = git(repoRoot, ["remote", "get-url", "origin"]);
  const repository = repoSlug(remote);
  const key = `${repository || remote || "local"}#${pr}`;
  const state = readState();
  const previous = state.processed[key] || {};
  const commentIds = [...new Set([...(previous.commentIds || []), ...comments])].sort();
  state.version = STATE_VERSION;
  state.processed[key] = {
    pr,
    url: flags.url || previous.url || (repository ? `https://github.com/${repository}/pull/${pr}` : ""),
    commentIds,
    books: [...new Set([...(previous.books || []), ...csv(flags.books)])].sort(),
    processedAt: new Date().toISOString(),
  };
  writeState(state);
  console.log(`✓ Recorded ${comments.length} PR comment(s) for ${key}`);
  console.log(path.relative(repoRoot, statePath).replace(/\\/g, "/"));
  process.exit(0);
}

console.error("✗ Usage: fb-learn-pr.mjs context [<pr-number-or-url>] [--latest|--auto] [--apply]");
console.error("         fb-learn-pr.mjs record --pr <number> --comments <id,id> [--books <id,id>] [--url <url>]");
process.exit(1);
