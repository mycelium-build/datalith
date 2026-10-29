import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import * as v from "valibot"

import { archForAsset, compareVersions, platformForAsset, versionParts } from "./lib/releases.ts"
import { parseWith } from "./lib/schema.ts"

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

const ReleasesSchema = v.array(
    v.object({
        id: v.number(),
        tag_name: v.string(),
        name: v.nullable(v.string()),
        prerelease: v.boolean(),
        published_at: v.nullable(v.string()),
        html_url: v.string(),
        draft: v.boolean(),
        assets: v.array(
            v.object({ name: v.string(), browser_download_url: v.string(), size: v.number() }),
        ),
    }),
)

const RepositorySchema = v.object({ stargazers_count: v.number() })

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

    const releases = parseWith(ReleasesSchema, await response.json(), "GitHub Releases response")
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
                arch: archForAsset(asset.name),
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
        const repo = v.safeParse(RepositorySchema, await starsResponse.json())
        if (repo.success) stargazersCount = repo.output.stargazers_count
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
