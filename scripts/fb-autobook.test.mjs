import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "fb-autobook.mjs");

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

function runHook(cwd, sessionId, ...args) {
  return execFileSync(process.execPath, [script, ...args], {
    cwd,
    input: JSON.stringify({ cwd, session_id: sessionId }),
    encoding: "utf8",
  });
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fb-autobook-"));
  fs.mkdirSync(path.join(root, ".feature-books", "features"), { recursive: true });
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(path.join(root, ".feature-books", ".fbconfig.json"), JSON.stringify({ language: "English" }));
  fs.writeFileSync(path.join(root, ".feature-books", "features", "feat-existing.md"), `---
id: feat-existing
title: Existing
type: feature
status: stable
core_files:
  - src/existing.ts
depends_on: []
impacts: []
related_states: []
---

## Change Log
`);
  fs.writeFileSync(path.join(root, "src", "existing.ts"), "export const value = 1;\n");
  git(root, "init", "-q");
  git(root, "config", "user.email", "test@example.com");
  git(root, "config", "user.name", "Test");
  git(root, "add", ".");
  git(root, "commit", "-qm", "fixture");
  return root;
}

test("ignores a pre-existing dirty file that the session did not change", () => {
  const root = fixture();
  try {
    fs.writeFileSync(path.join(root, "src", "existing.ts"), "export const value = 2;\n");
    runHook(root, "session-a", "--snapshot");
    assert.equal(runHook(root, "session-a"), "");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("detects a pre-existing dirty file when this session changes it", () => {
  const root = fixture();
  try {
    fs.writeFileSync(path.join(root, "src", "existing.ts"), "export const value = 2;\n");
    runHook(root, "session-b", "--snapshot");
    fs.writeFileSync(path.join(root, "src", "existing.ts"), "export const value = 3;\n");
    const result = JSON.parse(runHook(root, "session-b"));
    assert.equal(result.decision, "block");
    assert.match(result.reason, /src\/existing\.ts/);
    assert.match(result.reason, /changed during this session/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("tells the agent to create a new feature automatically for a new capability", () => {
  const root = fixture();
  try {
    runHook(root, "session-c", "--snapshot");
    fs.writeFileSync(path.join(root, "src", "new-capability.ts"), "export const enabled = true;\n");
    const result = JSON.parse(runHook(root, "session-c"));
    assert.equal(result.decision, "block");
    assert.match(result.reason, /CREATE the book automatically now/);
    assert.match(result.reason, /ask the user only when.*genuinely ambiguous/i);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
