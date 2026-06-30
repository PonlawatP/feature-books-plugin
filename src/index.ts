import { tool, type Hooks } from "@opencode-ai/plugin"
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

export default (async () => {
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
        const result = execSync(
          `node "${fenceScript}" "${filePath}"`,
          { encoding: "utf8", cwd: process.cwd() }
        )
        if (result.trim()) process.stderr.write(result)
      } catch {}
    },
  } satisfies Hooks
})
