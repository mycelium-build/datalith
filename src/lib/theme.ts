import * as v from "valibot"

const ThemeStateSchema = v.object({
    mode: v.fallback(v.picklist(["light", "dark"]), "light"),
    light: v.fallback(v.string(), "datalith-light"),
    dark: v.fallback(v.string(), "datalith-dark"),
})

export type ThemeState = v.InferOutput<typeof ThemeStateSchema>

export const DEFAULT_STATE: ThemeState = v.parse(ThemeStateSchema, {})

export const THEME_STORAGE_KEY = "datalith:theme"
export const THEME_CHANGE_EVENT = "datalith:themechange"

declare global {
    interface DocumentEventMap {
        [THEME_CHANGE_EVENT]: CustomEvent<{ id: string; mode: "light" | "dark" }>
    }
}

export function systemMode(): "light" | "dark" {
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export function readStoredState(): ThemeState | null {
    try {
        const raw = localStorage.getItem(THEME_STORAGE_KEY)
        if (!raw) return null
        const parsed = v.safeParse(ThemeStateSchema, JSON.parse(raw))
        return parsed.success ? parsed.output : null
    } catch {
        return null
    }
}

export function loadTheme(): ThemeState {
    return readStoredState() ?? { ...DEFAULT_STATE, mode: systemMode() }
}

export function saveTheme(state: ThemeState): void {
    try {
        localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(state))
    } catch {
        // Storage unavailable (private mode): the theme still applies for this visit.
    }
}

export function activeThemeId(state: ThemeState): string {
    return state.mode === "dark" ? state.dark : state.light
}

export function applyTheme(id: string, mode: "light" | "dark"): void {
    document.documentElement.dataset.datalithTheme = id
    document.documentElement.dataset.mode = mode
    document.documentElement.style.colorScheme = mode
    document.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: { id, mode } }))
}

export function initTheme(): ThemeState {
    const state = loadTheme()
    applyTheme(activeThemeId(state), state.mode)
    return state
}

export function onThemeChange(listener: (id: string, mode: "light" | "dark") => void): () => void {
    const handler = (event: DocumentEventMap[typeof THEME_CHANGE_EVENT]) => {
        listener(event.detail.id, event.detail.mode)
    }
    document.addEventListener(THEME_CHANGE_EVENT, handler)
    return () => document.removeEventListener(THEME_CHANGE_EVENT, handler)
}
