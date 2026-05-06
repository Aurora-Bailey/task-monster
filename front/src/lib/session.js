import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { get, writable } from 'svelte/store';

import { readApiBody, readApiError, requestApi } from './api';
import { applyTheme, cacheTheme, normalizeTheme } from './theme';

export const SESSION_STORAGE_KEY = 'task_monster_session_token';
export const SESSION_ACCOUNTS_STORAGE_KEY = 'task_monster_session_accounts';
export const SESSION_COOKIE_NAME = 'task_monster_session_token';
export const SESSION_ACCOUNT_COOKIE_PREFIX = 'task_monster_session_token_';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 190;

const initialSessionState = {
	status: 'loading',
	token: null,
	user: null
};

export const session = writable(initialSessionState);
export const accountSessions = writable(browser ? readStoredAccounts() : []);

let initializationPromise = null;

function normalizeSessionUser(user) {
	const username = typeof user?.username === 'string' ? user.username : '';

	if (!username) {
		return null;
	}

	return {
		id: typeof user?.id === 'string' ? user.id : '',
		username,
		theme: normalizeTheme(user?.theme)
	};
}

function getUserStorageKey(user) {
	return user?.id || user?.username?.toLowerCase() || '';
}

function normalizeStoredAccount(account) {
	const token = typeof account?.token === 'string' ? account.token : '';
	const user = normalizeSessionUser(account?.user);

	if (!token || !user) {
		return null;
	}

	return {
		token,
		user,
		addedAt: typeof account?.addedAt === 'string' ? account.addedAt : new Date().toISOString(),
		lastSelectedAt:
			typeof account?.lastSelectedAt === 'string'
				? account.lastSelectedAt
				: new Date().toISOString()
	};
}

function readStoredAccounts() {
	if (!browser) {
		return [];
	}

	try {
		const parsed = JSON.parse(localStorage.getItem(SESSION_ACCOUNTS_STORAGE_KEY) || '[]');

		if (!Array.isArray(parsed)) {
			return [];
		}

		return parsed.map(normalizeStoredAccount).filter(Boolean);
	} catch {
		return [];
	}
}

function writeStoredAccounts(accounts) {
	if (!browser) {
		return;
	}

	const normalizedAccounts = accounts.map(normalizeStoredAccount).filter(Boolean);

	if (normalizedAccounts.length === 0) {
		localStorage.removeItem(SESSION_ACCOUNTS_STORAGE_KEY);
	} else {
		localStorage.setItem(SESSION_ACCOUNTS_STORAGE_KEY, JSON.stringify(normalizedAccounts));
	}

	accountSessions.set(normalizedAccounts);
}

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

