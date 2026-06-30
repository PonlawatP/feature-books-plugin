#!/usr/bin/env node
// Check which feature's fence a to-be-edited file belongs to — use as a PreToolUse hook or call directly.
// Advisory by default (does not block); set FENCE_STRICT=1 to block (exit 2).
import { loadNotes, ownersOf } from "./_lib.mjs";

async function getTargetFile() {
  const arg = process.argv[2];
  if (arg) return arg;
  // no arg -> read the hook payload from stdin (Claude Code PreToolUse)
  if (process.stdin.isTTY) return null;
  let data = "";
  for await (const chunk of process.stdin) data += chunk;
  if (!data.trim()) return null;
  try {
    const json = JSON.parse(data);
    return json?.tool_input?.file_path || json?.tool_input?.path || null;
  } catch { return null; }
}

const STRICT = process.env.FENCE_STRICT === "1";
const file = await getTargetFile();
if (!file) process.exit(0); // unknown file -> let it pass

// Silent when invoked as a hook (no argv, stdin piped from Claude Code / OpenCode).
// Prevents TUI corruption on both platforms. Direct CLI usage still shows output.
const isHook = !process.argv[2] && !process.stdin.isTTY;
const out = isHook ? () => {} : (msg) => console.error(msg);

const rel = file.replace(/\\/g, "/").replace(/^.*?(?=src\/|\.feature-books\/|\.claude\/)/, "");
// Don't warn when editing the feature books or the plugin itself
if (rel.startsWith(".feature-books/") || rel.startsWith(".claude/")) process.exit(0);

const notes = loadNotes();
const owners = ownersOf(rel, notes);

if (owners.length) {
  const ids = owners.map((o) => o.id).join(", ");
  const impacts = [...new Set(owners.flatMap((o) => o.impacts))];
  out(`[feature-books] This file is inside the fence of: ${ids}`);
  if (impacts.length) out(`[feature-books] Watch for impact on: ${impacts.join(", ")}`);
  process.exit(0);
}

// Not inside any feature's fence
out(`[feature-books] ⚠ "${rel}" is not in any feature's core_files — ` +
  `consider adding it to a feature book, or confirm the edit is intentional.`);
process.exit(STRICT ? 2 : 0);
