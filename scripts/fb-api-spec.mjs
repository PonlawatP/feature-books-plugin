#!/usr/bin/env node
// Deterministic helpers for /fb-api-spec: keep one Yaak request per API in sync with the code.
// The AI owns the judgment (which APIs changed, what the body looks like); this script owns the
// architecture profile and the idempotent create-or-update against the `yaak` CLI.
//
// Usage:
//   fb-api-spec.mjs init [--yaak-workspace <wk_id>] --entry id=kind:role:method:urlTemplate:folder ... [--force]
//   fb-api-spec.mjs check
//   fb-api-spec.mjs upsert --entry <id> --method <M> --route <path-or-subject> --name <str>
//                          [--module <name>] [--service <name>] --body-file <path>
//                          [--body-type application/json] [--description <str>]
// Env: FB_YAAK_BIN overrides the yaak executable (default "yaak").
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { findVaultDir, readContentLanguage } from "./_lib.mjs";

const PORTAL_DIR = ".feature-books-workspace";
const YAAK = process.env.FB_YAAK_BIN || "yaak";
const ROLES = ["primary", "raw"];

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

// Flags may repeat (--entry), so every flag collects into an array.
function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) fail(`Unexpected argument "${a}"`);
    const key = a.slice(2);
    const next = argv[i + 1];
    const val = next === undefined || next.startsWith("--") ? "true" : argv[++i];
    (flags[key] ||= []).push(val);
  }
  return flags;
}
const one = (flags, k) => flags[k]?.[flags[k].length - 1];

