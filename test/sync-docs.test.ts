import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { afterEach, expect, it } from "vite-plus/test"

import { importVault } from "../scripts/sync-docs.ts"

const roots: string[] = []
afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

it("isolates links and slugs by channel, preserving the stable homepage indexes", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "docs-vault-test-"))
    roots.push(root)
    await mkdir(path.join(root, "docs/vault"), { recursive: true })
    await writeFile(
        path.join(root, "docs/vault/Welcome.md"),
        "---\nslug: old-route\n---\n# Welcome\n[[Other Page]] [[Missing]] `[[Other Page]]`\n",
    )
    await writeFile(path.join(root, "docs/vault/Other Page.md"), "# Other\n[[Welcome]]")
    await importVault(root, "stable", "v1.0.0", root, "owner/repo")
    const stable = await readFile(path.join(root, "src/content/docs/vault/Welcome.md"), "utf8")
    const stableIndex = await readFile(path.join(root, "src/data/search.json"), "utf8")
    await importVault(root, "preview", "v2.0.0-rc.1", root, "owner/repo")
    const preview = await readFile(
        path.join(root, "src/content/docs/preview/vault/Welcome.md"),
        "utf8",
    )
    expect(stable).toContain("slug: docs/vault/welcome")
    expect(stableIndex).toContain('"route": "/docs/vault/welcome/"')
    expect(preview).toContain("slug: docs/preview/vault/welcome")
    expect(preview).not.toContain("old-route")
    expect(preview).toContain("[Other Page](../other%20page/)")
    expect(preview).toContain("https://github.com/owner/repo/blob/v2.0.0-rc.1/docs/vault/Missing")
    expect(preview).toContain("`[[Other Page]]`")
    expect(await readFile(path.join(root, "src/data/search.json"), "utf8")).toBe(stableIndex)
})
