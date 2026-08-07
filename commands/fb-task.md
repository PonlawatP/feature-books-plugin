---
description: Create a new task/issue card in tasks/issues/ (the untriaged inbox)
argument-hint: <kind> <short title>
---

Create a new Task card from the input: `$ARGUMENTS`

Steps:
1. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/fb-config.mjs" get` and save the returned language.
   Do this **before drafting or editing any prose**. Write `title`, `Description`,
   `Logic Spec / Steps`, and `Triage Notes` prose in that language. Keep ids, tags, paths, code,
   enum values, and schema keys unchanged. Do not infer the document language from the user's
   current message when it differs from the configured value. Translate the Markdown section
   headings too; their English names below describe the template structure only.
2. Parse the argument into `<kind>` (feature | enhancement | bug | note) and `<title>` (the rest).
   - If `kind` is missing or not one of the four, or `title` is empty → ask the user briefly first.
3. Generate `id` as `task-<kebab-case slug of title>`. If a card with that id already exists anywhere
   under `tasks/` (all lifecycle folders) → append `-2`, `-3`, etc. until unique.
4. Get today's date by running `date +%F` — do not guess or infer it.
5. Write `.feature-books/tasks/issues/<id>.md`:
   - frontmatter: `id`, `title`, `kind`, `status: new`, `effort: null`, `related: []`, `created: <date from step 4>`
   - body:
     - `## Description` — a short description. Ask the user for one if it wasn't given; do not invent it.
     - `## Logic Spec / Steps` — **only** when `kind` is `feature` or `enhancement`: the business
       logic / step-by-step spec for the work. Ask the user for this if not already given — do not
       invent business logic on their behalf.
     - `## Triage Notes` — leave empty; this is filled in later by `/fb-triage`.
6. Report the created file path to the user. Remind them the card stays untriaged (`status: new`,
   sitting in `tasks/issues/`) until `/fb-triage` processes it.
