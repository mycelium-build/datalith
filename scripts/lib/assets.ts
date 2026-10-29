/* oxlint-disable no-await-in-loop */
import { copyFile, mkdir, readdir, rm, stat } from "node:fs/promises"
import path from "node:path"

const copies = [
    { from: "assets/logo/datalith.txt", to: "src/data/logo.txt" },
    { from: "assets/fonts/Pixeloid", to: "public/fonts" },
    { from: "assets/themes", to: "src/data/themes" },
    { from: "assets/icons", to: "src/assets/icons" },
    { from: "assets/logo/stable/datalith.png", to: "public/datalith.png" },
    { from: "assets/logo/preview/datalith.png", to: "public/datalith-preview.png" },
]

const extensions = /\.(svg|json|txt|ttf)$/i

async function copyTree(sourcePath: string, destinationPath: string): Promise<number> {
    const info = await stat(sourcePath)
    if (info.isFile()) {
        await mkdir(path.dirname(destinationPath), { recursive: true })
        await copyFile(sourcePath, destinationPath)
        return 1
    }
    await mkdir(destinationPath, { recursive: true })
    let count = 0
    for (const entry of await readdir(sourcePath, { withFileTypes: true })) {
        if (!extensions.test(entry.name)) continue
        count += await copyTree(
            path.join(sourcePath, entry.name),
            path.join(destinationPath, entry.name),
        )
    }
    return count
}

/** Copy application assets unchanged, checking required paths before replacing website assets. */
export async function syncAssets(sourceRoot: string, siteRoot: string): Promise<number> {
    for (const { from } of copies) {
        try {
            await stat(path.join(sourceRoot, from))
        } catch (error) {
            if (!["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) {
                throw error
            }
            throw new Error(
                `Missing required application asset: ${from} (source: ${sourceRoot}). ` +
                    "Use DATALITH_SOURCE_DIR or DATALITH_SOURCE_REF with the Stable and Preview channel icons (v0.2.0-rc.1 or later).",
                { cause: error },
            )
        }
    }

    let copiedCount = 0
    for (const { from, to } of copies) {
        const destinationPath = path.join(siteRoot, to)
        await rm(destinationPath, { recursive: true, force: true })
        copiedCount += await copyTree(path.join(sourceRoot, from), destinationPath)
    }
    return copiedCount
}
