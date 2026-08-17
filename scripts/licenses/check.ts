import { readFile } from "node:fs/promises"
import path from "node:path"

import { renderNotices, siteRoot } from "./render.ts"

const expected = await renderNotices()
const actual = await readFile(path.join(siteRoot, "THIRD-PARTY-NOTICES.md"), "utf-8")

if (actual !== expected) {
    console.error("THIRD-PARTY-NOTICES.md is stale: run npm run licenses:generate")
    process.exit(1)
}

console.log("license-compliance: OK")
