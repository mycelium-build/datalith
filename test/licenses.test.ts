import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import type * as v from "valibot"
import { describe, expect, it } from "vite-plus/test"

import { parseWith } from "../scripts/lib/schema.ts"
import { AssetsManifestSchema } from "../scripts/licenses/assets.ts"
import { LockfileSchema } from "../scripts/licenses/lockfile.ts"

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

async function readJson<const TSchema extends v.GenericSchema>(
    relativePath: string,
    schema: TSchema,
): Promise<v.InferOutput<TSchema>> {
    const content = await readFile(path.join(siteRoot, relativePath), "utf8")
    return parseWith(schema, JSON.parse(content), relativePath)
}

interface LockedPackage {
    /** How the package is listed in the notices: `` `name` version ``. */
    display: string
    dev: boolean
    optional: boolean
    devOptional: boolean
}

async function lockedPackages(): Promise<LockedPackage[]> {
    const lockfile = await readJson("package-lock.json", LockfileSchema)
    const packages: LockedPackage[] = []
    for (const [key, info] of Object.entries(lockfile.packages)) {
        if (key === "") continue
        const name =
            info.name ??
            key
                .replace(/^node_modules\//, "")
                .split("/node_modules/")
                .pop() ??
            key
        packages.push({
            display: `\`${name}\` ${info.version}`,
            dev: info.dev ?? false,
            optional: info.optional ?? false,
            devOptional: info.devOptional ?? false,
        })
    }
    return packages
}

describe("THIRD-PARTY-NOTICES.md", () => {
    it("covers every production npm package", async () => {
        const notice = await readFile(path.join(siteRoot, "THIRD-PARTY-NOTICES.md"), "utf8")

        const missing: string[] = []
        for (const info of await lockedPackages()) {
            if (info.dev || info.optional || info.devOptional) continue
            if (!notice.includes(info.display)) missing.push(info.display)
        }
        expect(missing).toEqual([])
    })

    it("excludes optional npm packages", async () => {
        const notice = await readFile(path.join(siteRoot, "THIRD-PARTY-NOTICES.md"), "utf8")
        const required = new Set<string>()
        const optional = new Set<string>()

        for (const info of await lockedPackages()) {
            if (info.dev || info.devOptional) continue
            if (info.optional) optional.add(info.display)
            else required.add(info.display)
        }

        const includedOptional = [...optional].filter(
            (display) => !required.has(display) && notice.includes(display),
        )
        expect(includedOptional).toEqual([])
    })

    it("reproduces every bundled-asset license file", async () => {
        const manifest = await readJson("scripts/licenses/assets.json", AssetsManifestSchema)
        const files = manifest.assets.map((asset) => asset.license_file).filter(Boolean)
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
