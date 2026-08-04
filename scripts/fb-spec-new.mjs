#!/usr/bin/env node
// Deterministic helpers for /fb-spec-new. The AI owns the judgment (matching relevance, reading
// Feature Books, drafting the spec, running grill-me/grill-with-docs); this script only does the
// mechanical existence checks and the final write — same split as fb-new.mjs owning the write but
// not the judgment.
//
// Usage:
//   node fb-spec-new.mjs check <slug-or-topic> [--type feature|state|shared|api]
//   node fb-spec-new.mjs write <slug> --file <path-to-drafted-markdown> [--force]
import fs from "node:fs";
import path from "node:path";
import { findVaultDir, loadNotes, readContentLanguage } from "./_lib.mjs";

const [sub, ...rest] = process.argv.slice(2);

function parseFlags(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) flags[key] = "true";
      else { flags[key] = next; i++; }
    } else positional.push(a);
  }
  return { positional, flags };
}

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function usage() {
  console.error("✗ Usage:");
  console.error("    fb-spec-new.mjs check <slug-or-topic> [--type feature|state|shared|api]");
  console.error("    fb-spec-new.mjs write <slug> --file <path-to-drafted-markdown> [--force]");
  process.exit(1);
}

if (sub === "check") {
  const { positional, flags } = parseFlags(rest);
  const topic = positional.join(" ");
  if (!topic) usage();

  const vault = findVaultDir();
  if (!vault) {
    console.log(JSON.stringify({ error: "no-vault", message: "No .feature-books/ vault found. Run fb-init first." }));
    process.exit(1);
  }

  const slug = slugify(topic);
  const specPath = path.join(vault, "specs", `${slug}.md`);
  const specExists = fs.existsSync(specPath);
  const language = readContentLanguage(vault);

  // Keyword match against existing Feature Books' ids/titles. loadNotes() already excludes
  // tasks/ and specs/ — specs are not graph nodes, so they never show up here as a "match".
  const words = topic
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2);
  const typeFilter = flags.type;
  const notes = loadNotes(vault).filter((n) => !typeFilter || n.type === typeFilter);
  const matches = notes
    .filter((n) => words.some((w) => n.id.toLowerCase().includes(w) || (n.title || "").toLowerCase().includes(w)))
    .map((n) => ({
      id: n.id,
      type: n.type,
      status: n.status,
      file: n.file,
      depends_on: n.depends_on,
      impacts: n.impacts,
    }));

  console.log(
    JSON.stringify(
      {
        vault,
        slug,
        specPath: path.join(".feature-books", "specs", `${slug}.md`),
        specExists,
        language,
        matchingFeatureBooks: matches,
        note:
          matches.length === 0
            ? "No Feature Book matches this topic yet — expected for spec-first work (nothing implemented yet)."
            : "Matching Feature Book(s) found — this feature already exists in code; derive the spec from them.",
      },
      null,
      2
    )
  );
  process.exit(0);
}

if (sub === "write") {
  const { positional, flags } = parseFlags(rest);
  const [slugArg] = positional;
  if (!slugArg || !flags.file) usage();

  const vault = findVaultDir();
  if (!vault) {
    console.error("✗ No .feature-books/ vault found. Run fb-init first.");
    process.exit(1);
  }

  const slug = slugify(slugArg);
  const specsDir = path.join(vault, "specs");
  fs.mkdirSync(specsDir, { recursive: true });
  const destPath = path.join(specsDir, `${slug}.md`);

  if (fs.existsSync(destPath) && !flags.force) {
    console.error(`✗ .feature-books/specs/${slug}.md already exists (not overwriting — pass --force to replace it)`);
    process.exit(1);
  }

  if (!fs.existsSync(flags.file)) {
    console.error(`✗ Draft file not found at ${flags.file}`);
    process.exit(1);
  }

  const content = fs.readFileSync(flags.file, "utf8");
  fs.writeFileSync(destPath, content);
  console.log(`✓ Wrote .feature-books/specs/${slug}.md`);
  process.exit(0);
}

usage();
