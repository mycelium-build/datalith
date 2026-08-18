import { execFile } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

import { fixPrivacyHtml, fixTermsHtml } from "./fixup.ts"

const execFileP = promisify(execFile)

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")

const PAGES = {
    privacy: { rel: "src/pages/privacy/index.astro" },
    terms: { rel: "src/pages/terms/index.astro" },
} as const

const DATE_PATTERN = /Last updated \w+ \d+, \d+/g
const DATE_PLACEHOLDER = "Last updated <DATE>"

function normalize(html: string): string {
    return html.replace(DATE_PATTERN, DATE_PLACEHOLDER)
}

async function generateFresh(tempDir: string): Promise<void> {
    const config = JSON.parse(await readFile(path.join(ROOT, "policygen.json"), "utf-8"))
    config.output.privacyFilePath = "./gen/privacy/index.astro"
    config.output.termsFilePath = "./gen/terms/index.astro"
    await writeFile(path.join(tempDir, "policygen.json"), JSON.stringify(config, null, 4))

    const bin = path.join(ROOT, "node_modules", ".bin", "policygen")
    await execFileP(bin, ["generate"], { cwd: tempDir })
}

async function main(): Promise<void> {
    const tempDir = await mkdtemp(path.join(tmpdir(), "policygen-check-"))
    try {
        await generateFresh(tempDir)
        const results = await Promise.all(
            Object.entries(PAGES).map(async ([name, { rel }]) => {
                const committed = await readFile(path.join(ROOT, rel), "utf-8")
                const freshSource = await readFile(
                    path.join(tempDir, "gen", name, "index.astro"),
                    "utf-8",
                )
                const { html: fresh } =
                    name === "privacy" ? fixPrivacyHtml(freshSource) : fixTermsHtml(freshSource)
                return { rel, match: normalize(committed) === normalize(fresh) }
            }),
        )
        const stale = results.filter(({ match }) => !match).map(({ rel }) => rel)
        if (stale.length > 0) {
            console.error("Policy pages are stale: run npm run policies:generate")
            for (const file of stale) console.error(`  - ${file}`)
            process.exit(1)
        }
        console.log("policy pages: OK")
    } finally {
        await rm(tempDir, { recursive: true, force: true })
    }
}

await main()
