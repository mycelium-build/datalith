export interface ComparableRelease {
	tagName: string;
	publishedAt?: string | null;
}

export function versionParts(tag: string): number[] | null {
	const match = tag.match(/^v?(\d+)\.(\d+)\.(\d+)(?:-rc\.(\d+))?$/i);
	if (!match) return null;
	const rc = match[4];
	return [
		Number(match[1]),
		Number(match[2]),
		Number(match[3]),
		rc ? -Number(rc) : 0,
	];
}

export function compareVersions(left: ComparableRelease, right: ComparableRelease): number {
	const a = versionParts(left.tagName) ?? [0, 0, 0, 0];
	const b = versionParts(right.tagName) ?? [0, 0, 0, 0];
	for (let index = 0; index < a.length; index += 1) {
		if (a[index] !== b[index]) return b[index] - a[index];
	}
	return new Date(right.publishedAt ?? 0).getTime() - new Date(left.publishedAt ?? 0).getTime();
}

export function platformForAsset(name: string): string {
	const lowerName = name.toLowerCase();
	if (lowerName.includes('windows') || lowerName.includes('win32') || lowerName.endsWith('.exe') || lowerName.includes('setup')) return 'windows';
	if (lowerName.includes('mac') || lowerName.includes('darwin') || lowerName.endsWith('.dmg')) return 'macos';
	if (lowerName.endsWith('.deb')) return 'linux-deb';
	if (lowerName.endsWith('.rpm')) return 'linux-rpm';
	if (lowerName.endsWith('.pkg.tar.zst')) return 'linux-arch';
	if (lowerName.includes('linux') || lowerName.endsWith('.appimage')) return 'linux';
	return 'other';
}
