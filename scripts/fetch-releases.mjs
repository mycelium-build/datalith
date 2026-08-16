import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(siteRoot, 'src', 'data', 'releases.json');
const repository = process.env.RELEASE_REPOSITORY ?? 'mycelium-build/datalith';
const endpoint = `https://api.github.com/repos/${repository}/releases?per_page=100`;
const token = process.env.DATALITH_READ_TOKEN ?? process.env.GITHUB_TOKEN;
const includeDrafts = process.env.INCLUDE_DRAFT_RELEASES === 'true';

function versionParts(tag) {
	const match = tag.match(/^v?(\d+)\.(\d+)\.(\d+)(?:-rc\.(\d+))?$/i);
	return match ? match.slice(1).map((value) => Number(value ?? 0)) : null;
}

function compareVersions(left, right) {
	const a = versionParts(left.tagName) ?? [0, 0, 0, 0];
	const b = versionParts(right.tagName) ?? [0, 0, 0, 0];
	for (let index = 0; index < a.length; index += 1) {
		if (a[index] !== b[index]) return b[index] - a[index];
	}
	return new Date(right.publishedAt ?? 0) - new Date(left.publishedAt ?? 0);
}

function platformForAsset(name) {
	const lowerName = name.toLowerCase();
	if (lowerName.includes('windows') || lowerName.includes('win32') || lowerName.endsWith('.exe') || lowerName.includes('setup')) return 'windows';
	if (lowerName.includes('mac') || lowerName.includes('darwin') || lowerName.endsWith('.dmg')) return 'macos';
	if (lowerName.endsWith('.deb')) return 'linux-deb';
	if (lowerName.endsWith('.rpm')) return 'linux-rpm';
	if (lowerName.endsWith('.pkg.tar.zst')) return 'linux-arch';
	if (lowerName.includes('linux') || lowerName.endsWith('.appimage')) return 'linux';
	return 'other';
}

const response = await fetch(endpoint, {
	headers: {
		accept: 'application/vnd.github+json',
		'user-agent': 'datalith-site-build',
		...(token ? { authorization: `Bearer ${token}` } : {}),
	},
});
if (!response.ok) {
	const accessHint = response.status === 404
		? ' The repository may be private or the token may not have Contents: read access.'
		: '';
	throw new Error(`GitHub Releases request failed with ${response.status} ${response.statusText}.${accessHint}`);
}

const releases = (await response.json())
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
	.sort(compareVersions);

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify({ repository, generatedAt: new Date().toISOString(), releases }, null, 2)}\n`);
const releaseScope = includeDrafts ? 'releases including drafts' : 'published releases';
console.log(`Fetched ${releases.length} ${releaseScope} from ${repository}`);

const starsResponse = await fetch(`https://api.github.com/repos/${repository}`, {
	headers: {
		accept: 'application/vnd.github+json',
		'user-agent': 'datalith-site-build',
		...(token ? { authorization: `Bearer ${token}` } : {}),
	},
});
let stargazersCount = 0;
if (starsResponse.ok) {
	const repo = await starsResponse.json();
	stargazersCount = Number(repo.stargazers_count ?? 0);
} else {
	console.warn(`GitHub repository request failed with ${starsResponse.status} ${starsResponse.statusText}; star count left at 0`);
}
await writeFile(
	path.join(siteRoot, 'src', 'data', 'stars.json'),
	`${JSON.stringify({ repository, stargazersCount, fetchedAt: new Date().toISOString() }, null, 2)}\n`,
);
console.log(`Fetched ${stargazersCount} stars from ${repository}`);
