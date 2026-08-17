/* oxlint-disable no-await-in-loop */
import { readFile } from "node:fs/promises"
import path from "node:path"

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

export const assets: BundledAsset[] = [
    {
        id: "datalith-pixel-icons",
        kind: "icon",
        name: "Datalith pixel-art icons",
        license: "MIT",
        licenseFile: "LICENSE",
    },
    {
        id: "datalith-logo",
        kind: "artwork",
        name: "Datalith logo",
        license: "MIT",
        licenseFile: "LICENSE",
    },
    {
        id: "pixeloid",
        kind: "font",
        name: "Pixeloid Sans",
        author: "GGBotNet",
        copyright: "Copyright (c) 2020-2025 GGBotNet",
        source: "https://ggbot.net/fonts/",
        revision: "1.0 (embedded font metadata)",
        license: "OFL-1.1",
        licenseFile: "public/fonts/LICENSE.txt",
    },
    {
        id: "theme-ayu",
        kind: "theme",
        name: "Ayu",
        author: "Ike Ku",
        copyright: "Copyright (c) 2016 Ike Ku",
        source: "https://github.com/dempfi/ayu",
        revision: "41e0098e8ce5014f1f90474a16bf31639f74fecf",
        license: "MIT",
        licenseFile: "src/data/themes/ayu-LICENSE.txt",
        licenseEvidence:
            "https://raw.githubusercontent.com/dempfi/ayu/41e0098e8ce5014f1f90474a16bf31639f74fecf/LICENSE",
    },
    {
        id: "theme-catppuccin",
        kind: "theme",
        name: "Catppuccin",
        author: "Catppuccin",
        copyright: "Copyright (c) 2021 Catppuccin",
        source: "https://github.com/catppuccin/catppuccin",
        revision: "d09787dd98ca6fba08af5ef2ae94a7e09f17daca",
        license: "MIT",
        licenseFile: "src/data/themes/catppuccin-LICENSE.txt",
        licenseEvidence:
            "https://raw.githubusercontent.com/catppuccin/catppuccin/d09787dd98ca6fba08af5ef2ae94a7e09f17daca/LICENSE",
    },
    {
        id: "theme-datalith",
        kind: "theme",
        name: "Datalith",
        license: "MIT",
        licenseFile: "src/data/themes/datalith-LICENSE.txt",
    },
    {
        id: "theme-everforest",
        kind: "theme",
        name: "Everforest",
        author: "sainnhe",
        copyright: "Copyright (c) 2019 sainnhe",
        source: "https://github.com/sainnhe/everforest",
        revision: "85a86eb62409e3ec88713bff3d1b9d7374e112e4",
        license: "MIT",
        licenseFile: "src/data/themes/everforest-LICENSE.txt",
        licenseEvidence:
            "https://raw.githubusercontent.com/sainnhe/everforest/85a86eb62409e3ec88713bff3d1b9d7374e112e4/LICENSE",
    },
    {
        id: "theme-gruvbox",
        kind: "theme",
        name: "Gruvbox",
        author: "Pavel Pertsev (morhetz)",
        copyright: "Copyright (c) 2012-2023 Pavel Pertsev",
        source: "https://github.com/morhetz/gruvbox",
        revision: "5d15b2765f59754d7ac263c88a0f6e3e58124951",
        license: "MIT",
        licenseFile: "src/data/themes/gruvbox-LICENSE.txt",
        licenseEvidence:
            "https://raw.githubusercontent.com/morhetz/gruvbox/5d15b2765f59754d7ac263c88a0f6e3e58124951/README.md",
    },
    {
        id: "theme-matrix",
        kind: "theme",
        name: "Matrix",
        author: "iruzo",
        copyright: "Copyright (c) 2022 iruzo",
        source: "https://github.com/iruzo/matrix-nvim",
        revision: "5fafe6b440d08c1070e3c4c4cb9d648436d5d867",
        license: "MIT",
        licenseFile: "src/data/themes/matrix-LICENSE.txt",
        licenseEvidence:
            "https://raw.githubusercontent.com/iruzo/matrix-nvim/5fafe6b440d08c1070e3c4c4cb9d648436d5d867/LICENSE",
    },
    {
        id: "theme-mellifluous",
        kind: "theme",
        name: "Mellifluous",
        author: "Ramojus Lapinskas",
        copyright: "Copyright (c) 2024 Ramojus Lapinskas",
        source: "https://github.com/ramojus/mellifluous.nvim",
        revision: "ec0575bdb63594c5e7fba6eb9607b009aa1fb74e",
        license: "MIT",
        licenseFile: "src/data/themes/mellifluous-LICENSE.txt",
        licenseEvidence:
            "https://raw.githubusercontent.com/ramojus/mellifluous.nvim/ec0575bdb63594c5e7fba6eb9607b009aa1fb74e/LICENSE",
    },
    {
        id: "theme-tokyonight",
        kind: "theme",
        name: "Tokyo Night",
        author: "Folke Lemaitre",
        copyright: "Copyright (c) Folke Lemaitre",
        source: "https://github.com/folke/tokyonight.nvim",
        revision: "cdc07ac78467a233fd62c493de29a17e0cf2b2b6",
        license: "Apache-2.0",
        licenseFile: "src/data/themes/tokyonight-LICENSE.txt",
        licenseEvidence:
            "https://raw.githubusercontent.com/folke/tokyonight.nvim/cdc07ac78467a233fd62c493de29a17e0cf2b2b6/LICENSE",
    },
]

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
    return content.replace(/\n+$/, "")
}

export async function renderBundledAssets(siteRoot: string): Promise<string> {
    const ordered = [...assets].sort((a, b) => a.id.localeCompare(b.id))
    const lines: string[] = [
        "## Bundled assets",
        "",
        "This section lists non-npm assets distributed with Datalith Site. It",
        "is generated from `scripts/licenses/assets.ts`; do not edit it by hand.",
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
