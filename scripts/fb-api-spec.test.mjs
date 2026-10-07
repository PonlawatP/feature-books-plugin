import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "fb-api-spec.mjs");

// Fake `yaak` CLI backed by a JSON file (FB_FAKE_DB). Mirrors the real output formats:
// `<id> - <name>` for lists, `Created folder: <id>` for creates, JSON for show.
const SHIM = `#!${process.execPath}
const fs = require("node:fs");
const db = JSON.parse(fs.readFileSync(process.env.FB_FAKE_DB, "utf8"));
const save = () => fs.writeFileSync(process.env.FB_FAKE_DB, JSON.stringify(db));
const [grp, cmd, ...a] = process.argv.slice(2);
if (grp === "--help") process.exit(0);
const json = () => JSON.parse(a[a.indexOf("--json") + 1]);
const nextId = (p) => p + "_" + (++db.n);
if (grp === "workspace" && cmd === "list") console.log(db.workspaces.map((w) => w + " - ws").join("\\n"));
else if (grp === "folder" && cmd === "list") console.log(db.folders.map((f) => f.id + " - " + f.name).join("\\n"));
else if (grp === "request" && cmd === "list") console.log(db.requests.map((r) => r.id + " - " + r.method + " " + r.name).join("\\n"));
else if (cmd === "show") console.log(JSON.stringify((grp === "folder" ? db.folders : db.requests).find((x) => x.id === a[0])));
else if (grp === "folder" && cmd === "create") { const f = { id: nextId("fl"), ...json() }; db.folders.push(f); save(); console.log("Created folder: " + f.id); }
else if (grp === "request" && cmd === "create") { const r = { id: nextId("rq"), ...json() }; db.requests.push(r); save(); console.log("Created request: " + r.id); }
else if (grp === "request" && cmd === "update") { const p = json(); Object.assign(db.requests.find((x) => x.id === p.id), p); save(); console.log("Updated request: " + p.id); }
else { console.error("unsupported"); process.exit(2); }
`;

const ENTRIES = [
  "gateway=http:primary:POST:http://localhost:8008/api/v1/{route}:{module}",
  "bridge=http-nats:raw:POST:${[ nats_bridge ]}/{route}:{service}/raw",
];

function fixture({ withShim = true, workspaces = ["wk_1"] } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fb-api-spec-"));
  fs.mkdirSync(path.join(root, ".feature-books"), { recursive: true });
  const db = path.join(root, "fake-db.json");
  fs.writeFileSync(db, JSON.stringify({ n: 0, workspaces, folders: [], requests: [] }));
  const bin = path.join(root, "yaak-shim");
  fs.writeFileSync(bin, SHIM, { mode: 0o755 });
  fs.writeFileSync(path.join(root, "body.json"), '{"a":1}');
  const env = { ...process.env, FB_FAKE_DB: db, FB_YAAK_BIN: withShim ? bin : path.join(root, "missing-yaak") };
  const run = (...args) => spawnSync(process.execPath, [script, ...args], { cwd: root, env, encoding: "utf8" });
  const readDb = () => JSON.parse(fs.readFileSync(db, "utf8"));
  const entryArgs = ENTRIES.flatMap((e) => ["--entry", e]);
  return { root, run, readDb, entryArgs };
}

function withFx(fn, opts) {
  const fx = fixture(opts);
  try {
    fn(fx);
  } finally {
    fs.rmSync(fx.root, { recursive: true, force: true });
  }
}

const upsert = (fx, entry, route, extra = []) =>
  fx.run("upsert", "--entry", entry, "--method", "POST", "--route", route, "--name", route,
    "--module", "alert", "--service", "workflow", "--body-file", "body.json", ...extra);

test("init writes the profile, refuses overwrite without --force", () => {
  withFx((fx) => {
    const r = fx.run("init", ...fx.entryArgs);
    assert.equal(r.status, 0, r.stderr);
    const p = JSON.parse(fs.readFileSync(path.join(fx.root, ".feature-books", "api-specs", "profile.json"), "utf8"));
    assert.equal(p.entrypoints.length, 2);
    assert.equal(p.entrypoints[0].urlTemplate, "http://localhost:8008/api/v1/{route}");
    assert.equal(p.entrypoints[0].folder, "{module}");
    assert.equal(p.yaakWorkspaceId, null);
    assert.notEqual(fx.run("init", ...fx.entryArgs).status, 0);
    assert.equal(fx.run("init", ...fx.entryArgs, "--force").status, 0);
  });
});

