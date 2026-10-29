import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { latestDocsTags } from "./lib/releases.ts"
import { resolveTagSource } from "./lib/source.ts"

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

async function collectMarkdown(
    directory: string,
    markdownFiles: string[],
    relativeDirectory = "",
): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (relativeDirectory === "" && entry.isDirectory() && entry.name === "examples") continue
        const relativePath = path.join(relativeDirectory, entry.name)
        const absolutePath = path.join(directory, entry.name)
        if (entry.isDirectory()) await collectMarkdown(absolutePath, markdownFiles, relativePath)
        else if (entry.isFile() && entry.name.endsWith(".md")) markdownFiles.push(relativePath)
    }
}

function titleFromMarkdown(markdown: string, fallback: string): string {
    const heading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim()
    return heading ?? fallback
}

function parseFrontmatter(markdown: string): { body: string; frontmatter: string } {
    const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
    if (!match) return { body: markdown, frontmatter: "" }
    return { body: markdown.slice(match[0].length), frontmatter: match[1] }
}

function categoryFromFrontmatter(frontmatter: string): string {
    const value = frontmatter.match(/^category:\s*(.+)$/m)?.[1]?.trim() ?? ""
    return value.replace(/^["']|["']$/g, "")
}

/** `channelPath` is "vault" for Stable and "preview/vault" for Preview. */
function routeFor(relativePath: string, channelPath: string): string {
    const withoutExtension = relativePath.replace(/\.md$/i, "")
    return `docs/${channelPath}/${withoutExtension
        .split(path.sep)
        .map((segment) => segment.toLowerCase())
        .join("/")}`
}

interface DocumentIndex {
    channelPath: string
    sourceUrl: string
    byPath: Map<string, string>
    byStem: Map<string, Array<{ normalizedPath: string; route: string }>>
}

function buildDocumentIndex(
    markdownFiles: string[],
    channelPath: string,
    sourceUrl: string,
): DocumentIndex {
    const byPath = new Map<string, string>()
    const byStem = new Map<string, Array<{ normalizedPath: string; route: string }>>()
    for (const relativePath of markdownFiles) {
        const normalizedPath = relativePath.split(path.sep).join("/").replace(/\.md$/i, "")
        const route = routeFor(relativePath, channelPath)
        byPath.set(normalizedPath.toLowerCase(), route)
        const stem = path.posix.basename(normalizedPath).toLowerCase()
        const matches = byStem.get(stem) ?? []
        matches.push({ normalizedPath, route })
        byStem.set(stem, matches)
    }
    return { channelPath, sourceUrl, byPath, byStem }
}

function wikiTarget(target: string, currentPath: string, index: DocumentIndex): string {
    const normalizedTarget = target
        .trim()
        .replace(/^\.\//, "")
        .replace(/\.(md|todotxt|graph)$/i, "")
    if (/^https?:\/\//i.test(normalizedTarget)) return normalizedTarget

    const targetWithSlashes = normalizedTarget.replaceAll("\\", "/")
    const currentDirectory = path.posix.dirname(currentPath)
    const candidates = targetWithSlashes.includes("/")
        ? [targetWithSlashes]
        : [path.posix.join(currentDirectory, targetWithSlashes), targetWithSlashes]
    const markdownRoute = candidates
        .map((candidate) => index.byPath.get(candidate.toLowerCase()))
        .find(Boolean)
    const fallbackRoute =
        markdownRoute ??
        index.byStem.get(path.posix.basename(targetWithSlashes).toLowerCase())?.[0]?.route
    if (fallbackRoute) return `/${fallbackRoute}/`

    return `${index.sourceUrl}/${target.replaceAll("\\", "/")}`
}

function relativeMarkdownLink(currentRoute: string, targetRoute: string): string {
    const fromDirectory = `/${currentRoute}`
    const relative = path.posix.relative(fromDirectory, `/${targetRoute}`)
    return `${encodeURI(relative || ".")}/`
}

function rewriteWikiLinks(
    markdown: string,
    currentPath: string,
    index: DocumentIndex,
    edges: Set<string>,
): string {
    const currentRoute = routeFor(currentPath, index.channelPath)
    let inFence = false
    return markdown
        .split(/\r?\n/)
        .map((line) => {
            if (/^\s*(```|~~~)/.test(line)) {
                inFence = !inFence
                return line
            }
            if (inFence) return line

            const parts = line.split(/(`+[^`]*`+)/g)
            return parts
                .map((part, indexPart) => {
                    if (indexPart % 2 === 1) return part
                    return part.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, label) => {
                        const link = wikiTarget(target, currentPath, index)
                        const text = label?.trim() || target.trim()
                        if (/^https?:\/\//i.test(link)) return `[${text}](${link})`
                        const route = link.slice(1, -1)
                        if (route !== currentRoute) edges.add(`${currentRoute}|${route}`)
                        return `[${text}](${relativeMarkdownLink(currentRoute, route)})`
                    })
                })
                .join("")
        })
        .join("\n")
}

function searchContent(markdown: string): string {
    return markdown
        .replace(/^---[\s\S]*?---\r?\n?/, "")
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/`([^`]*)`/g, "$1")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/[#>*_~|-]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
}

function demoteHeadings(markdown: string): string {
    let inFence = false
    return markdown
        .split(/\r?\n/)
        .map((line) => {
            if (/^\s*(```|~~~)/.test(line)) {
                inFence = !inFence
                return line
            }
            if (inFence) return line
            return line.replace(/^(#{1,5})( )/, "#$1$2")
        })
        .join("\n")
}

