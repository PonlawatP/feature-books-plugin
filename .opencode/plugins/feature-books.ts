import { type Plugin, tool } from "@opencode-ai/plugin"
import path from "node:path"
import fs from "node:fs"
import { execSync } from "node:child_process"

const PLUGIN_DIR = import.meta.dirname
const SCRIPTS_DIR: string =
  process.env.FEATURE_BOOKS_SCRIPTS ||
  (() => {
    const local = path.resolve(PLUGIN_DIR, "..", "..", "scripts")
    return fs.existsSync(local) ? local : ""
  })() ||
  (() => {
    const sibling = path.resolve(PLUGIN_DIR, "..", "feature-books-scripts")
    return fs.existsSync(sibling) ? sibling : ""
  })()

function runScript(name: string, ...args: string[]): string {
  const script = path.join(SCRIPTS_DIR, `${name}.mjs`)
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

export const FeatureBooksPlugin: Plugin = async () => {
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
          const vault = findVault()
          if (!vault) return "Error: no .feature-books/ vault found. Run fb-init first."

          const prefixMap: Record<string, string> = {
            feature: "feat-",
            state: "state-",
            shared: "shared-",
            api: "api-",
          }
          const expected = prefixMap[args.type]
          if (!args.id.startsWith(expected)) {
            return `Warning: id "${args.id}" should start with "${expected}" for type "${args.type}"`
          }

          const folderMap: Record<string, string> = {
            feature: "features",
            state: "states",
            shared: "shared",
            api: "apis",
          }
          const folder = folderMap[args.type]
          const filePath = path.join(vault, folder, `${args.id}.md`)

          if (!fs.existsSync(path.join(vault, folder))) {
            fs.mkdirSync(path.join(vault, folder), { recursive: true })
          }
          if (fs.existsSync(filePath)) {
            return `Error: ${args.id}.md already exists at .feature-books/${folder}/${args.id}.md`
          }

          let language = "English"
          try {
            const cfg = JSON.parse(
              fs.readFileSync(path.join(vault, ".fbconfig.json"), "utf8")
            )
            if (cfg.language) language = cfg.language
          } catch {}

          const today = new Date().toISOString().split("T")[0]

          const lines: string[] = [
            "---",
            `id: ${args.id}`,
            `type: ${args.type}`,
            `status: draft`,
            `last_reviewed: ${today}`,
          ]
          if (args.title) lines.push(`title: ${args.title}`)

          const writeList = (key: string, vals?: string[]) => {
            if (!vals?.length) return
            lines.push(`${key}:`)
            vals.forEach((v) => lines.push(`  - ${v}`))
          }
          writeList("depends_on", args.depends_on)
          writeList("impacts", args.impacts)
          writeList("core_files", args.core_files)
          writeList("related_states", args.related_states)

          lines.push(
            "---",
            "",
            `# ${args.title || args.id}`,
            "",
            "## Business Rules",
            "",
            `<!-- Describe the business logic here, in ${language} -->`,
            "",
            "## Change Log",
            "",
            "| Date | Change |",
            "|------|--------|",
            `| ${today} | Created |`,
            ""
          )

          fs.writeFileSync(filePath, lines.join("\n"))

          // Add reciprocal relations to linked nodes
          const allLinks = [...(args.depends_on || []), ...(args.impacts || [])]
          for (const linkedId of allLinks) {
            const linkedFile = findNoteFile(vault, linkedId)
            if (!linkedFile) continue
            const content = fs.readFileSync(linkedFile, "utf8")
            const isImpact = (args.impacts || []).includes(linkedId)
            const field = isImpact ? "depends_on" : "impacts"
            if (!content.includes(`${field}:\n`)) {
              const updated = content.replace(
                /^---\n/,
                `---\n${field}:\n  - "[[${args.id}]]"\n`
              )
              fs.writeFileSync(linkedFile, updated)
            } else if (!content.includes(`[[${args.id}]]`)) {
              const updated = content.replace(
                new RegExp(`(${field}:\\n)`),
                `$1  - "[[${args.id}]]"\n`
              )
              fs.writeFileSync(linkedFile, updated)
            }
          }

          const lintResult = runScript("graph-lint")

          return `Created .feature-books/${folder}/${args.id}.md\n\n${lintResult}`
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

          const repoRoot = path.dirname(vault)
          const scanGlob = args.glob || "src/**/*.ts"

          // Delegate to a separate sync script that ESM-imports _lib.mjs
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
      try {
        const result = execSync(
          `node "${path.join(SCRIPTS_DIR, "fence-check.mjs")}" "${filePath}"`,
          { encoding: "utf8", cwd: process.cwd() }
        )
        if (result.trim()) process.stderr.write(result)
      } catch {}
    },
  }
}

function findNoteFile(vault: string, id: string): string | null {
  for (const folder of ["features", "states", "shared", "apis"]) {
    const p = path.join(vault, folder, `${id}.md`)
    if (fs.existsSync(p)) return p
  }
  return null
}
