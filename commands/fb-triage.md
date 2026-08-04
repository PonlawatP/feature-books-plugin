---
description: Read every card in the tasks inbox (including hand-created Obsidian notes with no/partial frontmatter), normalize it to the standard format, link it to related feature books, estimate effort, and move it to tasks/decisions/
---

Triage the Feature Books task inbox (`tasks/issues/`). Unlike the version/staleness checks, this
command is meant to use your judgment (reading, linking, estimating) — it is not a plain script.

**Cards are not only created by `/fb-task`.** Most are created by hand directly in Obsidian — a
note dropped into `tasks/issues/` with no frontmatter at all, partial/malformed frontmatter, or
prose that doesn't follow the `## Description` / `## Logic Spec / Steps` headings. Triage must
convert these into the standard format too, not just cards that already look right.

Steps:
1. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/fb-tasks-list.mjs" --inbox --json` to get every card
   **physically located in `tasks/issues/`**, regardless of its `status` field or whether it has
   frontmatter at all — folder location, not the status field, is what makes something "inbox".
   Don't rely on globbing yourself; this is the authoritative list, and it flags `hasFrontmatter`
   and `needsNormalization` per card so you know which ones need the heavier rewrite below.
2. If the list is empty → tell the user the inbox is empty and stop.
3. For **each** card, read the full file, then:
   a. **Normalize the format.** Bring the file to the standard shape:
      - frontmatter: `id`, `title`, `kind`, `status`, `effort`, `related`, `created`.
      - `id`: if missing, or if it doesn't match the file's own name, generate `task-<kebab-case
        slug of the title>` and rename the file to match (`mv`) — do this rename as part of the
        same move to `decisions/` in step (e), not as a separate step.
      - `title`: use existing frontmatter if present; otherwise take it from an H1 heading in the
        body, or fall back to a human-readable version of the filename.
      - `kind`: infer feature | enhancement | bug | note from the content (bug report language →
        `bug`, a request to add/change behavior → `feature`/`enhancement`, anything else → `note`).
        Only ask the user if genuinely ambiguous and it materially changes handling — don't stop
        the whole triage run for one unclear card, note the ambiguity and make a reasonable call.
      - `created`: if not in frontmatter, use the file's filesystem timestamp (`stat` /
        `ls -l --time-style=+%F`) rather than guessing; note in Triage Notes that it was inferred.
      - Body: if it's freeform prose with no `## Description` heading, wrap the existing content
        under `## Description` rather than discarding it — **preserve what the user wrote**, don't
        rewrite their words. If it's `kind: feature`/`enhancement` and has a list of steps/behavior
        anywhere in the body, lift that into `## Logic Spec / Steps`; if there's genuinely no spec
        content, leave that section as `_TBD — not specified by the author_` rather than inventing
        one.
      - If the card is too sparse to make sense of at all (no usable title or content) — don't
        force it into the template; flag it in your summary and leave it in `tasks/issues/` for the
        user to flesh out.
   b. **Link related graphs**: search `.feature-books/features/`, `states/`, `shared/`, `apis/` for
      feature books related to this card (by keyword match on title/body, by file paths mentioned
      in the card overlapping a feature's `core_files`, or by explicit `[[id]]` mentions already in
      the card). Add each match to the frontmatter `related` list as `"[[id]]"` — don't invent a
      relation that isn't actually supported by the card's content.
   c. **Estimate effort** as one of `S` / `M` / `L` / `XL`:
      - `S` — trivial, one file, no feature-book impact
      - `M` — contained within a single feature's fence
      - `L` — touches multiple features or has real `impacts`/blast radius
      - `XL` — cross-cutting / architectural
      Write the estimate plus a one-line rationale under `## Triage Notes`.
   d. Set `status: triaged`.
   e. **Move** the file with `mv` from `tasks/issues/<old name>.md` to `tasks/decisions/<id>.md`
      (renaming it to the normalized `id` if it wasn't already named that) — editing the frontmatter
      is not enough, the card must physically move.
4. After all cards are processed, run `node "${CLAUDE_PLUGIN_ROOT}/scripts/fb-tasks-lint.mjs"` and
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/graph-lint.mjs"`. Fix any ERRORS before reporting done.
5. Summarize to the user, per card: title, kind, effort, related features found, and confirm it's
   now in `tasks/decisions/` (mention if it was renamed). List any cards you skipped and why.
6. Remind the user explicitly: this command only moves `issues/` → `decisions/`. Moving a card from
   `decisions/` to `action/` (once they confirm they'll work on it) or from `action/` to `done/`
   (once it's complete) is a manual drag they do themselves — `/fb-triage` never does either move.
