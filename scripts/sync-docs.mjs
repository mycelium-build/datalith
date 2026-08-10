import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.resolve(process.env.DATALITH_SOURCE_DIR ?? path.join(siteRoot, '..', 'datalith'));
const sourceVault = path.join(sourceRoot, 'docs', 'vault');
const destinationVault = path.join(siteRoot, 'src', 'content', 'docs', 'vault');
const sourceUrl = 'https://github.com/mycelium-build/datalith/blob/main/docs/vault';

const markdownFiles = [];

async function collectMarkdown(directory, relativeDirectory = '') {
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const relativePath = path.join(relativeDirectory, entry.name);
		const absolutePath = path.join(directory, entry.name);
		if (entry.isDirectory()) await collectMarkdown(absolutePath, relativePath);
		else if (entry.isFile() && entry.name.endsWith('.md')) markdownFiles.push(relativePath);
	}
}

function titleFromMarkdown(markdown, fallback) {
	const heading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
	return heading ?? fallback;
}

function parseFrontmatter(markdown) {
	const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
	if (!match) return { body: markdown, frontmatter: '' };
	return { body: markdown.slice(match[0].length), frontmatter: match[1] };
}

function routeFor(relativePath) {
	const withoutExtension = relativePath.replace(/\.md$/i, '');
	return `docs/vault/${withoutExtension.split(path.sep).map((segment) => segment.toLowerCase()).join('/')}`;
}

function buildDocumentIndex() {
	const byPath = new Map();
	const byStem = new Map();
	for (const relativePath of markdownFiles) {
		const normalizedPath = relativePath.split(path.sep).join('/').replace(/\.md$/i, '');
		const route = routeFor(relativePath);
		byPath.set(normalizedPath.toLowerCase(), route);
		const stem = path.posix.basename(normalizedPath).toLowerCase();
		const matches = byStem.get(stem) ?? [];
		matches.push({ normalizedPath, route });
		byStem.set(stem, matches);
	}
	return { byPath, byStem };
}

function wikiTarget(target, currentPath, index) {
	const normalizedTarget = target.trim().replace(/^\.\//, '').replace(/\.(md|todotxt|graph)$/i, '');
	if (/^https?:\/\//i.test(normalizedTarget)) return normalizedTarget;

	const targetWithSlashes = normalizedTarget.replaceAll('\\', '/');
	const currentDirectory = path.posix.dirname(currentPath);
	const candidates = targetWithSlashes.includes('/')
		? [targetWithSlashes]
		: [path.posix.join(currentDirectory, targetWithSlashes), targetWithSlashes];
	const markdownRoute = candidates
		.map((candidate) => index.byPath.get(candidate.toLowerCase()))
		.find(Boolean);
	const fallbackRoute = markdownRoute ?? index.byStem.get(path.posix.basename(targetWithSlashes).toLowerCase())?.[0]?.route;
	if (fallbackRoute) return `/${fallbackRoute}/`;

	return `${sourceUrl}/${target.replaceAll('\\', '/')}`;
}

function relativeMarkdownLink(currentRoute, targetRoute) {
	const fromDirectory = `/${currentRoute}`;
	const relative = path.posix.relative(fromDirectory, `/${targetRoute}`);
	return `${relative || '.'}/`;
}

function rewriteWikiLinks(markdown, currentPath, index) {
	const currentRoute = routeFor(currentPath);
	let inFence = false;
	return markdown
		.split(/\r?\n/)
		.map((line) => {
			if (/^\s*(```|~~~)/.test(line)) {
				inFence = !inFence;
				return line;
			}
			if (inFence) return line;

			const parts = line.split(/(`+[^`]*`+)/g);
			return parts
				.map((part, indexPart) => {
					if (indexPart % 2 === 1) return part;
					return part.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, label) => {
						const link = wikiTarget(target, currentPath, index);
						const text = label?.trim() || target.trim();
						if (/^https?:\/\//i.test(link)) return `[${text}](${link})`;
						const route = link.slice(1, -1);
						return `[${text}](${relativeMarkdownLink(currentRoute, route)})`;
					});
				})
				.join('');
		})
		.join('\n');
}

function addStarlightFrontmatter(markdown, relativePath) {
	const { body, frontmatter } = parseFrontmatter(markdown);
	const title = titleFromMarkdown(body, path.basename(relativePath, '.md'));
	const route = routeFor(relativePath);
	let fields = frontmatter ? `${frontmatter}\n` : '';
	if (!/^title\s*:/m.test(fields)) fields += `title: ${JSON.stringify(title)}\n`;
	if (!/^slug\s*:/m.test(fields)) fields += `slug: ${route}\n`;
	return `---\n${fields}---\n\n${body.trimStart()}`;
}

await collectMarkdown(sourceVault);
const index = buildDocumentIndex();
await rm(destinationVault, { recursive: true, force: true });
await mkdir(destinationVault, { recursive: true });

for (const relativePath of markdownFiles) {
	const sourcePath = path.join(sourceVault, relativePath);
	const destinationPath = path.join(destinationVault, relativePath);
	const original = await readFile(sourcePath, 'utf8');
	const rewritten = rewriteWikiLinks(original, relativePath, index);
	const document = addStarlightFrontmatter(rewritten, relativePath);
	await mkdir(path.dirname(destinationPath), { recursive: true });
	await writeFile(destinationPath, `${document}\n`);
}

console.log(`Imported ${markdownFiles.length} Markdown files from ${sourceVault}`);
