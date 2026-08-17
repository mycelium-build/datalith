import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { getLicenseFileText } from "generate-license-file"

export const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")

export async function renderNotices(): Promise<string> {
    const intro = await readFile(
        path.join(siteRoot, "scripts", "licenses", "notices-intro.md"),
        "utf-8",
    )

    const dependencies = await getLicenseFileText(path.join(siteRoot, "package.json"), {
        lineEnding: "lf",
        replace: { dompurify: "./node_modules/dompurify/LICENSE" },
    })

    return `${intro.trim()}\n\n${dependencies}`
}
