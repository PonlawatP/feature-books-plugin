---
description: Create a new task/issue card in tasks/issues/ (the untriaged inbox)
argument-hint: <kind> <short title>
---

Create a new Task card from the input: `$ARGUMENTS`

Steps:
1. Parse the argument into `<kind>` (feature | enhancement | bug | note) and `<title>` (the rest).
   - If `kind` is missing or not one of the four, or `title` is empty → ask the user briefly first.
2. Generate `id` as `task-<kebab-case slug of title>`. If a card with that id already exists anywhere
   under `tasks/` (issues/decisions/action/done) → append `-2`, `-3`, etc. until unique.
3. Get today's date by running `date +%F` — do not guess or infer it.
4. Write `.feature-books/tasks/issues/<id>.md`:
   - frontmatter: `id`, `title`, `kind`, `status: new`, `effort: null`, `related: []`, `created: <date from step 3>`
   - body:
     - `## Description` — a short description. Ask the user for one if it wasn't given; do not invent it.
     - `## Logic Spec / Steps` — **only** when `kind` is `feature` or `enhancement`: the business
       logic / step-by-step spec for the work. Ask the user for this if not already given — do not
       invent business logic on their behalf.
     - `## Triage Notes` — leave empty; this is filled in later by `/fb-triage`.
5. Report the created file path to the user. Remind them the card stays untriaged (`status: new`,
   sitting in `tasks/issues/`) until `/fb-triage` processes it.
