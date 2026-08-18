import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { getProjectLicenses, type ILicense } from "generate-license-file"

import { renderBundledAssets } from "./assets.ts"

export const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")

interface LockfilePackage {
    version?: string
    dev?: boolean
    optional?: boolean
    devOptional?: boolean
}

interface Lockfile {
    packages: Record<string, LockfilePackage>
}

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

// Keep generated notices ordered identically across locales and CI runners.
function compareStrings(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0
}

function shortTitle(content: string): string {
    const title = (firstLine(content) ?? "License")
        .replace(/^#+\s*/, "")
        .replace(/\s+/g, " ")
        .trim()
    if (!title) return "License"
    return title.length > 80 ? `${title.slice(0, 77).trimEnd()}...` : title
}

function normalizeLicenseText(content: string): string {
    return content
        .replace(/\r\n?/g, "\n")
        .replace(/[ \t]+$/gm, "")
        .trim()
}

async function productionDependencies(): Promise<Set<string>> {
    const lockfile = JSON.parse(
        await readFile(path.join(siteRoot, "package-lock.json"), "utf-8"),
    ) as Lockfile
    const dependencies = new Set<string>()

    for (const [key, info] of Object.entries(lockfile.packages)) {
        if (!key || !info.version || info.dev || info.optional || info.devOptional) continue
        const name =
            key
                .replace(/^node_modules\//, "")
                .split("/node_modules/")
                .pop() ?? key
        dependencies.add(`${name}@${info.version}`)
    }

    return dependencies
}

function renderLicense(license: ILicense): string[] {
    const lines: string[] = [`### ${shortTitle(license.content)}`]
    lines.push("")
    lines.push("Used by:")
    lines.push("")
    for (const dependency of [...license.dependencies].sort((a, b) => {
        const [nameA, versionA] = splitDependency(a)
        const [nameB, versionB] = splitDependency(b)
        return compareStrings(nameA, nameB) || compareStrings(versionA, versionB)
    })) {
        const [name, version] = splitDependency(dependency)
        lines.push(version ? `- \`${name}\` ${version}` : `- \`${name}\``)
    }
    lines.push("")
    lines.push("```")
    lines.push(normalizeLicenseText(license.content))
    if (license.notices.length > 0) {
        lines.push("")
        lines.push("With the following notices:")
        lines.push("")
        for (const notice of license.notices) {
            lines.push(normalizeLicenseText(notice))
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
    const included = await productionDependencies()
    const ordered = licenses
        .map((license) => ({
            ...license,
            dependencies: license.dependencies.filter((dependency) => included.has(dependency)),
        }))
        .filter((license) => license.dependencies.length > 0)
        .sort((a, b) => compareStrings(a.content, b.content))

    const lines: string[] = [
        "## npm dependencies",
        "",
        "This section lists the production dependencies of Datalith Website and",
        "the license under which each is distributed. It is generated from the",
        "installed `node_modules` tree, filtered to the non-optional production",
        "packages in `package-lock.json`, with the `generate-license-file` npm",
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

    return `${intro.replace(/\r\n?/g, "\n").trim()}\n\n${bundledAssets}\n\n${npmDependencies}`
}
