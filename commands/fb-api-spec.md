---
description: Keep Yaak requests in sync with new/changed APIs, adapted to the project's architecture (primary entrypoint + optional raw entrypoints such as an HTTP-to-NATS bridge)
argument-hint: [optional scope] e.g. "alert module" or a feature id; empty = current git diff
---

After a feature adds or changes an API, keep a matching Yaak request in sync. The script
`fb-api-spec.mjs` does the deterministic parts (profile, folder layout, idempotent upsert); you do
the judgment (which APIs changed, what a realistic body looks like).

Steps:

1. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/fb-api-spec.mjs" check` to get a JSON report: profile,
   `language`, whether the `yaak` CLI is available, the resolved Yaak workspace, existing folders and
   requests, an `index` of managed requests keyed `<entrypointId>|<METHOD>|<route>`, and `unmanaged`
   requests.
   - Read `language` **before writing any prose** (request names are fine as identifiers, but
     descriptions must be in that language). Keep ids, paths, and code literals unchanged.
   - If `yaakCli` is false, stop and tell the user to install Yaak.
   - If `profileExists` is false, interview the user briefly: which transport is the **primary**
     entrypoint that users/clients call (for example the gateway HTTP API), and which services also
     expose a **raw** direct entrypoint (for example an HTTP-to-NATS bridge where the request URL is
     the message subject). Get the URL template for each (use a literal `{route}` placeholder, keep
     Yaak `${[ var ]}` variables as they are) and the Yaak folder layout (`{module}` / `{service}`
     placeholders, `/` for nesting). Then run
     `node "${CLAUDE_PLUGIN_ROOT}/scripts/fb-api-spec.mjs" init [--yaak-workspace <wk_id>] --entry id=kind:role:method:urlTemplate:folder ...`
     (role is `primary` or `raw`; at least one `primary`).

2. Find the new or changed APIs from the current git diff (or the scope in `$ARGUMENTS`) and the
   owning Feature Books: HTTP controllers, NATS `@MessagePattern` handlers, and so on. Read the real
   DTO/schema to build a realistic body. Never invent fields.

3. Decide the requests:
   - A new API always gets a request on the `primary` entrypoint.
   - Also add a `raw` request when the service has its own message subject and the profile marks a
     raw entrypoint for it.
   - A changed API updates its existing request (look it up in `index`).

4. For each request, write the body to a temp file, then run
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/fb-api-spec.mjs" upsert --entry <id> --method <M> --route <path-or-subject> --name <str> [--module <name>] [--service <name>] --body-file <temp-file> [--body-type application/json] [--description <str>]`.
   It is idempotent: it reports `action: "created"` or `"updated"` with the request id and never
   duplicates or deletes.

5. Send each newly created request once with `yaak request send <rq_id>` (add `-e <env_id>` if the
   URL uses environment variables). HTTP errors do not fail the CLI exit code, so read the real
   status with `yaak response list <rq_id>` / `yaak response show <resp_id>` and report that
   status. A failing status is a finding to report, not something to hide.

6. Rules: never delete requests or folders; never write real secrets into environments or
   requests (use variables); report what was created vs updated, and the real HTTP status of each
   request you sent.
