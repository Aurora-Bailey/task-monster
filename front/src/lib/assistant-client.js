import { browser } from '$app/environment';

import { readApiBody, readApiError } from './api';
import { authorizedRequest } from './session';

export const ASSISTANT_REFRESH_EVENT = 'taskmonster:assistant-refresh';

export async function loadAssistantHistory({ limit = 12 } = {}) {
	const response = await authorizedRequest(`/assistant/history?limit=${encodeURIComponent(limit)}`);

	if (!response.ok) {
		throw new Error(await readApiError(response, 'Unable to load assistant history.'));
	}

	const body = await readApiBody(response);

	return Array.isArray(body?.messages)
		? body.messages.map((message) => ({
				id: typeof message?.id === 'string' ? message.id : null,
				role: message?.role === 'assistant' ? 'assistant' : 'user',
				content: typeof message?.content === 'string' ? message.content : '',
				actions: Array.isArray(message?.actions) ? message.actions : [],
				createdAt: typeof message?.createdAt === 'string' ? message.createdAt : null
			}))
		: [];
}

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
