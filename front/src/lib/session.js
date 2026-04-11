import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { get, writable } from 'svelte/store';

import { readApiBody, readApiError, requestApi } from './api';

export const SESSION_STORAGE_KEY = 'task_monster_session_token';
export const SESSION_COOKIE_NAME = 'task_monster_session_token';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 190;

const initialSessionState = {
	status: 'loading',
	token: null,
	user: null
};

export const session = writable(initialSessionState);

let initializationPromise = null;

function parseCookieValue(name) {
	if (!browser) {
		return null;
	}

	const cookie = document.cookie
		.split(';')
		.map((part) => part.trim())
		.find((part) => part.startsWith(`${name}=`));

	if (!cookie) {
		return null;
	}

	return decodeURIComponent(cookie.slice(name.length + 1));
}

function writeTokenCookie(token) {
	if (!browser) {
		return;
	}

	document.cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}; SameSite=Lax`;
}

function clearTokenCookie() {
	if (!browser) {
		return;
	}

	document.cookie = `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function persistToken(token) {
	if (!browser) {
		return;
	}

	localStorage.setItem(SESSION_STORAGE_KEY, token);
	writeTokenCookie(token);
}

function clearStoredToken() {
	if (!browser) {
		return;
	}

	localStorage.removeItem(SESSION_STORAGE_KEY);
	clearTokenCookie();
}

function readStoredToken() {
	if (!browser) {
		return null;
	}

	const cookieToken = parseCookieValue(SESSION_COOKIE_NAME);

	if (cookieToken) {
		localStorage.setItem(SESSION_STORAGE_KEY, cookieToken);
		return cookieToken;
	}

	const localToken = localStorage.getItem(SESSION_STORAGE_KEY);

	if (localToken) {
		writeTokenCookie(localToken);
		return localToken;
	}

	return null;
}

async function fetchCurrentUser(token) {
	const response = await requestApi('/whoami', {
		token
	});

	if (response.status === 403) {
		return null;
	}

	if (!response.ok) {
		throw new Error(await readApiError(response, 'Unable to verify the current session.'));
	}

	return readApiBody(response);
}

function setGuestSession() {
	session.set({
		status: 'guest',
		token: null,
		user: null
	});
}

function setAuthenticatedSession(token, user) {
	session.set({
		status: 'authenticated',
		token,
		user
	});
}

async function clearClientSession({ redirectToAuth = true } = {}) {
	clearStoredToken();
	setGuestSession();

	if (browser && redirectToAuth) {
		await goto('/auth', {
			replaceState: true
		});
	}
}

export async function initializeSession({ force = false } = {}) {
	if (!browser) {
		return null;
	}

	if (!force && initializationPromise) {
		return initializationPromise;
	}

	if (!force && get(session).status === 'authenticated') {
		return get(session).user;
	}

	initializationPromise = (async () => {
		const token = readStoredToken();

		if (!token) {
			setGuestSession();
			return null;
		}

		session.set({
			status: 'checking',
			token,
			user: null
		});

		try {
			const user = await fetchCurrentUser(token);

			if (!user) {
				await clearClientSession({
					redirectToAuth: false
				});
				return null;
			}

			persistToken(token);
			setAuthenticatedSession(token, user);
			return user;
		} catch (error) {
			console.error(error);
			await clearClientSession({
				redirectToAuth: false
			});
			return null;
		}
	})().finally(() => {
		initializationPromise = null;
	});

	return initializationPromise;
}

export async function loginAccount({ username, password }) {
	const response = await requestApi('/sessions/login', {
		method: 'POST',
		body: {
			username,
			password
		}
	});

	if (!response.ok) {
		throw new Error(await readApiError(response, 'Unable to log in.'));
	}

	const body = await readApiBody(response);

	persistToken(body.token);
	setAuthenticatedSession(body.token, body.user);

	return body.user;
}

export async function createAccount({ username, password, alphaCode }) {
	const createResponse = await requestApi('/users', {
		method: 'POST',
		body: {
			username,
			password,
			alphaCode
		}
	});

	if (!createResponse.ok) {
		throw new Error(await readApiError(createResponse, 'Unable to create the account.'));
	}

	return loginAccount({ username, password });
}

export async function logoutAccount() {
	const current = get(session);
	const token = current.token || readStoredToken();

	if (token) {
		const response = await requestApi('/sessions/logout', {
			method: 'POST',
			token
		});

		if (!response.ok && response.status !== 403) {
			throw new Error(await readApiError(response, 'Unable to log out.'));
		}
	}

	await clearClientSession();
}

export async function revokeSession(sessionId) {
	const response = await authorizedRequest(`/sessions/${sessionId}`, {
		method: 'DELETE'
	});

	if (!response.ok) {
		throw new Error(await readApiError(response, 'Unable to revoke the session.'));
	}

	const body = await readApiBody(response);

	if (body?.revokedCurrentSession) {
		await clearClientSession();
	}

	return body;
}

export async function authorizedRequest(path, options = {}) {
	const current = get(session);
	const token = current.token || readStoredToken();

	const response = await requestApi(path, {
		...options,
		token
	});

	if (response.status === 403) {
		await clearClientSession();
	}

	return response;
}
