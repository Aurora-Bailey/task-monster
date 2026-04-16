import { readApiBody, readApiError } from './api';
import { authorizedRequest } from './session';

export async function loadDailyStats({ day, tzOffsetMinutes } = {}) {
	const params = new URLSearchParams();

	if (day) {
		params.set('day', day);
	}

	if (tzOffsetMinutes !== undefined && tzOffsetMinutes !== null) {
		params.set('tzOffsetMinutes', String(tzOffsetMinutes));
	}

	const queryString = params.toString();
	const query = queryString ? `?${queryString}` : '';
	const response = await authorizedRequest(`/stats/daily${query}`);

	if (!response.ok) {
		throw new Error(await readApiError(response, 'Unable to load stats.'));
	}

	const body = await readApiBody(response);

	return {
		selectedDay: body?.selectedDay ?? null,
		summary: body?.summary ?? null,
		overlapBands: body?.overlapBands ?? [],
		breakdown: body?.breakdown ?? [],
		cadence: body?.cadence ?? [],
		panicLog: body?.panicLog ?? [],
		doneLog: body?.doneLog ?? [],
		sessionLog: body?.sessionLog ?? []
	};
}
