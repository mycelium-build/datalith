export interface ThemeState {
	mode: 'light' | 'dark';
	light: string;
	dark: string;
}

export const THEME_STORAGE_KEY = 'datalith:theme';
export const THEME_CHANGE_EVENT = 'datalith:themechange';

export const DEFAULT_STATE: ThemeState = { mode: 'light', light: 'datalith-light', dark: 'datalith-dark' };

export function systemMode(): 'light' | 'dark' {
	return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function readStoredState(): ThemeState | null {
	try {
		const raw = localStorage.getItem(THEME_STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Partial<ThemeState>;
		return {
			mode: parsed.mode === 'dark' ? 'dark' : 'light',
			light: typeof parsed.light === 'string' ? parsed.light : DEFAULT_STATE.light,
			dark: typeof parsed.dark === 'string' ? parsed.dark : DEFAULT_STATE.dark,
		};
	} catch {
		return null;
	}
}

export function loadTheme(): ThemeState {
	return readStoredState() ?? { ...DEFAULT_STATE, mode: systemMode() };
}

export function saveTheme(state: ThemeState): void {
	try {
		localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(state));
	} catch {
		// Storage unavailable (private mode): the theme still applies for this visit.
	}
}

export function activeThemeId(state: ThemeState): string {
	return state.mode === 'dark' ? state.dark : state.light;
}

export function applyTheme(id: string, mode: 'light' | 'dark'): void {
	document.documentElement.dataset.datalithTheme = id;
	document.documentElement.dataset.mode = mode;
	document.documentElement.style.colorScheme = mode;
	document.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: { id, mode } }));
}

export function initTheme(): ThemeState {
	const state = loadTheme();
	applyTheme(activeThemeId(state), state.mode);
	return state;
}

export function onThemeChange(listener: (id: string, mode: 'light' | 'dark') => void): () => void {
	const handler = (event: Event) => {
		const detail = (event as CustomEvent<{ id: string; mode: 'light' | 'dark' }>).detail;
		listener(detail.id, detail.mode);
	};
	document.addEventListener(THEME_CHANGE_EVENT, handler);
	return () => document.removeEventListener(THEME_CHANGE_EVENT, handler);
}
