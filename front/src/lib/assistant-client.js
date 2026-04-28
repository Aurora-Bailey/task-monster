import { browser } from '$app/environment';

import { readApiBody, readApiError } from './api';
import { authorizedRequest } from './session';

export const ASSISTANT_REFRESH_EVENT = 'taskmonster:assistant-refresh';

export async function sendAssistantChat({ messages, timezoneOffsetMinutes, currentPath }) {
	const response = await authorizedRequest('/assistant/chat', {
		method: 'POST',
		body: {
			messages,
			timezoneOffsetMinutes,
			currentPath
		}
	});

	if (!response.ok) {
		throw new Error(await readApiError(response, 'Unable to reach the assistant.'));
	}

	const body = await readApiBody(response);

	return {
		reply: body?.reply ?? '',
		actions: Array.isArray(body?.actions) ? body.actions : [],
		refresh: {
			tasks: body?.refresh?.tasks === true,
			stats: body?.refresh?.stats === true,
			panic: body?.refresh?.panic === true
		}
	};
}

export function dispatchAssistantRefresh(refresh) {
	if (!browser) {
		return;
	}

	window.dispatchEvent(
		new CustomEvent(ASSISTANT_REFRESH_EVENT, {
			detail: {
				refresh: {
					tasks: refresh?.tasks === true,
					stats: refresh?.stats === true,
					panic: refresh?.panic === true
				}
			}
		})
	);
}
