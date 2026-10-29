import { readFile } from "node:fs/promises"
import path from "node:path"

import * as v from "valibot"

import { parseWith } from "../lib/schema.ts"

/** `scripts/licenses/assets.json`: the bundled non-npm assets and their licenses. */
export const AssetsManifestSchema = v.object({
    assets: v.array(
        v.object({
            id: v.string(),
            kind: v.string(),
            name: v.string(),
            author: v.optional(v.string()),
            copyright: v.optional(v.string()),
            source: v.optional(v.string()),
            revision: v.optional(v.string()),
            license: v.string(),
            license_file: v.string(),
            license_evidence: v.optional(v.string()),
        }),
    ),
})

export interface BundledAsset {
    id: string
    kind: string
    name: string
    author?: string
    copyright?: string
    source?: string
    revision?: string
    license: string
    licenseFile: string
    licenseEvidence?: string
}

async function loadAssets(siteRoot: string): Promise<BundledAsset[]> {
    const manifestPath = path.join(siteRoot, "scripts", "licenses", "assets.json")
    const manifest = parseWith(
        AssetsManifestSchema,
        JSON.parse(await readFile(manifestPath, "utf-8")),
        manifestPath,
    )
    return manifest.assets.map(
        ({ license_file: licenseFile, license_evidence: licenseEvidence, ...rest }) => ({
            ...rest,
            licenseFile,
            licenseEvidence,
        }),
    )
}

async function readLicenseText(siteRoot: string, relative: string): Promise<string> {
    let content: string
    try {
        content = await readFile(path.join(siteRoot, relative), "utf-8")
    } catch {
        throw new Error(`missing asset license file: ${relative}`)
    }
    if (!content.trim()) {
        throw new Error(`empty asset license file: ${relative}`)
    }
    return content
        .replace(/\r\n?/g, "\n")
        .replace(/[ \t]+$/gm, "")
        .replace(/\n+$/, "")
}

export async function renderBundledAssets(siteRoot: string): Promise<string> {
    const ordered = (await loadAssets(siteRoot)).sort((a, b) => a.id.localeCompare(b.id))
    const lines: string[] = [
        "## Bundled assets",
        "",
        "This section lists non-npm assets distributed with Datalith Website. It",
        "is generated from `scripts/licenses/assets.json`; do not edit it by hand.",
        "",
    ]

    for (const asset of ordered) {
        lines.push(`### ${asset.name}`)
        lines.push("")
        lines.push(`- Identifier: \`${asset.id}\``)
        lines.push(`- Kind: ${asset.kind}`)
        if (asset.author) {
            lines.push(`- Author: ${asset.author}`)
        }
        if (asset.copyright) {
            lines.push(`- Copyright: ${asset.copyright}`)
        }
        lines.push(`- License: ${asset.license}`)
        if (asset.source) {
            lines.push(`- Source: ${asset.source}`)
            if (asset.revision) {
                lines.push(`- Revision: ${asset.revision}`)
            }
        } else {
            lines.push("- Source: first-party (Datalith)")
        }
        lines.push(`- License text: ${asset.licenseFile}`)
        if (asset.licenseEvidence) {
            lines.push(`- License evidence: ${asset.licenseEvidence}`)
        }
        lines.push("")
    }

    const texts: Record<string, string[]> = {}
    for (const asset of ordered) {
        const names = (texts[asset.licenseFile] ??= [])
        names.push(asset.name)
    }

    lines.push("## Bundled asset license texts")
    lines.push("")
    lines.push(
        "The following license texts are reproduced in full for the bundled assets listed above.",
    )
    lines.push("")
    for (const [licenseFile, names] of Object.entries(texts)) {
        lines.push(`### ${licenseFile}`)
        lines.push("")
        lines.push(`Used by: ${names.join(", ")}`)
        lines.push("")
        lines.push("```")
        lines.push(await readLicenseText(siteRoot, licenseFile))
        lines.push("```")
        lines.push("")
    }

    return lines.join("\n")
}
