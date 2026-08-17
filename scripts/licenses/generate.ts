import { writeFile } from "node:fs/promises"
import path from "node:path"

import { renderNotices, siteRoot } from "./render.ts"

const noticesPath = path.join(siteRoot, "THIRD-PARTY-NOTICES.md")
await writeFile(noticesPath, await renderNotices())

console.log("wrote THIRD-PARTY-NOTICES.md")
