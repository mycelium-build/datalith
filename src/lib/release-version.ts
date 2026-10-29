export function formatReleaseVersion(tag?: string): string {
    if (!tag) return ""
    return `v${tag.replace(/^v/i, "")}`.replace(/-rc\.(\d+)$/i, " RC$1")
}
