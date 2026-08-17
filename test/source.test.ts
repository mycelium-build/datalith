import path from "node:path"

import { afterEach, describe, expect, it, vi } from "vitest"

import { resolveDatalithSource, resolveLocalSource } from "../scripts/lib/source.ts"

afterEach(() => {
    vi.unstubAllEnvs()
})

describe("resolveLocalSource", () => {
    it("returns the DATALITH_SOURCE_DIR path when set outside CI", () => {
        vi.stubEnv("DATALITH_SOURCE_DIR", "/tmp/datalith-vault")
        vi.stubEnv("CI", undefined)
        expect(resolveLocalSource()).toBe("/tmp/datalith-vault")
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
        expect(source.root).toBe("/tmp/datalith-vault")
    })

    it("throws when CI is set without a source dir or token", async () => {
        vi.stubEnv("DATALITH_SOURCE_DIR", undefined)
        vi.stubEnv("DATALITH_READ_TOKEN", undefined)
        vi.stubEnv("CI", "true")
        await expect(resolveDatalithSource()).rejects.toThrow(/DATALITH_READ_TOKEN/)
    })

    it("falls back to the sibling datalith checkout when neither is set", async () => {
        vi.stubEnv("DATALITH_SOURCE_DIR", undefined)
        vi.stubEnv("DATALITH_READ_TOKEN", undefined)
        vi.stubEnv("CI", undefined)
        const source = await resolveDatalithSource()
        expect(source.root.endsWith(path.join("datalith"))).toBe(true)
    })
})
