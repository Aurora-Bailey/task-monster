function parseTimezoneOffsetMinutes(value) {
	if (value === undefined || value === null) {
		return 0;
	}

	const parsed = Number.parseInt(value, 10);

	if (!Number.isInteger(parsed) || parsed < -840 || parsed > 840) {
		throw new Error('Invalid timezone offset.');
	}

	return parsed;
}

function isValidDayString(value) {
	return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getCurrentLocalDay(timezoneOffsetMinutes) {
	return new Date(Date.now() - timezoneOffsetMinutes * 60 * 1000).toISOString().slice(0, 10);
}

function getUtcRangeForLocalDay(day, timezoneOffsetMinutes) {
	const [year, month, date] = day.split('-').map((part) => Number.parseInt(part, 10));

	return {
		startedAt: new Date(Date.UTC(year, month - 1, date, 0, 0, 0, 0) + timezoneOffsetMinutes * 60 * 1000),
		endedBefore: new Date(
			Date.UTC(year, month - 1, date + 1, 0, 0, 0, 0) + timezoneOffsetMinutes * 60 * 1000
		)
	};
}

module.exports = {
	getCurrentLocalDay,
	getUtcRangeForLocalDay,
	isValidDayString,
	parseTimezoneOffsetMinutes
};
