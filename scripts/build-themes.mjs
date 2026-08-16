import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const themesDirectory = path.join(siteRoot, 'src', 'data', 'themes');
const stylesDirectory = path.join(siteRoot, 'src', 'styles');

const CURATED = [
	'Datalith Light',
	'Ayu Light',
	'Everforest Light',
	'Flexoki Light',
	'Mellifluous Light',
	'Datalith Dark',
	'Matrix',
	'Tokyo Night',
	'Gruvbox Dark',
	'Solarized Dark',
];

function rgbToHsl([r, g, b]) {
	r /= 255;
	g /= 255;
	b /= 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const delta = max - min;
	const l = (max + min) / 2;
	let s = 0;
	if (l !== 0 && l !== 1) s = delta / (l < 0.5 ? 2 * l : 2 - 2 * l);
	let h = 0;
	if (delta !== 0) {
		if (max === r) h = ((g - b) / delta) % 6;
		else if (max === g) h = (b - r) / delta + 2;
		else h = (r - g) / delta + 4;
		h /= 6;
		if (h < 0) h += 1;
	}
	return [h, s, l];
}

function hslToRgb([h, s, l]) {
	const c = (1 - Math.abs(2 * l - 1)) * s;
	const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
	const m = l - c / 2;
	let rgb;
	const arm = Math.floor(h * 6) % 6;
	if (arm === 0) rgb = [c + m, x + m, m];
	else if (arm === 1) rgb = [x + m, c + m, m];
	else if (arm === 2) rgb = [m, c + m, x + m];
	else if (arm === 3) rgb = [m, x + m, c + m];
	else if (arm === 4) rgb = [x + m, m, c + m];
	else rgb = [c + m, m, x + m];
	return rgb.map((v) => Math.min(255, Math.max(0, Math.round(v * 255))));
}

function hexToRgb(hex) {
	const match = hex.replace('#', '');
	return [match.slice(0, 2), match.slice(2, 4), match.slice(4, 6)].map((part) => parseInt(part, 16));
}

export function whiten(hex, amount) {
	const [h, s, l] = rgbToHsl(hexToRgb(hex));
	return `#${hslToRgb([h, s * (1 - amount), l + (1 - l) * amount]).map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function first(colors, keys, fallback) {
	for (const key of keys) {
		const value = colors[key];
		if (typeof value === 'string' && value) return value;
	}
	return fallback;
}

function defaultAccent(mode) {
	return mode === 'dark' ? '#1e8dff' : '#1e8dff';
}

function slug(name) {
	return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function translateTheme(entry) {
	const mode = entry.mode === 'dark' ? 'dark' : 'light';
	const colors = entry.colors ?? {};
	const highlight = entry.highlight ?? {};
	const accent = first(colors, ['primary.background', 'accent.background', 'ring'], defaultAccent(mode));
	const fg = first(colors, ['foreground'], mode === 'dark' ? '#dedede' : '#000000');
	const bg = first(colors, ['background'], mode === 'dark' ? '#131313' : '#f9f9f9');
	return {
		mode,
		accent,
		fg,
		bg,
		'--dl-bg': bg,
		'--dl-surface': first(
			colors,
			['title_bar.background', 'tab_bar.background', 'popover.background', 'list.even.background', 'background'],
			bg,
		),
		'--dl-surface-alt': first(colors, ['list.hover.background', 'muted.background', 'secondary.background'], bg),
		'--dl-fg': fg,
		'--dl-muted': first(colors, ['muted.foreground', 'tab.foreground', 'popover.foreground'], fg),
		'--dl-border': first(colors, ['border', 'title_bar.border'], '#888888'),
		'--dl-accent': accent,
		'--dl-accent-fg': first(colors, ['primary.foreground', 'accent.foreground'], '#ffffff'),
		'--dl-ring': first(colors, ['ring'], accent),
		'--dl-code-bg': first(highlight, ['editor.background'], bg),
		'--dl-yellow': first(colors, ['base.yellow'], '#b59a00'),
		'--dl-red': first(colors, ['base.red'], '#d21f07'),
		'--dl-green': first(colors, ['base.green'], '#319a00'),
		'--dl-blue': first(colors, ['base.blue'], accent),
		'--dl-cyan': first(colors, ['base.cyan'], '#007e8a'),
		'--dl-magenta': first(colors, ['base.magenta'], '#9a0068'),
		'--dl-logo-1': whiten(accent, 0.35),
		'--dl-logo-2': whiten(accent, 0.7),
	};
}

function toCss(theme, variables) {
	const lines = Object.entries(variables)
		.map(([name, value]) => `\t${name}: ${value};`)
		.join('\n');
	return `:root[data-datalith-theme="${theme.id}"] {\n\tcolor-scheme: ${theme.mode};\n${lines}\n}\n`;
}

async function main() {
	const files = (await readdir(themesDirectory)).filter((file) => file.endsWith('.json'));
	const themes = [];
	for (const file of files) {
		const data = JSON.parse(await readFile(path.join(themesDirectory, file), 'utf8'));
		for (const entry of data.themes ?? []) {
			if (!CURATED.includes(entry.name)) continue;
			const id = slug(entry.name);
			const variables = translateTheme(entry);
			themes.push({
				id,
				name: entry.name,
				mode: entry.mode === 'dark' ? 'dark' : 'light',
				accent: variables['--dl-accent'],
				bg: variables['--dl-bg'],
				fg: variables['--dl-fg'],
				variables,
			});
		}
	}

	themes.sort((a, b) => {
		if (a.mode !== b.mode) return a.mode === 'light' ? -1 : 1;
		return a.name.localeCompare(b.name);
	});

	const defaultTheme = themes.find((theme) => theme.id === 'datalith-light');
	const css = [
		'/* This file is generated by scripts/build-themes.mjs — do not edit directly. */',
		`:root {\n\tcolor-scheme: light;\n${Object.entries(defaultTheme.variables)
			.map(([name, value]) => `\t${name}: ${value};`)
			.join('\n')}\n}\n`,
		...themes.map((theme) => toCss(theme, theme.variables)),
	].join('\n');

	await mkdir(stylesDirectory, { recursive: true });
	await writeFile(path.join(stylesDirectory, 'themes.css'), css);
	await writeFile(
		path.join(siteRoot, 'src', 'data', 'themes.json'),
		`${JSON.stringify(themes.map(({ variables, ...theme }) => theme), null, 2)}\n`,
	);
	console.log(`Wrote ${themes.length} themes to src/styles/themes.css and src/data/themes.json`);
}

await main();