function writeCookie(name, value) {
	if (!browser) {
		return;
	}

	document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}; SameSite=Lax`;
}

function clearCookie(name) {
	if (!browser) {
		return;
	}

	document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function getAccountCookieName(user) {
	const key = getUserStorageKey(user).replace(/[^a-zA-Z0-9_-]/g, '_');

	return `${SESSION_ACCOUNT_COOKIE_PREFIX}${key || 'unknown'}`;
}

function persistActiveToken(token) {
	if (!browser) {
		return;
	}

	localStorage.setItem(SESSION_STORAGE_KEY, token);
	writeCookie(SESSION_COOKIE_NAME, token);
}

function clearActiveToken() {
	if (!browser) {
		return;
	}

	localStorage.removeItem(SESSION_STORAGE_KEY);
	clearCookie(SESSION_COOKIE_NAME);
}

function persistAccountSession(token, user) {
	if (!browser) {
		return;
	}

	const normalizedUser = normalizeSessionUser(user);

	if (!token || !normalizedUser) {
		return;
	}

	const now = new Date().toISOString();
	const userKey = getUserStorageKey(normalizedUser);
	const existingAccounts = readStoredAccounts();
	const existingAccount = existingAccounts.find(
		(account) => getUserStorageKey(account.user) === userKey
	);
	const nextAccount = {
		token,
		user: normalizedUser,
		addedAt: existingAccount?.addedAt ?? now,
		lastSelectedAt: now
	};
	const nextAccounts = [
		nextAccount,
		...existingAccounts.filter(
			(account) => account.token !== token && getUserStorageKey(account.user) !== userKey
		)
	];

	writeStoredAccounts(nextAccounts);
	writeCookie(getAccountCookieName(normalizedUser), token);
	cacheTheme(normalizedUser.theme);
}

function removeStoredAccountToken(token) {
	if (!browser || !token) {
		return;
	}

	const accounts = readStoredAccounts();
	const account = accounts.find((item) => item.token === token);
	const nextAccounts = accounts.filter((item) => item.token !== token);

	writeStoredAccounts(nextAccounts);

	if (account?.user) {
		clearCookie(getAccountCookieName(account.user));
	}

	if (localStorage.getItem(SESSION_STORAGE_KEY) === token) {
		clearActiveToken();
	}
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
		writeCookie(SESSION_COOKIE_NAME, localToken);
		return localToken;
	}

	return readStoredAccounts()[0]?.token ?? null;
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
	const normalizedUser = normalizeSessionUser(user);

	session.set({
		status: 'authenticated',
		token,
		user: normalizedUser
	});
}

async function clearClientSession({ redirectToAuth = true } = {}) {
	clearActiveToken();
	setGuestSession();

	if (browser && redirectToAuth) {
		await goto(resolve('/auth'), {
			replaceState: true
		});
	}
}

async function useVerifiedToken(token) {
	const user = await fetchCurrentUser(token);

	if (!user) {
		removeStoredAccountToken(token);
		return null;
	}

	persistActiveToken(token);
	persistAccountSession(token, user);
	applyTheme(user.theme, { cache: true });
	setAuthenticatedSession(token, user);

	return normalizeSessionUser(user);
}

async function activateFallbackAccount({ excludedToken = null, redirectToAuth = true } = {}) {
	const candidates = readStoredAccounts().filter((account) => account.token !== excludedToken);

	for (const account of candidates) {
		try {
			const user = await useVerifiedToken(account.token);

			if (user) {
				return user;
			}
		} catch (error) {
			console.error(error);
		}
	}

	await clearClientSession({ redirectToAuth });
	return null;
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
		accountSessions.set(readStoredAccounts());
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
			const user = await useVerifiedToken(token);

			if (!user) {
				const fallbackUser = await activateFallbackAccount({
					excludedToken: token,
					redirectToAuth: false
				});
				return fallbackUser;
			}

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

	persistActiveToken(body.token);
	persistAccountSession(body.token, body.user);
	applyTheme(body.user?.theme, { cache: true });
	setAuthenticatedSession(body.token, body.user);

	return body.user;
}

export async function createAccount({ username, password, alphaCode, acceptedLegalTerms }) {
	const createResponse = await requestApi('/users', {
		method: 'POST',
		body: {
			username,
			password,
			alphaCode,
			acceptedLegalTerms
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

	removeStoredAccountToken(token);

	const fallbackUser = await activateFallbackAccount({
		excludedToken: token,
		redirectToAuth: false
	});

	if (fallbackUser) {
		await goto(resolve('/active'), {
			replaceState: true
		});
		return;
	}

	await clearClientSession();
}

export async function revokeSession(sessionId) {
	const current = get(session);
	const response = await authorizedRequest(`/sessions/${sessionId}`, {
		method: 'DELETE'
	});

	if (!response.ok) {
		throw new Error(await readApiError(response, 'Unable to revoke the session.'));
	}

	const body = await readApiBody(response);

	if (body?.revokedCurrentSession) {
		const token = current.token || readStoredToken();

		removeStoredAccountToken(token);

		const fallbackUser = await activateFallbackAccount({
			excludedToken: token,
			redirectToAuth: false
		});

		if (!fallbackUser) {
			await clearClientSession();
		}
	}

	return body;
}

export async function switchAccount(token) {
	if (!browser) {
		return null;
	}

	const account = readStoredAccounts().find((item) => item.token === token);
	const previousSession = get(session);
	const previousTheme = previousSession.user?.theme;

	if (!account) {
		throw new Error('That account is not stored on this device.');
	}

	applyTheme(account.user.theme, { cache: true });
	session.set({
		status: 'checking',
		token,
		user: account.user
	});

	try {
		const user = await useVerifiedToken(token);

		if (!user) {
			throw new Error('That account session has expired.');
		}

		return user;
	} catch (error) {
		applyTheme(previousTheme, { cache: true });
		session.set(previousSession);
		throw error;
	}
}

export async function saveCurrentUserTheme(themeId) {
	const normalizedTheme = normalizeTheme(themeId);
	const current = get(session);
	const token = current.token || readStoredToken();
	const response = await authorizedRequest('/users/theme', {
		method: 'PATCH',
		body: {
			theme: normalizedTheme
		}
	});

	if (!response.ok) {
		throw new Error(await readApiError(response, 'Unable to save the theme.'));
	}

	const body = await readApiBody(response);
	const user = normalizeSessionUser(body?.user ?? { ...current.user, theme: normalizedTheme });

	if (!user || !token) {
		throw new Error('Unable to save the theme.');
	}

	applyTheme(user.theme, { cache: true });
	setAuthenticatedSession(token, user);
	persistAccountSession(token, user);

	return user.theme;
}

export async function authorizedRequest(path, options = {}) {
	const current = get(session);
	const token = current.token || readStoredToken();

	const response = await requestApi(path, {
		...options,
		token
	});

	if (response.status === 403) {
		removeStoredAccountToken(token);
		await activateFallbackAccount({
			excludedToken: token
		});
	}

	return response;
}
