import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { getProjectLicenses, type ILicense } from "generate-license-file"

import { renderBundledAssets } from "./assets.ts"

export const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")

function splitDependency(dependency: string): [string, string] {
    const at = dependency.lastIndexOf("@")
    if (at <= 0) return [dependency, ""]
    return [dependency.slice(0, at), dependency.slice(at + 1)]
}

function firstLine(content: string): string | undefined {
    return content
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line.length > 0)
}

function renderLicense(license: ILicense): string[] {
    const lines: string[] = [`### ${firstLine(license.content) ?? "License"}`]
    lines.push("")
    lines.push("Used by:")
    lines.push("")
    for (const dependency of [...license.dependencies].sort((a, b) => {
        const [nameA, versionA] = splitDependency(a)
        const [nameB, versionB] = splitDependency(b)
        return nameA.localeCompare(nameB) || versionA.localeCompare(versionB)
    })) {
        const [name, version] = splitDependency(dependency)
        lines.push(version ? `- \`${name}\` ${version}` : `- \`${name}\``)
    }
    lines.push("")
    lines.push("```")
    lines.push(license.content.trim())
    if (license.notices.length > 0) {
        lines.push("")
        lines.push("With the following notices:")
        lines.push("")
        for (const notice of license.notices) {
            lines.push(notice.trim())
        }
    }
    lines.push("```")
    lines.push("")
    return lines
}

async function renderNpmDependencies(): Promise<string> {
    const licenses = await getProjectLicenses(path.join(siteRoot, "package.json"), {
        replace: { dompurify: "./node_modules/dompurify/LICENSE" },
    })
    const ordered = [...licenses].sort((a, b) => a.content.localeCompare(b.content))

    const lines: string[] = [
        "## npm dependencies",
        "",
        "This section lists the production dependencies of Datalith Website and",
        "the license under which each is distributed. It is generated from the",
        "installed `node_modules` tree with the `generate-license-file` npm",
        "package (https://www.npmjs.com/package/generate-license-file); do not",
        "edit it by hand.",
        "",
    ]

    for (const license of ordered) {
        lines.push(...renderLicense(license))
    }

    return lines.join("\n")
}

export async function renderNotices(): Promise<string> {
    const intro = await readFile(
        path.join(siteRoot, "scripts", "licenses", "notices-intro.md"),
        "utf-8",
    )

    const bundledAssets = await renderBundledAssets(siteRoot)
    const npmDependencies = await renderNpmDependencies()

    return `${intro.trim()}\n\n${bundledAssets}\n\n${npmDependencies}`
}
