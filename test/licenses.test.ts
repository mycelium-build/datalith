import { readFile } from "node:fs/promises"
import path from "node:path"

import { describe, expect, it } from "vitest"

const siteRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..")

async function readJson(relativePath: string): Promise<Record<string, unknown>> {
    const content = await readFile(path.join(siteRoot, relativePath), "utf8")
    return JSON.parse(content) as Record<string, unknown>
}

describe("THIRD-PARTY-NOTICES.md", () => {
    it("covers every production npm package", async () => {
        const lockfile = await readJson("package-lock.json")
        const packages = lockfile.packages as Record<
            string,
            { version?: string; license?: string; dev?: boolean }
        >
        const notice = await readFile(path.join(siteRoot, "THIRD-PARTY-NOTICES.md"), "utf8")

        const missing: string[] = []
        for (const [key, info] of Object.entries(packages)) {
            if (key === "") continue
            if (info.dev) continue
            const name = key.replace(/^node_modules\//, "")
            const display = `\`${name}\` ${info.version}`
            if (!notice.includes(display)) missing.push(display)
        }
        expect(missing).toEqual([])
    })

    it("reproduces every bundled-asset license file", async () => {
        const manifest = await readJson("scripts/licenses/assets.json")
        const assets = manifest.assets as Array<{ license_file?: string }>
        const files = assets
            .filter((asset) => asset.license_file)
            .map((asset) => asset.license_file!)
        const contents = await Promise.all(
            files.map((file) => readFile(path.join(siteRoot, file), "utf8")),
        )
        for (const content of contents) {
            expect(content.length).toBeGreaterThan(0)
        }
    })

    it("mentions the site title", async () => {
        const notice = await readFile(path.join(siteRoot, "THIRD-PARTY-NOTICES.md"), "utf8")
        expect(notice).toContain("# Datalith Website Third-Party Notices")
    })
})
