import { describe, expect, it } from "vitest"

import { camelCase } from "../scripts/lib/icons.ts"
import { whiten } from "../src/lib/colors.ts"

describe("camelCase", () => {
    it("converts kebab-case icon names", () => {
        expect(camelCase("search")).toBe("search")
        expect(camelCase("arrow-down")).toBe("arrowDown")
        expect(camelCase("arrow-down-a-z")).toBe("arrowDownAZ")
        expect(camelCase("layout-dashboard")).toBe("layoutDashboard")
    })
})

describe("whiten", () => {
    it("lightens a hex color toward white", () => {
        expect(whiten("#000000", 1)).toBe("#ffffff")
        expect(whiten("#ffffff", 0)).toBe("#ffffff")
        expect(whiten("#000000", 0)).toBe("#000000")
    })
})
