const DEFAULT_INTENSITY = 50;
const MIN_CELL_OPACITY = 0.25;
const MAX_CELL_OPACITY = 1;

export function normalizeIntensity(value) {
	const parsedIntensity = Number.parseFloat(String(value));

	if (!Number.isFinite(parsedIntensity)) {
		return DEFAULT_INTENSITY;
	}

	return Math.min(100, Math.max(0, parsedIntensity));
}

export function getIntensityOpacity(value) {
	const normalizedIntensity = normalizeIntensity(value);
	const opacityRange = MAX_CELL_OPACITY - MIN_CELL_OPACITY;

	return MIN_CELL_OPACITY + (normalizedIntensity / 100) * opacityRange;
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
		r: Number.parseInt(expandedHex.slice(0, 2), 16),
		g: Number.parseInt(expandedHex.slice(2, 4), 16),
		b: Number.parseInt(expandedHex.slice(4, 6), 16)
	};
}

export function getIntensityCellColor(color, intensity) {
	const opacity = getIntensityOpacity(intensity);
	const rgb = parseHexColor(color);

	if (rgb) {
		return `rgb(${rgb.r} ${rgb.g} ${rgb.b} / ${opacity.toFixed(3)})`;
	}

	return `color-mix(in srgb, ${color} ${(opacity * 100).toFixed(1)}%, transparent)`;
}

export function buildIntensitySplitFill(sessions, { maxSegments = 3 } = {}) {
	const visibleSessions = sessions.filter((session) => session?.color).slice(0, maxSegments);

	if (visibleSessions.length === 0) {
		return '';
	}

	const colors = visibleSessions.map((session) =>
		getIntensityCellColor(session.color, session.intensity)
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
