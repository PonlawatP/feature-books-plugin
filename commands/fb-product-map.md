---
description: Survey every module in the product, write a product module map + diagrams + click-through prototypes of improvement options for one focus area, all under .feature-books/specs/
argument-hint: <focus area> [slug] e.g. "workspace" or "workspace product-module-map"
---

Produce a decision aid for a product owner: what modules the product has today, how mature each is,
which backend serves it, how one **focus area** connects to the rest, and a ranked list of options
to improve that focus area - with diagrams and clickable prototypes. The output is a spec bundle,
not code.

Output bundle (in the vault's `specs/`, `<slug>` defaults to `product-module-map`):

| file | what |
|---|---|
| `<slug>.md` | the map - source of truth, Obsidian-native (`![[...png]]`, `[[wikilinks]]`) |
| `<slug>-diagrams.md` | diagram gallery: each image + how to read it + what it shows |
| `<slug>.html`, `<slug>-diagrams.html` | rendered copies for people without Obsidian: theme toggle, light/dark diagram swap, zoom/pan lightbox |
| `<slug>-prototypes.html` | click-through sketches of the top options, one scene per option id, fake data |
| `assets/<slug>/NN-<name>.{svg,dark.svg,png}` | diagrams: light SVG, dark SVG, PNG (PNG is what Obsidian embeds) |

Templates for every file are in `${CLAUDE_PLUGIN_ROOT}/templates/product-map/`. Copy them; do not
redesign the viewer or prototype chrome from scratch.

Steps:

1. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/fb-spec-new.mjs" check "<slug>"` for the `vault`
   path, `language`, and `specExists`.
   - Write all prose (md and html, including viewer/prototype chrome labels) in `language`. Keep
     ids, paths, code, and option ids unchanged. Set `<html lang>` to match.
   - If `specExists`, read the existing bundle and ask whether to refresh it before rewriting.
   - Ask the user for the focus area if `$ARGUMENTS` does not name one.

2. **Survey in parallel.** Split the product into 4-6 teams by navigation group (sidebar/menu),
   plus one dedicated team for the focus area. Find the groups from the real router/menu config.
   If subagents are available, run one per team concurrently; otherwise do the teams one after
   another. Each team reports, from code and existing Feature Books:
   - every module with a UI entry point: what it does, route, backend (service + message
     subject/endpoint), maturity (`live` / `partial` / `stub`), permission guard, owning book
   - backends that live **outside** this repo/workspace: still live, but say the server code was
     not read - never call them mock
   - code with no menu/link entry (prototypes, legacy pages): list it as dead code, not a module
   - numbered integration gaps with the focus area (`team A#1`, ...), stale books, dead code,
     TODOs, unguarded routes
   - a draft `feat-<module>-overview` book for any module with no Feature Book (use `/fb-new`)
   - the focus team adds a capability matrix: pages x capabilities, `Y` / `P` / `N`

   Label anything not confirmed in code "(inferred)". Every claim cites its team and gap number.

3. **Write `<slug>.md`** from `templates/product-map/map.md`. Merge the team reports; dedupe gaps
   that several teams found (that agreement is the strongest evidence). Turn gaps into option ids
   `O1..On` (or a prefix that fits the focus area, e.g. `W1` for Workspace) with Impact H/M/L,
   Effort S/M/L, and evidence. Impact/effort are **planner estimates** - say so in the doc. The
   suggested order is a recommendation, not a decision; the product owner's open questions go last.
   Write via `node "${CLAUDE_PLUGIN_ROOT}/scripts/fb-spec-new.mjs" write <slug> --file <tmp>` (add
   `--force` only after the user confirmed a refresh).

4. **Diagrams.** If the `diagram-design` skill is available, use it for these four (its types in
   brackets); otherwise draw hand-written SVG with the same content:
   1. `01-module-map` [architecture / tree] - nav group -> module (fill = maturity, dashed border =
      backend outside the repo) -> backend dots (hollow = outside, solid = inside)
   2. `02-capability-heatmap` [heatmap] - focus pages x capabilities, Y/P/N cells
   3. `03-integration-flow` [data flow] - modules into the focus area; solid = exists, dashed =
      proposed and labelled with option ids
   4. `04-opportunity-quadrant` [quadrant] - impact x effort of every option
   For each, export a light `.svg`, a dark `.dark.svg`, and a `.png` into `assets/<slug>/`. Embed any
   custom font into the SVG (a local-only font renders as a fallback elsewhere). Open each PNG and
   check that labels do not overlap or clip before moving on. Then write `<slug>-diagrams.md` from
   `templates/product-map/diagrams.md`.

5. **HTML copies.** Render `<slug>.md` and `<slug>-diagrams.md` into `templates/product-map/viewer.html`
   (one `<h2 id="sN">` + nav entry per section, light `.svg` in `<figure><img>` - the script swaps
   to `.dark.svg` and adds the lightbox). Convert wikilinks to `<span class="book">` text and Obsidian
   embeds to `<figure>`. Replace every `{{PLACEHOLDER}}`; none may remain.

6. **Prototypes.** Pick the options worth seeing (quick wins + the top big bets, usually 5-8).
   Take screenshots of the live app first (a browser/e2e skill if one is available) and copy its
   layout, header, and color tokens into `templates/product-map/prototypes.html` so the sketch looks
   like the real product. One `<section data-scene="<option-id>">` per option; mark proposed UI with
   `class="new" data-new="<option-id>"`; reuse the `ask()` modal and `toast()` helpers. Fake data
   only, no API calls. Link the prototype from sections 4 and 5 of `<slug>.md` (`#<option-id>`).

7. **Verify before reporting.** Open both HTML pages and the prototype in a browser if possible:
   theme toggle swaps diagrams, lightbox opens/zooms, every scene button works, no console errors,
   no `{{` left (`grep -n '{{' specs/<slug>*`). Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/graph-lint.mjs"`
   for the new draft books.

8. Report: bundle paths, module counts (live/partial/stub), the option table's top picks, new draft
   books created, and anything you could not verify (external backends, unopened pages).

Rules: never present an estimate as a measurement; never call a live module mock because its
backend is outside the repo; do not edit product code in this command - debt found goes in section
6 (or `/fb-task` cards if the user asks).
