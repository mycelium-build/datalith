export function docUrl(route: string): string {
	return `${import.meta.env.BASE_URL.replace(/\/$/, '')}${route}`;
}