function profilePath() {
  let dir = process.cwd();
  for (;;) {
    if (fs.existsSync(path.join(dir, PORTAL_DIR, "workspace.json"))) {
      return path.join(dir, PORTAL_DIR, "api-specs", "profile.json");
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  const vault = findVaultDir();
  return vault ? path.join(vault, "api-specs", "profile.json") : null;
}

function readProfile(p) {
  if (!p || !fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    fail(`Cannot parse ${p}: ${e.message}`);
  }
}

// id=kind:role:method:urlTemplate:folder - the URL itself contains colons, so kind/role/method
// are taken from the front and folder from the last colon; the middle is the URL template.
function parseEntry(spec) {
  const eq = spec.indexOf("=");
  if (eq < 1) fail(`Bad --entry "${spec}" (expected id=kind:role:method:urlTemplate:folder)`);
  const id = spec.slice(0, eq);
  const parts = spec.slice(eq + 1).split(":");
  if (parts.length < 5) fail(`Bad --entry "${spec}" (expected id=kind:role:method:urlTemplate:folder)`);
  const [kind, role, method] = parts;
  const folder = parts[parts.length - 1];
  const urlTemplate = parts.slice(3, -1).join(":");
  if (!id || !kind || !method || !urlTemplate || !folder) fail(`Bad --entry "${spec}": empty field`);
  return { id, kind, role, method: method.toUpperCase(), urlTemplate, folder };
}

function yaak(args) {
  try {
    return execFileSync(YAAK, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    if (e.code === "ENOENT") fail(`yaak CLI not found ("${YAAK}"). Install Yaak or set FB_YAAK_BIN.`);
    fail(`yaak ${args.slice(0, 2).join(" ")} failed: ${(e.stderr || e.message).toString().trim()}`);
  }
}

function yaakAvailable() {
  try {
    execFileSync(YAAK, ["--help"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const listIds = (out) =>
  out.split("\n").map((l) => /^(\w+_\w+) - /.exec(l)?.[1]).filter(Boolean);
const showJson = (kind, id) => JSON.parse(yaak([kind, "show", id]));
const createdId = (out) => /\b(?:fl|rq)_\w+/.exec(out)?.[0] || fail(`Cannot read id from yaak output: ${out.trim()}`);

function resolveWorkspace(profile) {
  if (profile?.yaakWorkspaceId) return profile.yaakWorkspaceId;
  const ids = listIds(yaak(["workspace", "list"]));
  if (ids.length === 1) return ids[0];
  fail(ids.length ? "Several Yaak workspaces exist: set one with init --yaak-workspace <wk_id>" : "No Yaak workspace found");
}

function loadYaak(wk) {
  const folders = listIds(yaak(["folder", "list", wk])).map((id) => showJson("folder", id));
  const requests = listIds(yaak(["request", "list", wk])).map((id) => showJson("request", id));
  return { folders, requests };
}

// Match a request url against entrypoint templates; the longest literal prefix wins.
function routeOf(url, entry) {
  const [pre, post = ""] = entry.urlTemplate.split("{route}");
  if (!entry.urlTemplate.includes("{route}")) return url === pre ? { len: pre.length, route: "" } : null;
  if (url.startsWith(pre) && url.endsWith(post) && url.length >= pre.length + post.length) {
    return { len: pre.length, route: url.slice(pre.length, url.length - post.length) };
  }
  return null;
}

function keyOf(req, entries) {
  let best = null;
  for (const e of entries) {
    const m = routeOf(req.url, e);
    if (m && (!best || m.len > best.len)) best = { ...m, id: e.id };
  }
  return best && `${best.id}|${req.method.toUpperCase()}|${best.route}`;
}

function indexRequests(requests, entries) {
  const index = {};
  const unmanaged = [];
  for (const r of requests) {
    const k = keyOf(r, entries);
    if (k && !index[k]) index[k] = r.id;
    else unmanaged.push({ id: r.id, name: r.name, method: r.method, url: r.url });
  }
  return { index, unmanaged };
}

const [sub, ...rest] = process.argv.slice(2);

if (sub === "init") {
  const flags = parseFlags(rest);
  const p = profilePath();
  if (!p) fail("No .feature-books/ vault or .feature-books-workspace/ portal found. Run fb-init first.");
  if (fs.existsSync(p) && !flags.force) fail(`${p} already exists (pass --force to overwrite)`);
  const entrypoints = (flags.entry || []).map(parseEntry);
  const ids = new Set();
  for (const e of entrypoints) {
    if (!ROLES.includes(e.role)) fail(`Entry "${e.id}": role must be primary or raw, got "${e.role}"`);
    if (ids.has(e.id)) fail(`Duplicate entry id "${e.id}"`);
    ids.add(e.id);
  }
  if (!entrypoints.some((e) => e.role === "primary")) fail("At least one entry with role primary is required");
  const profile = { version: 1, tool: "yaak", yaakWorkspaceId: one(flags, "yaak-workspace") || null, entrypoints };
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(profile, null, 2) + "\n");
  console.log(JSON.stringify({ profilePath: p, profile }, null, 2));
  process.exit(0);
}

if (sub === "check") {
  const p = profilePath();
  const profile = readProfile(p);
  const report = {
    profilePath: p,
    profileExists: !!profile,
    profile,
    language: readContentLanguage(),
    yaakCli: yaakAvailable(),
  };
  if (profile && report.yaakCli) {
    const wk = resolveWorkspace(profile);
    const { folders, requests } = loadYaak(wk);
    const { index, unmanaged } = indexRequests(requests, profile.entrypoints);
    Object.assign(report, {
      yaakWorkspaceId: wk,
      folders: folders.map((f) => ({ id: f.id, name: f.name, parentId: f.folderId })),
      requests: requests.map((r) => ({ id: r.id, name: r.name, method: r.method, url: r.url, folderId: r.folderId })),
      index,
      unmanaged,
    });
  }
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

if (sub === "upsert") {
  const flags = parseFlags(rest);
  for (const k of ["entry", "method", "route", "name", "body-file"]) if (!one(flags, k)) fail(`--${k} is required`);
  const p = profilePath();
  const profile = readProfile(p) || fail("No api-specs profile found. Run init first.");
  const entry = profile.entrypoints.find((e) => e.id === one(flags, "entry")) || fail(`Unknown entry "${one(flags, "entry")}"`);
  const bodyFile = one(flags, "body-file");
  if (!fs.existsSync(bodyFile)) fail(`Body file not found at ${bodyFile}`);
  const method = one(flags, "method").toUpperCase();
  const route = one(flags, "route");
  const url = entry.urlTemplate.replace("{route}", () => route);

  const subst = (s) =>
    s.replace(/\{(module|service)\}/g, (_, k) => one(flags, k) || fail(`Entry folder "${entry.folder}" needs --${k}`));
  const folderPath = subst(entry.folder).split("/").filter(Boolean);

  const wk = resolveWorkspace(profile);
  const { folders, requests } = loadYaak(wk);
  let parent = null;
  for (const name of folderPath) {
    const hit = folders.find((f) => f.name === name && (f.folderId || null) === parent);
    if (hit) parent = hit.id;
    else {
      const out = yaak(["folder", "create", "--json", JSON.stringify({ workspaceId: wk, folderId: parent, name })]);
      const id = createdId(out);
      folders.push({ id, name, folderId: parent });
      parent = id;
    }
  }

  const bodyType = one(flags, "body-type") || "application/json";
  const body = { text: fs.readFileSync(bodyFile, "utf8") };
  const description = one(flags, "description");
  const key = `${entry.id}|${method}|${route}`;
  const { index } = indexRequests(requests, profile.entrypoints);
  const existingId = index[key];

  if (existingId) {
    const existing = requests.find((r) => r.id === existingId);
    // Merge headers so user-added ones (auth, etc.) survive; only Content-Type is managed.
    const headers = (existing.headers || []).filter((h) => h.name.toLowerCase() !== "content-type");
    headers.push({ name: "Content-Type", value: bodyType, enabled: true });
    const patch = { id: existingId, name: one(flags, "name"), url, body, bodyType, headers };
    if (description !== undefined) patch.description = description;
    yaak(["request", "update", "--json", JSON.stringify(patch)]);
    console.log(JSON.stringify({ action: "updated", id: existingId, key, url, folderId: existing.folderId }, null, 2));
    process.exit(0);
  }

  const payload = {
    workspaceId: wk,
    folderId: parent,
    name: one(flags, "name"),
    method,
    url,
    headers: [{ name: "Content-Type", value: bodyType, enabled: true }],
    bodyType,
    body,
    description: description || "",
  };
  const id = createdId(yaak(["request", "create", "--json", JSON.stringify(payload)]));
  console.log(JSON.stringify({ action: "created", id, key, url, folderId: parent }, null, 2));
  process.exit(0);
}

console.error("✗ Usage:");
console.error("    fb-api-spec.mjs init [--yaak-workspace <wk_id>] --entry id=kind:role:method:urlTemplate:folder ... [--force]");
console.error("    fb-api-spec.mjs check");
console.error("    fb-api-spec.mjs upsert --entry <id> --method <M> --route <r> --name <str> [--module <m>] [--service <s>] --body-file <path> [--body-type <t>] [--description <str>]");
process.exit(1);
