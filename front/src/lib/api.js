export const API_BASE_URL = import.meta.env.PUBLIC_API_BASE_URL || 'http://127.0.0.1:3001';

export async function requestApi(path, { method = 'GET', body, headers = {}, token } = {}) {
	const requestHeaders = new Headers(headers);

	if (body !== undefined && !requestHeaders.has('content-type')) {
		requestHeaders.set('content-type', 'application/json');
	}

	if (token) {
		requestHeaders.set('authorization', `Bearer ${token}`);
	}

	const response = await fetch(`${API_BASE_URL}${path}`, {
		method,
		headers: requestHeaders,
		body: body !== undefined ? JSON.stringify(body) : undefined
	});

	return response;
}

export async function readApiBody(response) {
	const contentType = response.headers.get('content-type') || '';

	if (!contentType.includes('application/json')) {
		return null;
	}

	return response.json();
}

export async function readApiError(response, fallbackMessage) {
	const body = await readApiBody(response);

	return body?.message || fallbackMessage;
}
