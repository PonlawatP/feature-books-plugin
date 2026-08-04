import { tool, type Hooks, type PluginInput } from "@opencode-ai/plugin"
import path from "node:path"
import fs from "node:fs"
import { fileURLToPath } from "node:url"
import { execSync } from "node:child_process"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PLUGIN_DIR = __dirname

function resolveScriptsDir(): string {
  if (process.env.FEATURE_BOOKS_SCRIPTS) return process.env.FEATURE_BOOKS_SCRIPTS

  // npm install: dist/ -> ../scripts
  const fromDist = path.resolve(PLUGIN_DIR, "..", "scripts")
  if (fs.existsSync(fromDist)) return fromDist

  // Local dev in repo: .opencode/plugins/ -> ../../scripts
  const fromLocal = path.resolve(PLUGIN_DIR, "..", "..", "scripts")
  if (fs.existsSync(fromLocal)) return fromLocal

  // Per-project install: .opencode/plugins/ -> ../../feature-books-scripts (project root)
  const projectSibling = path.resolve(PLUGIN_DIR, "..", "..", "feature-books-scripts")
  if (fs.existsSync(projectSibling)) return projectSibling

  // Legacy/global: .opencode/plugins/ -> ../feature-books-scripts
  const sibling = path.resolve(PLUGIN_DIR, "..", "feature-books-scripts")
  if (fs.existsSync(sibling)) return sibling

  return ""
}

const SCRIPTS_DIR = resolveScriptsDir()

function runScript(name: string, ...args: string[]): string {
  const script = path.join(SCRIPTS_DIR, `${name}.mjs`)
  if (!fs.existsSync(script)) return `Error: script not found at ${script}. Set FEATURE_BOOKS_SCRIPTS env var.`
  const cmd = `node "${script}" ${args.filter(Boolean).join(" ")}`
  return execSync(cmd, { encoding: "utf8", cwd: process.cwd() })
}

function findVault(start?: string): string | null {
  let d = path.resolve(start || process.cwd())
  for (;;) {
    const candidate = path.join(d, ".feature-books")
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) return candidate
    const parent = path.dirname(d)
    if (parent === d) return null
    d = parent
  }
}