test("init rejects missing primary and duplicate ids", () => {
  withFx((fx) => {
    const noPrimary = fx.run("init", "--entry", "b=x:raw:POST:http://h/{route}:f");
    assert.notEqual(noPrimary.status, 0);
    assert.match(noPrimary.stderr, /primary/);
    const dup = fx.run("init", "--entry", "a=x:primary:POST:http://h/{route}:f", "--entry", "a=x:raw:POST:http://i/{route}:g");
    assert.notEqual(dup.status, 0);
    assert.match(dup.stderr, /Duplicate/);
  });
});

test("upsert creates nested folders and the request", () => {
  withFx((fx) => {
    fx.run("init", ...fx.entryArgs);
    const r = upsert(fx, "bridge", "workflow.alert.get");
    assert.equal(r.status, 0, r.stderr);
    assert.equal(JSON.parse(r.stdout).action, "created");
    const db = fx.readDb();
    assert.deepEqual(db.folders.map((f) => [f.name, f.folderId]), [["workflow", null], ["raw", "fl_1"]]);
    assert.equal(db.requests.length, 1);
    assert.equal(db.requests[0].url, "${[ nats_bridge ]}/workflow.alert.get");
    assert.equal(db.requests[0].folderId, "fl_2");
  });
});

test("identical upsert updates in place; a different route creates another request", () => {
  withFx((fx) => {
    fx.run("init", ...fx.entryArgs);
    const first = JSON.parse(upsert(fx, "gateway", "alert/list").stdout);
    const second = JSON.parse(upsert(fx, "gateway", "alert/list", ["--description", "d"]).stdout);
    assert.equal(second.action, "updated");
    assert.equal(second.id, first.id);
    assert.equal(fx.readDb().requests.length, 1);
    assert.equal(fx.readDb().folders.length, 1);
    assert.equal(upsert(fx, "gateway", "alert/other").status, 0);
    assert.equal(fx.readDb().requests.length, 2);
  });
});

test("folder layout differs for primary vs raw", () => {
  withFx((fx) => {
    fx.run("init", ...fx.entryArgs);
    upsert(fx, "gateway", "alert/list");
    upsert(fx, "bridge", "workflow.alert.get");
    assert.deepEqual(fx.readDb().folders.map((f) => f.name), ["alert", "workflow", "raw"]);
  });
});

test("check reports the index and unmanaged requests", () => {
  withFx((fx) => {
    fx.run("init", ...fx.entryArgs);
    const created = JSON.parse(upsert(fx, "gateway", "alert/list").stdout);
    const db = fx.readDb();
    db.requests.push({ id: "rq_x", name: "stray", method: "GET", url: "http://elsewhere/x", folderId: null });
    fs.writeFileSync(path.join(fx.root, "fake-db.json"), JSON.stringify(db));
    const r = JSON.parse(fx.run("check").stdout);
    assert.equal(r.profileExists, true);
    assert.equal(r.yaakCli, true);
    assert.equal(r.language, "English");
    assert.equal(r.yaakWorkspaceId, "wk_1");
    assert.equal(r.index["gateway|POST|alert/list"], created.id);
    assert.deepEqual(r.unmanaged.map((u) => u.id), ["rq_x"]);
  });
});

test("check without a profile reports profileExists false", () => {
  withFx((fx) => {
    const r = JSON.parse(fx.run("check").stdout);
    assert.equal(r.profileExists, false);
  });
});

test("missing yaak CLI gives a clear error", () => {
  withFx((fx) => {
    fx.run("init", ...fx.entryArgs);
    const r = upsert(fx, "gateway", "alert/list");
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /yaak CLI not found/);
    assert.equal(JSON.parse(fx.run("check").stdout).yaakCli, false);
  }, { withShim: false });
});
