import path from "node:path"
import { fileURLToPath } from "node:url"

import { syncAssets } from "./lib/assets.ts"
import { resolveDatalithSource } from "./lib/source.ts"

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const { root: sourceRoot } = await resolveDatalithSource()

const copiedCount = await syncAssets(sourceRoot, siteRoot)

console.log(
    `Synced ${copiedCount} asset files, including Stable and Preview icons, from ${sourceRoot}`,
)
