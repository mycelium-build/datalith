export function camelCase(name: string): string {
	return name
		.split('-')
		.map((part, index) => (index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
		.join('');
}
