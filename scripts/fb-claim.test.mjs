import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "fb-claim.mjs");

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fb-claim-"));
  fs.mkdirSync(path.join(root, ".feature-books", "shared"), { recursive: true });
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(path.join(root, "src", "new-file.ts"), "export const value = 1;\n");
  // core_files followed by depends_on/impacts arrays with their own "- " items - the
  // regression shape for the "spliced into the wrong array" bug.
  fs.writeFileSync(path.join(root, ".feature-books", "shared", "shared-example.md"), `---
id: shared-example
type: shared
status: active
core_files:
  - src/existing.ts
depends_on: []
impacts:
  - "[[feat-consumer-a]]"
  - "[[feat-consumer-b]]"
related_states: []
---

## Overview
`);
  return root;
}

function claim(root, filePath, featureId, ...extraArgs) {
  return execFileSync(process.execPath, [script, filePath, featureId, ...extraArgs], {
    cwd: root,
    encoding: "utf8",
  });
}

test("claims a file into core_files without crashing on the vault path", () => {
  const root = fixture();
  try {
    const out = claim(root, "src/new-file.ts", "shared-example");
    assert.match(out, /Claimed "src\/new-file\.ts"/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("inserts the new entry into core_files, not into a later array (depends_on/impacts)", () => {
  const root = fixture();
  try {
    claim(root, "src/new-file.ts", "shared-example");
    const content = fs.readFileSync(
      path.join(root, ".feature-books", "shared", "shared-example.md"),
      "utf8",
    );
    const frontmatter = content.match(/^---\n([\s\S]*?)\n---/)[1];
    const coreFilesBlock = frontmatter.match(/core_files:\n((?:\s+- .*\n?)*)/)[1];
    const impactsBlock = frontmatter.match(/impacts:\n((?:\s+- .*\n?)*)/)[1];
    assert.match(coreFilesBlock, /- src\/new-file\.ts/);
    assert.doesNotMatch(impactsBlock, /new-file/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
