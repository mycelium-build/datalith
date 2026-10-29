import path from "node:path"

import { afterEach, describe, expect, it, vi } from "vite-plus/test"

import { resolveDatalithSource, resolveLocalSource } from "../scripts/lib/source.ts"

afterEach(() => {
    vi.unstubAllEnvs()
})

describe("resolveLocalSource", () => {
    it("returns the DATALITH_SOURCE_DIR path when set outside CI", () => {
        vi.stubEnv("DATALITH_SOURCE_DIR", "/tmp/datalith-vault")
        vi.stubEnv("CI", undefined)
        expect(resolveLocalSource()).toBe(path.resolve("/tmp/datalith-vault"))
    })

    it("returns undefined when DATALITH_SOURCE_DIR is unset", () => {
        vi.stubEnv("DATALITH_SOURCE_DIR", undefined)
        expect(resolveLocalSource()).toBeUndefined()
    })

    it("throws when DATALITH_SOURCE_DIR is set in CI", () => {
        vi.stubEnv("DATALITH_SOURCE_DIR", "/tmp/datalith-vault")
        vi.stubEnv("CI", "true")
        expect(() => resolveLocalSource()).toThrow(/DATALITH_SOURCE_DIR/)
    })
})

describe("resolveDatalithSource", () => {
    it("uses the local source when DATALITH_SOURCE_DIR is set outside CI", async () => {
        vi.stubEnv("DATALITH_SOURCE_DIR", "/tmp/datalith-vault")
        vi.stubEnv("DATALITH_READ_TOKEN", undefined)
        vi.stubEnv("CI", undefined)
        const source = await resolveDatalithSource()
        expect(source.root).toBe(path.resolve("/tmp/datalith-vault"))
    })
})