function addStarlightFrontmatter(
    markdown: string,
    relativePath: string,
    channelPath: string,
): string {
    const { body, frontmatter } = parseFrontmatter(markdown)
    const route = routeFor(relativePath, channelPath)
    // The slug carries the channel prefix, so a source slug would escape its channel.
    const fields = frontmatter
        .split("\n")
        .filter((line) => !/^(title|slug)\s*:/.test(line))
        .join("\n")
    const title = path.basename(relativePath, ".md")
    return `---\n${fields}\ntitle: ${JSON.stringify(title)}\nslug: ${route}\n---\n\n${demoteHeadings(body.trimStart())}`
}

/** Import one release vault; Preview lives under /docs/preview/ and only Stable feeds the homepage graph, search and bases. */
export async function importVault(
    sourceRoot: string,
    channel: "stable" | "preview",
    tag: string,
    outputRoot: string,
    repository: string,
): Promise<void> {
    const channelPath = channel === "stable" ? "vault" : "preview/vault"
    const sourceVault = path.join(sourceRoot, "docs", "vault")
    const destinationVault = path.join(outputRoot, "src", "content", "docs", channelPath)
    const sourceUrl = `https://github.com/${repository}/blob/${encodeURIComponent(tag)}/docs/vault`

    const markdownFiles: string[] = []
    await collectMarkdown(sourceVault, markdownFiles)
    if (!markdownFiles.length) throw new Error(`No Markdown documentation found for ${tag}`)
    const index = buildDocumentIndex(markdownFiles, channelPath, sourceUrl)
    await rm(destinationVault, { recursive: true, force: true })
    await mkdir(destinationVault, { recursive: true })

    const edges = new Set<string>()
    const baseRows: Array<{ name: string; path: string; category: string; route: string }> = []
    const documents: Array<{
        route: string
        name: string
        path: string
        title: string
        content: string
    }> = []

    for (const relativePath of markdownFiles) {
        const sourcePath = path.join(sourceVault, relativePath)
        const destinationPath = path.join(destinationVault, relativePath)
        const original = await readFile(sourcePath, "utf8")
        const rewritten = rewriteWikiLinks(original, relativePath, index, edges)
        const document = addStarlightFrontmatter(rewritten, relativePath, channelPath)
        await mkdir(path.dirname(destinationPath), { recursive: true })
        await writeFile(destinationPath, `${document}\n`)
        documents.push({
            route: `/${routeFor(relativePath, channelPath)}/`,
            name: path.posix.basename(relativePath, ".md"),
            path: relativePath.split(path.sep).join("/").replace(/\.md$/i, ""),
            title: titleFromMarkdown(rewritten, path.basename(relativePath, ".md")),
            content: searchContent(rewritten),
        })
        baseRows.push({
            name: path.posix.basename(relativePath, ".md"),
            path: relativePath.split(path.sep).join("/").replace(/\.md$/i, ""),
            category: categoryFromFrontmatter(parseFrontmatter(original).frontmatter),
            route: `/${routeFor(relativePath, channelPath)}/`,
        })
    }
    console.log(`Imported ${markdownFiles.length} Markdown files from ${tag} into ${channelPath}`)
    if (channel !== "stable") return

    const dataDirectory = path.join(outputRoot, "src", "data")
    await mkdir(dataDirectory, { recursive: true })

    const nodeRoutes = new Set(documents.map((document) => document.route.slice(1, -1)))
    const graphNodes = documents.map((document) => ({
        id: document.route,
        label: document.title,
        route: document.route,
    }))
    const graphEdges = [...edges]
        .filter((edge) => edge.split("|").every((route) => nodeRoutes.has(route)))
        .map((edge) => {
            const [source, target] = edge.split("|")
            return { source: `/${source}/`, target: `/${target}/` }
        })
    await writeFile(
        path.join(dataDirectory, "graph.json"),
        `${JSON.stringify({ nodes: graphNodes, edges: graphEdges }, null, 2)}\n`,
    )
    await writeFile(
        path.join(dataDirectory, "search.json"),
        `${JSON.stringify({ documents }, null, 2)}\n`,
    )

    baseRows.sort((a, b) => a.name.localeCompare(b.name) || a.path.localeCompare(b.path))
    const baseTable = {
        rows: baseRows.map(({ name, category, route }) => ({ name, category, route })),
    }
    await writeFile(
        path.join(dataDirectory, "bases.json"),
        `${JSON.stringify(baseTable, null, 2)}\n`,
    )
    console.log(
        `Wrote docs graph (${graphNodes.length} nodes, ${graphEdges.length} edges), search index (${documents.length} documents), and base table (${baseTable.rows.length} rows)`,
    )
}

async function main(): Promise<void> {
    // Written by fetch-releases, which runs first in prebuild.
    const { repository, releases } = JSON.parse(
        await readFile(path.join(siteRoot, "src", "data", "releases.json"), "utf8"),
    )
    const tags = latestDocsTags(releases)
    if (!tags.stable) throw new Error("No published stable release found for documentation")

    await rm(path.join(siteRoot, "src", "content", "docs", "preview"), {
        recursive: true,
        force: true,
    })
    for (const channel of ["stable", "preview"] as const) {
        const tag = tags[channel]
        if (!tag) continue
        const { root } = await resolveTagSource(tag)
        await importVault(root, channel, tag, siteRoot, repository)
    }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
    main().catch((error: unknown) => {
        console.error(error)
        process.exitCode = 1
    })
}
