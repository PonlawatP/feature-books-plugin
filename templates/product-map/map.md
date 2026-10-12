---
title: {{TITLE}}
type: spec
status: draft
last_reviewed: {{DATE}}
tags: [spec, product-map]
---

# {{TITLE}} - every module in the product, and options for {{FOCUS}}

> Built from {{N}} survey team reports ({{TEAM_IDS}}) on {{DATE}} to help the product owner decide what
> to add or improve in {{FOCUS}}. Anything not confirmed from code is labelled "(inferred)".
> Impact/effort values are estimates. Diagrams live in `assets/{{SLUG}}/` (see [[{{SLUG}}-diagrams]]).

## 1. Summary

- How many modules have a UI entry point; how many are live / partial / stub. Say plainly whether
  any module runs on mock data. Code with no menu/link entry is listed in section 6, not counted here.
- Which backends are outside this repo/workspace (live, but their server code cannot be read), and
  how many modules depend on them.
- Where {{FOCUS}} gets its inputs from today, and what is missing.
- **Main takeaway:** one sentence a product owner can repeat.

## 2. Module map

![[assets/{{SLUG}}/01-module-map.png]]
*Module map: navigation group -> module (color = maturity) -> backend service*

Maturity legend and source line (which teams, which date).

### 2.1 {{NAV_GROUP}}

| module | what it does | backend | maturity | feature book |
|---|---|---|---|---|
| | | | live / partial / stub | [[feat-...]] |

## 3. {{FOCUS}} today

![[assets/{{SLUG}}/02-capability-heatmap.png]]
*Capability heatmap: {{FOCUS}} pages x capabilities (Y/P/N)*

| page | capability 1 | capability 2 | ... |
|---|---|---|---|
| | Y / P / N | | |

- One bullet per page: lifecycle/states, who can do what, notable limits.
- "Missing entirely" bullet: capabilities that are N on every row.

### Permissions (summary)

## 4. Connections from other modules into {{FOCUS}}

![[assets/{{SLUG}}/03-integration-flow.png]]
*Data flow into {{FOCUS}}: solid = exists, dashed = proposed (option ids)*

Try it: `{{SLUG}}-prototypes.html` (#o1, ...) - sketched from screenshots of the real app, fake data

### Already feeding in

### Not feeding in yet (gaps)

## 5. Options

![[assets/{{SLUG}}/04-opportunity-quadrant.png]]
*Impact x effort quadrant of the options (estimates)*

Impact (H/M/L) and Effort (S/M/L) are **planner estimates**, not measurements; the product owner decides.

Try it: `{{SLUG}}-prototypes.html` - one scene per prototyped option

| ID | option | Impact (est.) | Effort (est.) | evidence |
|---|---|---|---|---|
| O1 | | H | M | team A#1, team B#2 |

### Quick wins (impact H/M + effort S)

### Big bets (impact H + effort M/L)

### Fill-ins

### Suggested order (a recommendation, not a decision)

### Questions the product owner must answer

## 6. Doc/code debt found

### Stale Feature Books

### Dead code / stub / TODO

### Routes without a permission guard

## 7. New Feature Books created by this survey

- **Team A - {{TEAM_A_AREA}} (n):** [[feat-...-overview]]
