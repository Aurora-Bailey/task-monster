export function formatMinutes(minutes) {
	if (minutes === null || minutes === undefined) {
		return 'No timer';
	}

	if (minutes === 0) {
		return '0 min';
	}

	if (minutes % 60 === 0) {
		const hours = minutes / 60;
		return `${hours} hr${hours === 1 ? '' : 's'}`;
	}

	return `${minutes} min`;
}

export function formatTaskMode(mode) {
	return mode === 'repeatable' ? 'Repeatable' : 'One-time';
}

export function formatTaskTrackingType(trackingType) {
	return trackingType === 'tally' ? 'Tally' : 'Clock';
}

export function formatTallyCount(count, unit = 'units') {
	return `${Math.max(0, Number.isFinite(count) ? count : 0)} ${unit || 'units'}`;
}

export function formatTallyProgress(count, target, unit = 'units') {
	const safeCount = Math.max(0, Number.isFinite(count) ? count : 0);

	if (Number.isInteger(target) && target > 0) {
		return `${safeCount} / ${target} ${unit || 'units'}`;
	}

	return formatTallyCount(safeCount, unit);
}

export function formatElapsedDuration(milliseconds) {
	const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	if (hours > 0) {
		return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
	}

	if (minutes > 0) {
		return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
	}

	return `${seconds}s`;
}
