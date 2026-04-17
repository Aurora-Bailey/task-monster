import { browser } from '$app/environment';

import { readApiBody, readApiError } from './api';
import { authorizedRequest } from './session';

export const PANIC_UPDATED_EVENT = 'taskmonster:panic-updated';

export function getCurrentLocalDay() {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const date = String(now.getDate()).padStart(2, '0');

	return `${year}-${month}-${date}`;
}

export function getCurrentTimezoneOffsetMinutes() {
	return new Date().getTimezoneOffset();
}

function buildPanicPayload() {
	return {
		day: getCurrentLocalDay(),
		tzOffsetMinutes: getCurrentTimezoneOffsetMinutes()
	};
}

export async function loadPanicStatus() {
	const params = new URLSearchParams();
	const payload = buildPanicPayload();
	params.set('day', payload.day);
	params.set('tzOffsetMinutes', String(payload.tzOffsetMinutes));

	const response = await authorizedRequest(`/panic/status?${params.toString()}`);

	if (!response.ok) {
		throw new Error(await readApiError(response, 'Unable to load panic status.'));
	}

	const body = await readApiBody(response);
	return body?.panic ?? null;
}

export async function startPanic() {
	const response = await authorizedRequest('/panic/start', {
		method: 'POST',
		body: buildPanicPayload()
	});

	if (!response.ok) {
		throw new Error(await readApiError(response, 'Unable to start panic mode.'));
	}

	const body = await readApiBody(response);

	return {
		panic: body?.panic ?? null,
		pausedTaskCount: body?.pausedTaskCount ?? 0
	};
}

export async function stopPanic({ note = '', emotionalCharge = null } = {}) {
	const response = await authorizedRequest('/panic/stop', {
		method: 'POST',
		body: {
			...buildPanicPayload(),
			note,
			...(Number.isInteger(emotionalCharge) ? { emotionalCharge } : {})
		}
	});

	if (!response.ok) {
		throw new Error(await readApiError(response, 'Unable to stop panic mode.'));
	}

	const body = await readApiBody(response);
	return body?.panic ?? null;
}

export function dispatchPanicUpdated(panic) {
	if (!browser) {
		return;
	}

	window.dispatchEvent(
		new CustomEvent(PANIC_UPDATED_EVENT, {
			detail: panic
		})
	);
}
