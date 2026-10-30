import { describe, expect, it } from "vite-plus/test"

import {
    versionParts,
    compareVersions,
    isPreviewAheadOfStable,
    platformForAsset,
    archForAsset,
    latestDocsTags,
} from "../scripts/lib/releases.ts"

describe("latestDocsTags", () => {
    it.each(["v2.0.0-rc.2", "v1.9.0-rc.9"])(
        "excludes %s when stable has caught up or moved ahead",
        (tagName) => {
            expect(
                latestDocsTags([
                    { tagName: "v2.0.0", prerelease: false },
                    { tagName, prerelease: true },
                ]),
            ).toEqual({ stable: "v2.0.0", preview: undefined })
        },
    )

    it("keeps a preview for the next patch release", () => {
        expect(
            latestDocsTags([
                { tagName: "v2.0.1-rc.1", prerelease: true },
                { tagName: "v2.0.0", prerelease: false },
            ]),
        ).toEqual({ stable: "v2.0.0", preview: "v2.0.1-rc.1" })
    })

    it("uses RC tags even if GitHub's prerelease flag is inconsistent", () => {
        expect(
            latestDocsTags([
                { tagName: "v2.0.0-rc.1", prerelease: false },
                { tagName: "v1.0.0", prerelease: false },
            ]),
        ).toEqual({ stable: "v1.0.0", preview: "v2.0.0-rc.1" })
    })

    it("picks the newest stable and upcoming RC, ignoring drafts", () => {
        const release = (tagName: string, prerelease: boolean, draft = false) => ({
            tagName,
            prerelease,
            draft,
        })
        expect(
            latestDocsTags([
                release("v3.0.0", false, true),
                release("v3.0.0-rc.1", true, true),
                release("v2.1.0-rc.2", true),
                release("v2.0.0", false),
                release("v1.0.0", false),
            ]),
        ).toEqual({ stable: "v2.0.0", preview: "v2.1.0-rc.2" })
        expect(latestDocsTags([release("v1.0.0", false)]).preview).toBeUndefined()
        expect(latestDocsTags([]).stable).toBeUndefined()
    })
})

describe("versionParts", () => {
    it("parses semver tags", () => {
        expect(versionParts("v1.2.3")).toEqual([1, 2, 3, 0])
        expect(versionParts("1.2.3")).toEqual([1, 2, 3, 0])
        expect(versionParts("v1.2.3-rc.4")).toEqual([1, 2, 3, -4])
        expect(versionParts("v10.20.30")).toEqual([10, 20, 30, 0])
    })

    it("rejects non-semver tags", () => {
        expect(versionParts("not-a-version")).toBeNull()
        expect(versionParts("v1.2")).toBeNull()
        expect(versionParts("1.2.3-beta.1")).toBeNull()
    })
})

describe("compareVersions", () => {
    it("sorts newest first, release above release candidates", () => {
        const releases = [
            { tagName: "v1.2.3", publishedAt: "2026-01-01T00:00:00Z" },
            { tagName: "v1.2.3-rc.1", publishedAt: "2026-01-02T00:00:00Z" },
            { tagName: "v1.2.3-rc.4", publishedAt: "2026-01-04T00:00:00Z" },
            { tagName: "v1.2.3-rc.2", publishedAt: "2026-01-03T00:00:00Z" },
            { tagName: "v1.10.0", publishedAt: "2026-01-03T00:00:00Z" },
        ]
        const sorted = [...releases].sort(compareVersions)
        expect(sorted.map((release) => release.tagName)).toEqual([
            "v1.10.0",
            "v1.2.3",
            "v1.2.3-rc.4",
            "v1.2.3-rc.2",
            "v1.2.3-rc.1",
        ])
    })
})

describe("isPreviewAheadOfStable", () => {
    it("hides a preview once its stable version has been released", () => {
        expect(isPreviewAheadOfStable({ tagName: "v0.1.0-rc.4" }, { tagName: "v0.1.0" })).toBe(
            false,
        )
    })

    it("keeps the preview for a later release line", () => {
        expect(isPreviewAheadOfStable({ tagName: "v0.1.1-rc.1" }, { tagName: "v0.1.0" })).toBe(true)
    })
})

describe("platformForAsset", () => {
    it("classifies asset names by platform", () => {
        expect(platformForAsset("datalith-Setup-1.0.0.exe")).toBe("windows")
        expect(platformForAsset("Datalith.dmg")).toBe("macos")
        expect(platformForAsset("datalith_1.0.0_amd64.deb")).toBe("linux-deb")
        expect(platformForAsset("datalith-1.0.0.x86_64.rpm")).toBe("linux-rpm")
        expect(platformForAsset("datalith-1.0.0-x86_64.pkg.tar.zst")).toBe("linux-arch")
        expect(platformForAsset("datalith-1.0.0-x86_64.AppImage")).toBe("linux")
        expect(platformForAsset("checksums.txt")).toBe("other")
    })
})

describe("archForAsset", () => {
    it("detects arm64 assets across packaging conventions", () => {
        expect(archForAsset("Datalith_0.1.0_aarch64.dmg")).toBe("arm64")
        expect(archForAsset("datalith_0.1.0_arm64-setup.exe")).toBe("arm64")
        expect(archForAsset("datalith_0.1.0-1_arm64.deb")).toBe("arm64")
        expect(archForAsset("datalith-0.1.0-1.aarch64.rpm")).toBe("arm64")
        expect(archForAsset("datalith_0.1.0_aarch64.AppImage")).toBe("arm64")
    })

    it("detects x64 assets across packaging conventions", () => {
        expect(archForAsset("datalith_0.1.0_x64-setup.exe")).toBe("x64")
        expect(archForAsset("Datalith_0.1.0_x64.dmg")).toBe("x64")
        expect(archForAsset("datalith_0.1.0_x86_64.AppImage")).toBe("x64")
        expect(archForAsset("datalith_0.1.0.rc.5-1_amd64.deb")).toBe("x64")
        expect(archForAsset("datalith-0.1.0.rc.5-1.x86_64.rpm")).toBe("x64")
        expect(archForAsset("datalith_0.1.0rc.5-1-x86_64.pkg.tar.zst")).toBe("x64")
    })

    it("returns null for assets without an architecture token", () => {
        expect(archForAsset("SHA256SUMS")).toBeNull()
        expect(archForAsset("LICENSE-GPL-3.0")).toBeNull()
        expect(archForAsset("datalith-0.1.0.spdx.json")).toBeNull()
        expect(archForAsset("datalith-0.1.0-corresponding-source.tar.zst")).toBeNull()
    })
})
