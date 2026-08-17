import { whiten } from '../../src/lib/colors.ts';

export interface ThemeEntry {
	name: string;
	colors?: Record<string, string>;
	highlight?: Record<string, string>;
}

export type ThemeMode = 'light' | 'dark';

export type ThemeVariables = Record<string, string> & {
	mode: ThemeMode;
	accent: string;
	fg: string;
	bg: string;
};

export const CURATED_LIGHT = [
	'Datalith Light',
	'Ayu Light',
	'Everforest Light',
	'Gruvbox Light',
	'Mellifluous Light',
];

export const CURATED_DARK = [
	'Datalith Dark',
	'Matrix',
	'Tokyo Night',
	'Gruvbox Dark',
	'Catppuccin Mocha',
];

const DEFAULT_ACCENT = '#1e8dff';

function first(colors: Record<string, string>, keys: string[], fallback: string): string {
	for (const key of keys) {
		const value = colors[key];
		if (typeof value === 'string' && value) return value;
	}
	return fallback;
}

export function slug(name: string): string {
	return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function translateTheme(entry: ThemeEntry, mode: ThemeMode): ThemeVariables {
	const colors = entry.colors ?? {};
	const highlight = entry.highlight ?? {};
	const accent = first(colors, ['primary.background', 'accent.background', 'ring'], DEFAULT_ACCENT);
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
