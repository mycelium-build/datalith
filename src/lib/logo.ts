import logoSource from '../data/logo.txt?raw';
import { whiten } from './colors.ts';

const TIER_COLORS: Record<string, string> = {
	M: 'light',
	'0': 'top',
	'1': 'right',
	'2': 'left',
	I: 'inscription',
};

interface LogoCell {
	x: number;
	y: number;
	color: string;
}

interface LogoGrid {
	width: number;
	height: number;
	cells: LogoCell[];
}

function parseLogo(source: string): LogoGrid {
	const cells: LogoCell[] = [];
	let width = 0;
	let height = 0;
	for (const line of source.split(/\r?\n/)) {
		if (!line.trim()) continue;
		let rowWidth = 0;
		for (let col = 0; col < line.length; col += 1) {
			const color = TIER_COLORS[line[col]];
			if (color) cells.push({ x: col, y: height, color });
			rowWidth = Math.max(rowWidth, col + 1);
		}
		width = Math.max(width, rowWidth);
		height += 1;
	}
	return { width, height, cells };
}

export function renderLogo(accent: string, cell = 1): string {
	const grid = parseLogo(logoSource);
	const colors = {
		light: accent,
		top: '#ffffff',
		right: whiten(accent, 0.35),
		left: whiten(accent, 0.7),
		inscription: '#ffffff',
	};
	const rects = grid.cells
		.map(({ x, y, color }) => `<rect x="${x}" y="${y}" width="1" height="1" fill="${colors[color]}"/>`)
		.join('');
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${grid.width * cell}" height="${
		grid.height * cell
	}" viewBox="0 0 ${grid.width} ${grid.height}" shape-rendering="crispEdges" role="img" aria-label="Datalith">${rects}</svg>`;
}

export function refreshLogo(): void {
	const accent = getComputedStyle(document.documentElement).getPropertyValue('--dl-accent').trim();
	if (!accent) return;
	for (const host of document.querySelectorAll<HTMLElement>('[data-monolith]')) {
		const cell = Number(host.dataset.monolithCell ?? 1);
		host.innerHTML = renderLogo(accent, cell);
	}
}
