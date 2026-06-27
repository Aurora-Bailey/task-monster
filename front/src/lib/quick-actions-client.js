import { API_BASE_URL, readApiBody, readApiError } from './api';
import { authorizedRequest } from './session';

export const QUICK_ACTIONS_DOCS_API_BASE_URL =
	API_BASE_URL.includes('127.0.0.1') || API_BASE_URL.includes('localhost')
		? 'https://taskmonster-api.aurora-bailey.dev'
		: API_BASE_URL.replace(/\/$/, '');

function normalizeQuickToken(token) {
	return {
		id: typeof token?.id === 'string' ? token.id : '',
		label: typeof token?.label === 'string' ? token.label : 'iPhone + Watch',
		scopes: Array.isArray(token?.scopes) ? token.scopes : [],
		tokenPreview: typeof token?.tokenPreview === 'string' ? token.tokenPreview : '',
		createdAt: typeof token?.createdAt === 'string' ? token.createdAt : null,
		lastUsedAt: typeof token?.lastUsedAt === 'string' ? token.lastUsedAt : null
	};
}

export async function loadQuickTokens() {
	const response = await authorizedRequest('/quick-tokens');

	if (!response.ok) {
		throw new Error(await readApiError(response, 'Unable to load shortcut tokens.'));
	}

	const body = await readApiBody(response);

	return Array.isArray(body?.tokens) ? body.tokens.map(normalizeQuickToken) : [];
}

export async function createQuickToken({ label }) {
	const response = await authorizedRequest('/quick-tokens', {
		method: 'POST',
		body: {
			label
		}
	});

	if (!response.ok) {
		throw new Error(await readApiError(response, 'Unable to create a shortcut token.'));
	}

	const body = await readApiBody(response);

	return {
		rawToken: typeof body?.rawToken === 'string' ? body.rawToken : '',
		token: normalizeQuickToken(body?.token)
	};
}

export async function revokeQuickToken(tokenId) {
	const response = await authorizedRequest(`/quick-tokens/${tokenId}`, {
		method: 'DELETE'
	});

	if (!response.ok) {
		throw new Error(await readApiError(response, 'Unable to revoke the shortcut token.'));
	}

	return readApiBody(response);
}
