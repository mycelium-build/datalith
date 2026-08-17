import { describe, expect, it } from "vitest"

import {
    cssDeclarationLines,
    translateTheme,
    slug,
    CURATED_LIGHT,
    CURATED_DARK,
} from "../scripts/lib/themes.ts"

describe("translateTheme", () => {
    it("prefers primary.background over accent.background for the accent", () => {
        const result = translateTheme(
            {
                name: "Test Light",
                colors: { "primary.background": "#123456", "accent.background": "#654321" },
            },
            "light",
        )
        expect(result["--dl-accent"]).toBe("#123456")
    })

    it("falls back through accent.background and ring", () => {
        const withAccent = translateTheme(
            { name: "Test Light", colors: { "accent.background": "#111111" } },
            "light",
        )
        expect(withAccent["--dl-accent"]).toBe("#111111")

        const withRing = translateTheme(
            { name: "Test Light", colors: { ring: "#222222" } },
            "light",
        )
        expect(withRing["--dl-accent"]).toBe("#222222")
    })

    it("falls back to the default accent when no key is present", () => {
        const result = translateTheme({ name: "Empty Light", colors: {} }, "light")
        expect(result["--dl-accent"]).toBe("#1e8dff")
    })

    it("prefers primary.foreground over accent.foreground for accent-fg", () => {
        const result = translateTheme(
            {
                name: "Test Light",
                colors: { "primary.foreground": "#aaaaaa", "accent.foreground": "#bbbbbb" },
            },
            "light",
        )
        expect(result["--dl-accent-fg"]).toBe("#aaaaaa")
    })

    it("uses the passed mode for defaults", () => {
        expect(translateTheme({ name: "A", colors: {} }, "dark").mode).toBe("dark")
        expect(translateTheme({ name: "B", colors: {} }, "light").mode).toBe("light")
    })

    it("uses sensible defaults for missing keys", () => {
        const result = translateTheme({ name: "A", colors: {} }, "dark")
        expect(result["--dl-bg"]).toBe("#131313")
        expect(result["--dl-accent-fg"]).toBe("#ffffff")
        expect(result["--dl-muted"]).toBe("#dedede")
    })
})

describe("slug", () => {
    it("normalizes curated theme names", () => {
        expect(slug("Datalith Light")).toBe("datalith-light")
        expect(slug("Catppuccin Mocha")).toBe("catppuccin-mocha")
        expect(slug("  Tokyo Night  ")).toBe("tokyo-night")
    })
})

describe("curated theme lists", () => {
    it("curates 5 light and 5 dark themes", () => {
        expect(CURATED_LIGHT).toHaveLength(5)
        expect(CURATED_DARK).toHaveLength(5)
    })

    it("keeps the light and dark lists disjoint", () => {
        const overlap = CURATED_LIGHT.filter((name) => CURATED_DARK.includes(name))
        expect(overlap).toEqual([])
    })
})

describe("cssDeclarationLines", () => {
    it("only emits custom properties, never metadata keys", () => {
        const variables = translateTheme({ name: "A", colors: {} }, "dark")
        const lines = cssDeclarationLines(variables)
        expect(lines.split("\n").every((line) => line.trim().startsWith("--"))).toBe(true)
        expect(lines).not.toContain("\tmode:")
        expect(lines).not.toContain("\taccent:")
        expect(lines).not.toContain("\tfg:")
        expect(lines).not.toContain("\tbg:")
        expect(lines).toContain("--dl-bg:")
        expect(lines).toContain("--dl-accent:")
    })
})
