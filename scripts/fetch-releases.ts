import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { compareVersions, platformForAsset, versionParts } from "./lib/releases.ts"

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const outputPath = path.join(siteRoot, "src", "data", "releases.json")
const repository = process.env.RELEASE_REPOSITORY ?? "mycelium-build/datalith-app"
const endpoint = `https://api.github.com/repos/${repository}/releases?per_page=100`
const token = process.env.DATALITH_READ_TOKEN ?? process.env.GITHUB_TOKEN
const includeDrafts = process.env.INCLUDE_DRAFT_RELEASES === "true"

function githubHeaders(): Record<string, string> {
    return {
        accept: "application/vnd.github+json",
        "user-agent": "datalith-build",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
    }
}

async function main(): Promise<void> {
    const response = await fetch(endpoint, { headers: githubHeaders() })
    if (!response.ok) {
        const accessHint =
            response.status === 404
                ? " The repository may be private or the token may not have Contents: read access."
                : ""
        throw new Error(
            `GitHub Releases request failed with ${response.status} ${response.statusText}.${accessHint}`,
        )
    }

    type RawRelease = {
        id: number
        tag_name: string
        name: string
        prerelease: boolean
        published_at: string
        html_url: string
        draft: boolean
        assets: Array<{ name: string; browser_download_url: string; size: number }>
    }

    const releases = ((await response.json()) as RawRelease[])
        .filter((release) => (includeDrafts || !release.draft) && versionParts(release.tag_name))
        .map((release) => ({
            id: release.id,
            tagName: release.tag_name,
            name: release.name || release.tag_name,
            prerelease: release.prerelease,
            publishedAt: release.published_at,
            htmlUrl: release.html_url,
            assets: release.assets.map((asset) => ({
                name: asset.name,
                platform: platformForAsset(asset.name),
                browserDownloadUrl: asset.browser_download_url,
                size: asset.size,
            })),
        }))
        .sort(compareVersions)

    await mkdir(path.dirname(outputPath), { recursive: true })
    await writeFile(
        outputPath,
        `${JSON.stringify({ repository, generatedAt: new Date().toISOString(), releases }, null, 2)}\n`,
    )
    const releaseScope = includeDrafts ? "releases including drafts" : "published releases"
    console.log(`Fetched ${releases.length} ${releaseScope} from ${repository}`)

    const starsResponse = await fetch(`https://api.github.com/repos/${repository}`, {
        headers: githubHeaders(),
    })
    let stargazersCount = 0
    if (starsResponse.ok) {
        const repo = (await starsResponse.json()) as { stargazers_count?: number }
        stargazersCount = Number(repo.stargazers_count ?? 0)
    } else {
        console.warn(
            `GitHub repository request failed with ${starsResponse.status} ${starsResponse.statusText}; star count left at 0`,
        )
    }
    await writeFile(
        path.join(siteRoot, "src", "data", "stars.json"),
        `${JSON.stringify({ repository, stargazersCount, fetchedAt: new Date().toISOString() }, null, 2)}\n`,
    )
    console.log(`Fetched ${stargazersCount} stars from ${repository}`)
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
    main().catch((error: unknown) => {
        console.error(error)
        process.exitCode = 1
    })
}
