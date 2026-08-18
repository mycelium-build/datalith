/* oxlint-disable no-await-in-loop */
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { resolveDatalithSource } from "./lib/source.ts"

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const { root: sourceRoot } = await resolveDatalithSource()
const sourceVault = path.join(sourceRoot, "docs", "vault")
const destinationVault = path.join(siteRoot, "src", "content", "docs", "vault")
const sourceUrl = "https://github.com/mycelium-build/datalith-app/blob/main/docs/vault"

const markdownFiles: string[] = []

async function collectMarkdown(directory: string, relativeDirectory = ""): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const relativePath = path.join(relativeDirectory, entry.name)
        const absolutePath = path.join(directory, entry.name)
        if (entry.isDirectory()) await collectMarkdown(absolutePath, relativePath)
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

function routeFor(relativePath: string): string {
    const withoutExtension = relativePath.replace(/\.md$/i, "")
    return `docs/vault/${withoutExtension
        .split(path.sep)
        .map((segment) => segment.toLowerCase())
        .join("/")}`
}

interface DocumentIndex {
    byPath: Map<string, string>
    byStem: Map<string, Array<{ normalizedPath: string; route: string }>>
}

function buildDocumentIndex(): DocumentIndex {
    const byPath = new Map<string, string>()
    const byStem = new Map<string, Array<{ normalizedPath: string; route: string }>>()
    for (const relativePath of markdownFiles) {
        const normalizedPath = relativePath.split(path.sep).join("/").replace(/\.md$/i, "")
        const route = routeFor(relativePath)
        byPath.set(normalizedPath.toLowerCase(), route)
        const stem = path.posix.basename(normalizedPath).toLowerCase()
        const matches = byStem.get(stem) ?? []
        matches.push({ normalizedPath, route })
        byStem.set(stem, matches)
    }
    return { byPath, byStem }
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

    return `${sourceUrl}/${target.replaceAll("\\", "/")}`
}

function relativeMarkdownLink(currentRoute: string, targetRoute: string): string {
    const fromDirectory = `/${currentRoute}`
    const relative = path.posix.relative(fromDirectory, `/${targetRoute}`)
    return `${relative || "."}/`
}

function rewriteWikiLinks(
    markdown: string,
    currentPath: string,
    index: DocumentIndex,
    edges: Set<string>,
): string {
    const currentRoute = routeFor(currentPath)
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

function addStarlightFrontmatter(markdown: string, relativePath: string): string {
    const { body, frontmatter } = parseFrontmatter(markdown)
    const title = titleFromMarkdown(body, path.basename(relativePath, ".md"))
    const route = routeFor(relativePath)
    let fields = frontmatter ? `${frontmatter}\n` : ""
    if (!/^title\s*:/m.test(fields)) fields += `title: ${JSON.stringify(title)}\n`
    if (!/^slug\s*:/m.test(fields)) fields += `slug: ${route}\n`
    return `---\n${fields}---\n\n${body.trimStart()}`
}

await collectMarkdown(sourceVault)
const index = buildDocumentIndex()
await rm(destinationVault, { recursive: true, force: true })
await mkdir(destinationVault, { recursive: true })

const edges = new Set<string>()
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
    const document = addStarlightFrontmatter(rewritten, relativePath)
    await mkdir(path.dirname(destinationPath), { recursive: true })
    await writeFile(destinationPath, `${document}\n`)
    documents.push({
        route: `/${routeFor(relativePath)}/`,
        name: path.posix.basename(relativePath, ".md"),
        path: relativePath.split(path.sep).join("/").replace(/\.md$/i, ""),
        title: titleFromMarkdown(rewritten, path.basename(relativePath, ".md")),
        content: searchContent(rewritten),
    })
}

const dataDirectory = path.join(siteRoot, "src", "data")
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

console.log(`Imported ${markdownFiles.length} Markdown files from ${sourceVault}`)
console.log(
    `Wrote docs graph (${graphNodes.length} nodes, ${graphEdges.length} edges) and search index (${documents.length} documents)`,
)
