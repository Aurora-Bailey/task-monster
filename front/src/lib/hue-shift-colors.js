const DEFAULT_HUE_SHIFT = 50;
const MAX_HSL_OFFSET = 10;

export function normalizeHueShift(value) {
	const parsedHueShift = Number.parseFloat(String(value));

	if (!Number.isFinite(parsedHueShift)) {
		return DEFAULT_HUE_SHIFT;
	}

	return Math.min(100, Math.max(0, parsedHueShift));
}

export function getHueShiftOffset(value) {
	return ((normalizeHueShift(value) - DEFAULT_HUE_SHIFT) / DEFAULT_HUE_SHIFT) * MAX_HSL_OFFSET;
}

function clampHslPercentage(value) {
	return Math.min(100, Math.max(0, value));
}

function parseHexColor(color) {
	if (typeof color !== 'string') {
		return null;
	}

	const trimmedColor = color.trim();
	const hexMatch = trimmedColor.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);

	if (!hexMatch) {
		return null;
	}

	const hex = hexMatch[1];
	const expandedHex =
		hex.length === 3
			? hex
					.split('')
					.map((character) => `${character}${character}`)
					.join('')
			: hex;

	return {
		r: Number.parseInt(expandedHex.slice(0, 2), 16) / 255,
		g: Number.parseInt(expandedHex.slice(2, 4), 16) / 255,
		b: Number.parseInt(expandedHex.slice(4, 6), 16) / 255
	};
}

function rgbToHsl({ r, g, b }) {
	const maximum = Math.max(r, g, b);
	const minimum = Math.min(r, g, b);
	const delta = maximum - minimum;
	const lightness = (maximum + minimum) / 2;
	let hue = 0;
	let saturation = 0;

	if (delta !== 0) {
		saturation = delta / (1 - Math.abs(2 * lightness - 1));

		if (maximum === r) {
			hue = 60 * (((g - b) / delta) % 6);
		} else if (maximum === g) {
			hue = 60 * ((b - r) / delta + 2);
		} else {
			hue = 60 * ((r - g) / delta + 4);
		}
	}

	if (hue < 0) {
		hue += 360;
	}

	return {
		hue,
		saturation: saturation * 100,
		lightness: lightness * 100
	};
}

export function getHueShiftColor(color, hueShift) {
	const normalizedHueShift = normalizeHueShift(hueShift);
	const rgb = parseHexColor(color);

	if (!rgb || normalizedHueShift === DEFAULT_HUE_SHIFT) {
		return color;
	}

	const hsl = rgbToHsl(rgb);
	const offset = getHueShiftOffset(normalizedHueShift);
	const shiftedHue = (hsl.hue + offset + 360) % 360;
	const shiftedSaturation = clampHslPercentage(hsl.saturation + offset);
	const shiftedLightness = clampHslPercentage(hsl.lightness + offset);

	return `hsl(${shiftedHue.toFixed(3)} ${shiftedSaturation.toFixed(3)}% ${shiftedLightness.toFixed(3)}%)`;
}

export function buildHueShiftSplitFill(sessions, { maxSegments = 3 } = {}) {
	const visibleSessions = sessions.filter((session) => session?.color).slice(0, maxSegments);

	if (visibleSessions.length === 0) {
		return '';
	}

	const colors = visibleSessions.map((session) =>
		getHueShiftColor(session.color, session.hueShift)
	);

	if (colors.length === 1) {
		return colors[0];
	}

	const segmentSize = 100 / colors.length;
	const segments = colors.map(
		(color, index) => `${color} ${index * segmentSize}% ${(index + 1) * segmentSize}%`
	);

	return `linear-gradient(180deg, ${segments.join(', ')})`;
}
