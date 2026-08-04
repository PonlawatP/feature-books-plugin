---
description: Generate or refresh a plain-language product spec under .feature-books/specs/. Checks first whether a Feature Book already exists for the topic — most specs are written before implementation, so usually none will.
argument-hint: <topic or feature-id> e.g. "pipeline monitor" or feat-pipeline-monitor-shell
---

This project writes specs first: most of the time you're drafting a product spec for something
that hasn't been implemented yet, so no Feature Book will exist for it. That's the expected case,
not an error — don't treat "no match found" as something to apologize for or work around.

Steps:

1. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/fb-spec-new.mjs" check "$ARGUMENTS"` to get a JSON
   report: whether a spec already exists at that slug, and whether any Feature Book(s) already
   match the topic by id/title keywords.
   - Read the report's `language` field **before drafting or editing any prose**. Write the entire
     spec in that language. Keep ids, paths, code, and other technical literals unchanged. Do not
     infer the language from the user's current message when it differs from this configured value.
   - If `specExists` is true, tell the user and ask whether they want to refresh it (read the
     existing spec first so you know what would actually change) before drafting anything new.

2. Branch on `matchingFeatureBooks`:

   **Empty (expected/common — nothing has been built yet):**
   - Tell the user no Feature Book exists yet for this topic — normal for spec-first work.
   - Check the current session's available skills:
     - If `grill-with-docs` is available and the user has other grounding material (a PRD, ticket,
       design doc, or attached file), use it against that material to surface clarifying questions.
     - Else if `grill-me` is available, use it to interrogate the feature idea directly with the
       user (goals, user flow, edge cases, what "done" looks like).
     - If neither is installed, ask the user directly in chat for what's needed to fill out the
       template below — don't block on it if they've already given enough in this conversation.
       Both skills are optional enhancements; the command must work without either installed.
   - Draft the spec from the interview/conversation.

   **Non-empty (the feature already exists in code):**
   - Read every matched Feature Book in full, plus any `shared/*.md` files they link to via
     `[[wikilink]]` in frontmatter (`depends_on`/`impacts`) or body.
   - If the matches form a `depends_on`/`impacts` cluster (e.g. a shell plus several card
     components underneath it), treat the whole cluster as one spec — don't produce one output
     file per component.
   - Note in the spec's Overview that it was written from an existing implementation, since that's
     the exception to this project's normal spec-first flow, not the rule.
   - Draft the spec from the Feature Book content.

3. Draft the spec in the configured `language` using this structure (translate the headings too;
   the English labels below describe the structure, not the required output language):
   ```
   # <Feature name> — Product Spec

   ## Overview
   ## User flow
   ## Cards / sections   (rename the unit if it fits better — Screens, Steps, etc. — one
                           subsection per user-visible unit)
   ## Shared behaviors    (only if reusing documented shared/*.md behaviors)
   ## Open questions / status
   ```
   Strip implementation detail regardless of which branch you took above: no source file paths,
   component/class names, algorithm or library names, hex colors, test file references, YAML
   frontmatter, `[[wikilinks]]`, or git-style change logs. Keep the business rule and its
   user-visible effect (e.g. keep "no-data slots render greyed out," drop the rendering technique
   behind it).

4. Write the draft to a temp file, then run:
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/fb-spec-new.mjs" write <slug> --file <temp-file-path>`
   If it refuses because the spec already exists, show the user what would change and only re-run
   with `--force` after they confirm.

5. Report the final path and a one-line summary of what the spec covers, and say plainly whether
   it was written spec-first (no Feature Book yet) or derived from an existing implementation.