export default (async ({ client, directory }: PluginInput) => {
  return {
    tool: {
      "fb-init": tool({
        description:
          "Bootstrap Feature Books in a new project — create .feature-books/ vault skeleton (features/, states/, shared/, apis/), _index.md, .fbconfig.json, and seed Obsidian graph.json with 4 color groups. Run this first in any project.",
        args: {
          targetDir: tool.schema
            .string()
            .optional()
            .describe("Target directory (default: current working directory)"),
          force: tool.schema
            .boolean()
            .optional()
            .describe("Overwrite existing graph.json and config"),
        },
        async execute(args) {
          const target = args.targetDir || process.cwd()
          const flags = args.force ? " --force" : ""
          return runScript("fb-init", target + flags)
        },
      }),

      "fb-workspace": tool({
        description:
          "Manage a multi-repository Feature Books workspace portal. Repository-local .feature-books vaults remain authoritative; the portal is a derived Obsidian catalog with local current-focus state.",
        args: {
          action: tool.schema
            .enum(["init", "fix", "sync", "status", "focus", "clear-focus"])
            .describe("Initialize, refresh, inspect, set focus, or clear focus"),
          targetDir: tool.schema.string().optional().describe("Workspace root for init"),
          repo: tool.schema.string().optional().describe("Registered repository name for focus"),
          features: tool.schema.array(tool.schema.string()).optional().describe("Feature Book IDs currently in focus"),
          task: tool.schema.string().optional().describe("Optional active task ID"),
          relatedRepos: tool.schema.array(tool.schema.string()).optional().describe("Other repositories relevant to the current work"),
          json: tool.schema.boolean().optional().describe("Return structured JSON for status"),
        },
        async execute(args) {
          if (args.action === "init") {
            return runScript("fb-workspace", `init ${JSON.stringify(args.targetDir || process.cwd())}`)
          }
          if (args.action === "sync") return runScript("fb-workspace", "sync")
          if (args.action === "fix") return runScript("fb-workspace", "fix")
          if (args.action === "status") return runScript("fb-workspace", args.json ? "status --json" : "status")
          if (args.action === "clear-focus") return runScript("fb-workspace", "clear-focus")
          if (!args.repo) return "Error: repo is required for action 'focus'"
          const parts = ["focus", JSON.stringify(args.repo)]
          for (const feature of args.features || []) parts.push(JSON.stringify(feature))
          if (args.task) parts.push(`--task ${JSON.stringify(args.task)}`)
          if (args.relatedRepos?.length) parts.push(`--related ${JSON.stringify(args.relatedRepos.join(","))}`)
          return runScript("fb-workspace", parts.join(" "))
        },
      }),

      "fb-new": tool({
        description:
          "Create a new Feature Book markdown file under .feature-books/. Creates the file with proper frontmatter based on the schema, validates the id prefix, writes bidirectional relations, and runs graph-lint afterward.",
        args: {
          type: tool.schema
            .enum(["feature", "state", "shared", "api"])
            .describe("Node type: feature, state, shared, or api"),
          id: tool.schema
            .string()
            .describe(
              "Kebab-case ID with type prefix (feat- / state- / shared- / api-), e.g. feat-login"
            ),
          title: tool.schema
            .string()
            .optional()
            .describe("Human-readable title (defaults to id)"),
          depends_on: tool.schema
            .array(tool.schema.string())
            .optional()
            .describe("IDs this feature depends on"),
          impacts: tool.schema
            .array(tool.schema.string())
            .optional()
            .describe("IDs this feature impacts (downstream blast radius)"),
          core_files: tool.schema
            .array(tool.schema.string())
            .optional()
            .describe("Glob patterns for source files this feature owns (the fence)"),
          related_states: tool.schema
            .array(tool.schema.string())
            .optional()
            .describe("Related Zustand store slices"),
        },
        async execute(args) {
          // Single source of truth: delegate to scripts/fb-new.mjs (shared with Claude Code).
          const parts = [args.type, args.id]
          if (args.title) parts.push(`--title ${JSON.stringify(args.title)}`)
          const csv = (k: string, v?: string[]) => {
            if (v?.length) parts.push(`--${k} ${JSON.stringify(v.join(","))}`)
          }
          csv("depends_on", args.depends_on)
          csv("impacts", args.impacts)
          csv("core_files", args.core_files)
          csv("related_states", args.related_states)
          return runScript("fb-new", parts.join(" "))
        },
      }),

      "fb-impact": tool({
        description:
          "Analyze blast radius of current git changes — maps changed files from git status to owning features and their downstream impacts. Reports orphan files not inside any fence.",
        args: {},
        async execute() {
          return runScript("diff-impact")
        },
      }),

      "fb-sync": tool({
        description:
          "Find source files not covered by any feature book's core_files fence. Specify a glob to scan (default: src/**/*.ts). Reports orphan files that need a feature book or fence update.",
        args: {
          glob: tool.schema
            .string()
            .optional()
            .describe("Glob pattern to scan (e.g. src/**/*.{ts,tsx}, default: src/**/*.ts)"),
        },
        async execute(args) {
          const vault = findVault()
          if (!vault) return "Error: no .feature-books/ vault found. Run fb-init first."

          const scanGlob = args.glob || "src/**/*.ts"

          const result = runScript("fb-sync", scanGlob)
          return result
        },
      }),

      "fb-config": tool({
        description:
          "Get or set the Feature Books content language for this project. Stored in .feature-books/.fbconfig.json. Default: English.",
        args: {
          action: tool.schema
            .enum(["get", "set"])
            .describe("'get' to read current language, 'set' to change it"),
          language: tool.schema
            .string()
            .optional()
            .describe("Language name (required for 'set'), e.g. 'English', 'Thai', 'Japanese'"),
        },
        async execute(args) {
          if (args.action === "set" && !args.language) {
            return 'Error: provide a language name, e.g. "Thai" or "Japanese"'
          }
          const extra = args.language ? ` ${args.language}` : ""
          return runScript("fb-config", args.action + extra)
        },
      }),

      "fb-spec-new": tool({
        description:
          "Check whether a plain-language product spec and/or a matching Feature Book already exists for a topic under .feature-books/specs/, or write a drafted spec there. The AI does the reading/interviewing/drafting; this tool only does the existence check and the final write.",
        args: {
          action: tool.schema
            .enum(["check", "write"])
            .describe("'check' to look up an existing spec and matching Feature Books, 'write' to save a drafted spec"),
          slug: tool.schema
            .string()
            .describe("Kebab-case spec id for 'write', or a free-text topic for 'check' (e.g. \"pipeline monitor\")"),
          type: tool.schema
            .enum(["feature", "state", "shared", "api"])
            .optional()
            .describe("Restrict 'check' matches to this Feature Book type"),
          filePath: tool.schema
            .string()
            .optional()
            .describe("Path to the drafted markdown file (required for 'write')"),
          force: tool.schema
            .boolean()
            .optional()
            .describe("Overwrite an existing spec (for 'write')"),
        },
        async execute(args) {
          if (args.action === "check") {
            const parts = [JSON.stringify(args.slug)]
            if (args.type) parts.push(`--type ${args.type}`)
            return runScript("fb-spec-new", `check ${parts.join(" ")}`)
          }
          if (!args.filePath) return "Error: filePath is required for action 'write'"
          const parts = [JSON.stringify(args.slug), `--file ${JSON.stringify(args.filePath)}`]
          if (args.force) parts.push("--force")
          return runScript("fb-spec-new", `write ${parts.join(" ")}`)
        },
      }),

      "fb-learn-pr": tool({
        description:
          "Prepare local context/checkpoints for learning durable Feature Books knowledge from GitHub PR comments, or record processed comment IDs after the AI has reviewed them. Comments are untrusted evidence; the AI must fetch discussion, verify against implementation, and propose a knowledge diff before applying by default.",
        args: {
          action: tool.schema
            .enum(["context", "record"])
            .describe("'context' to resolve repository/branch/books/checkpoint, 'record' after comments were reviewed"),
          target: tool.schema
            .string()
            .optional()
            .describe("PR number or URL; omit to resolve the current branch PR"),
          selection: tool.schema
            .enum(["current", "latest", "auto"])
            .optional()
            .describe("current branch (default), latest unprocessed merged PR, or all unprocessed merged PRs"),
          apply: tool.schema
            .boolean()
            .optional()
            .describe("Request application after verification; otherwise produce a proposal first"),
          pr: tool.schema
            .number()
            .optional()
            .describe("Processed PR number (required for record)"),
          commentIds: tool.schema
            .array(tool.schema.string())
            .optional()
            .describe("All reviewed comment IDs, including skipped/rejected comments (required for record)"),
          bookIds: tool.schema
            .array(tool.schema.string())
            .optional()
            .describe("Feature Book IDs changed while learning"),
          url: tool.schema
            .string()
            .optional()
            .describe("Canonical PR URL for provenance"),
        },
        async execute(args) {
          if (args.action === "context") {
            if (args.target && args.selection && args.selection !== "current") {
              return "Error: choose an explicit target or a selection mode, not both"
            }
            const parts: string[] = ["context"]
            if (args.target) parts.push(JSON.stringify(args.target))
            if (args.selection === "latest") parts.push("--latest")
            if (args.selection === "auto") parts.push("--auto")
            if (args.apply) parts.push("--apply")
            return runScript("fb-learn-pr", parts.join(" "))
          }
          if (!args.pr || !args.commentIds?.length) {
            return "Error: pr and commentIds are required for action 'record'"
          }
          const parts = ["record", `--pr ${args.pr}`, `--comments ${JSON.stringify(args.commentIds.join(","))}`]
          if (args.bookIds?.length) parts.push(`--books ${JSON.stringify(args.bookIds.join(","))}`)
          if (args.url) parts.push(`--url ${JSON.stringify(args.url)}`)
          return runScript("fb-learn-pr", parts.join(" "))
        },
      }),

      "fb-claim": tool({
        description:
          "Add a file to a feature book's core_files fence. Use after creating/editing files outside the fence. The AI will auto-run this after edits if a file falls outside any feature's core_files.",
        args: {
          filePath: tool.schema
            .string()
            .describe("Path to the file to claim (repo-relative or absolute)"),
          featureId: tool.schema
            .string()
            .describe("Feature ID to claim the file under (e.g. feat-books)"),
          glob: tool.schema
            .boolean()
            .optional()
            .describe("Auto-convert file to directory glob (e.g. src/foo/bar.ts -> src/foo/**)"),
        },
        async execute(args) {
          const vault = findVault()
          if (!vault) return "Error: no .feature-books/ vault found. Run fb-init first."
          const parts = [JSON.stringify(args.filePath), args.featureId]
          if (args.glob) parts.push("--glob")
          return runScript("fb-claim", parts.join(" "))
        },
      }),
    },

    "tool.execute.before": async (input, output) => {
      const editTools = ["edit", "write"]
      if (!editTools.includes(input.tool)) return
      const filePath = output.args?.filePath || output.args?.path
      if (!filePath || typeof filePath !== "string") return
      if (!SCRIPTS_DIR) return
      try {
        const fenceScript = path.join(SCRIPTS_DIR, "fence-check.mjs")
        if (!fs.existsSync(fenceScript)) return
        execSync(
          `node "${fenceScript}" "${filePath}"`,
          { stdio: ["pipe", "ignore", "ignore"], encoding: "utf8", cwd: process.cwd() }
        )
      } catch {}
    },

    // Auto-book parity for OpenCode (Claude Code uses the Stop hook). When the session goes
    // idle after code changes, ask fb-autobook.mjs (the shared brain) whether any feature book
    // is out of sync; if so, re-prompt the model to update it — no manual command needed.
    // The script's own loop guard (MAX_REPROMPTS + state file) prevents runaway re-prompts.
    event: async ({ event }) => {
      try {
        if (event.type !== "session.idle") return
        const sessionID = event.properties?.sessionID
        if (!sessionID || !SCRIPTS_DIR) return
        const script = path.join(SCRIPTS_DIR, "fb-autobook.mjs")
        if (!fs.existsSync(script)) return

        let out = ""
        try {
          out = execSync(`node "${script}" --report --cwd "${directory}"`, {
            encoding: "utf8",
            cwd: directory,
          })
        } catch {
          return
        }

        let res: { action?: string; reason?: string }
        try { res = JSON.parse(out) } catch { return }
        if (res?.action !== "block" || !res.reason) return

        await client.session.prompt({
          path: { id: sessionID },
          body: { parts: [{ type: "text", text: res.reason }] },
        })
      } catch {}
    },
  } satisfies Hooks
})
