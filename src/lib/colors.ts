export type RGB = [number, number, number];
export type HSL = [number, number, number];

export function rgbToHsl([r0, g0, b0]: RGB): HSL {
	const r = r0 / 255;
	const g = g0 / 255;
	const b = b0 / 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const delta = max - min;
	const l = (max + min) / 2;
	let s = 0;
	if (l !== 0 && l !== 1) s = delta / (l < 0.5 ? 2 * l : 2 - 2 * l);
	let h = 0;
	if (delta !== 0) {
		if (max === r) h = ((g - b) / delta) % 6;
		else if (max === g) h = (b - r) / delta + 2;
		else h = (r - g) / delta + 4;
		h /= 6;
		if (h < 0) h += 1;
	}
	return [h, s, l];
}

export function hslToRgb([h, s, l]: HSL): RGB {
	const c = (1 - Math.abs(2 * l - 1)) * s;
	const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
	const m = l - c / 2;
	let rgb: RGB;
	const arm = Math.floor(h * 6) % 6;
	if (arm === 0) rgb = [c + m, x + m, m];
	else if (arm === 1) rgb = [x + m, c + m, m];
	else if (arm === 2) rgb = [m, c + m, x + m];
	else if (arm === 3) rgb = [m, x + m, c + m];
	else if (arm === 4) rgb = [x + m, m, c + m];
	else rgb = [c + m, m, x + m];
	return rgb.map((v) => Math.min(255, Math.max(0, Math.round(v * 255)))) as RGB;
}

export function hexToRgb(hex: string): RGB {
	const clean = hex.replace('#', '');
	const value = clean.length === 3 ? clean.split('').map((ch) => ch + ch).join('') : clean;
	return [
		parseInt(value.slice(0, 2), 16),
		parseInt(value.slice(2, 4), 16),
		parseInt(value.slice(4, 6), 16),
	];
}

export function whiten(hex: string, amount: number): string {
	const [h, s, l] = rgbToHsl(hexToRgb(hex));
	return (
		'#' +
		hslToRgb([h, s * (1 - amount), l + (1 - l) * amount])
			.map((v) => v.toString(16).padStart(2, '0'))
			.join('')
	);
}
