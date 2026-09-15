import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { syncAssets } from "../scripts/lib/assets.ts"

// Binary fixtures ensure synchronization does not decode or re-encode the icon files.
const stableIcon = Buffer.from("89504e470d0a1a0a000102ff", "hex")
const previewIcon = Buffer.from("89504e470d0a1a0a00ffff007f", "hex")
const assets = {
    "assets/logo/datalith.txt": "Datalith",
    "assets/logo/stable/datalith.png": stableIcon,
    "assets/logo/preview/datalith.png": previewIcon,
    "assets/fonts/Pixeloid/PixeloidSans.ttf": "font",
    "assets/fonts/Pixeloid/LICENSE.txt": "font license",
    "assets/themes/datalith.json": "{}",
    "assets/themes/datalith-LICENSE.txt": "theme license",
    "assets/icons/star.svg": "<svg></svg>",
    "assets/icons/star.txt": "star",
}

let root: string
let source: string
let site: string

beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "datalith-assets-test-"))
    source = path.join(root, "source")
    site = path.join(root, "clean-site")
    await Promise.all(
        Object.entries(assets).map(async ([relativePath, content]) => {
            const destination = path.join(source, relativePath)
            await mkdir(path.dirname(destination), { recursive: true })
            await writeFile(destination, content)
        }),
    )
})

afterEach(async () => {
    await rm(root, { recursive: true, force: true })
})

describe("syncAssets", () => {
    it("populates a clean site and copies both channel icons byte for byte", async () => {
        expect(await syncAssets(source, site)).toBe(Object.keys(assets).length)
        expect(await readFile(path.join(site, "public/datalith.png"))).toEqual(stableIcon)
        expect(await readFile(path.join(site, "public/datalith-preview.png"))).toEqual(previewIcon)
        expect(await readFile(path.join(site, "public/fonts/LICENSE.txt"), "utf8")).toBe(
            "font license",
        )
        expect(await readFile(path.join(site, "src/data/logo.txt"), "utf8")).toBe("Datalith")
        expect(await readFile(path.join(site, "src/data/themes/datalith.json"), "utf8")).toBe("{}")
        expect(await readFile(path.join(site, "src/assets/icons/star.svg"), "utf8")).toBe(
            "<svg></svg>",
        )
    })

    it("replaces stale output when prebuild synchronizes again", async () => {
        await syncAssets(source, site)
        await writeFile(path.join(site, "public/datalith-preview.png"), "stale icon")
        await writeFile(path.join(site, "src/assets/icons/obsolete.svg"), "stale icon")
        await syncAssets(source, site)
        expect(await readFile(path.join(site, "public/datalith-preview.png"))).toEqual(previewIcon)
        await expect(readFile(path.join(site, "src/assets/icons/obsolete.svg"))).rejects.toThrow()
    })

    it.each([
        "assets/logo/stable/datalith.png",
        "assets/logo/preview/datalith.png",
        "assets/fonts/Pixeloid",
    ])("reports a missing required asset before replacing existing output: %s", async (missing) => {
        await syncAssets(source, site)
        await rm(path.join(source, missing), { recursive: true, force: true })
        await expect(syncAssets(source, site)).rejects.toThrow(
            `Missing required application asset: ${missing} (source: ${source})`,
        )
        expect(await readFile(path.join(site, "public/datalith.png"))).toEqual(stableIcon)
        expect(await readFile(path.join(site, "public/datalith-preview.png"))).toEqual(previewIcon)
    })

    it("rejects a legacy-only source instead of using its logo for Preview", async () => {
        await rm(path.join(source, "assets/logo/stable"), { recursive: true })
        await rm(path.join(source, "assets/logo/preview"), { recursive: true })
        await writeFile(path.join(source, "assets/logo/datalith.png"), stableIcon)
        await expect(syncAssets(source, site)).rejects.toThrow(/Stable and Preview channel icons/)
        await expect(readFile(path.join(site, "public/datalith-preview.png"))).rejects.toThrow()
    })
})
