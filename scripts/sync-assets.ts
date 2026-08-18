/* oxlint-disable no-await-in-loop */
import { mkdir, readdir, copyFile, rm, stat } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import sharp from "sharp"

import { resolveDatalithSource } from "./lib/source.ts"

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const { root: sourceRoot } = await resolveDatalithSource()

const copies = [
    { from: path.join("assets", "logo", "datalith.txt"), to: path.join("src", "data", "logo.txt") },
    { from: path.join("assets", "fonts", "Pixeloid"), to: path.join("public", "fonts") },
    { from: path.join("assets", "themes"), to: path.join("src", "data", "themes") },
    { from: path.join("assets", "icons"), to: path.join("src", "assets", "icons") },
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

let copiedCount = 0

for (const { from, to } of copies) {
    const sourcePath = path.join(sourceRoot, from)
    const destinationPath = path.join(siteRoot, to)
    await rm(destinationPath, { recursive: true, force: true })
    copiedCount += await copyTree(sourcePath, destinationPath)
}

const faviconSource = path.join(sourceRoot, "assets", "logo", "datalith.png")
const faviconDestination = path.join(siteRoot, "public", "datalith.png")
await sharp(faviconSource).resize(512, 512).toFile(faviconDestination)

console.log(`Synced ${copiedCount} asset files and the favicon from ${sourceRoot}`)
