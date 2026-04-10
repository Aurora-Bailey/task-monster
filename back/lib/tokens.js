const { createHash, randomBytes } = require('node:crypto');

function createAuthToken() {
	return randomBytes(32).toString('hex');
}

function hashAuthToken(token) {
	return createHash('sha256').update(token).digest('hex');
}

function parseBearerToken(authorizationHeader) {
	if (typeof authorizationHeader !== 'string') {
		return null;
	}

	const [scheme, token, ...extra] = authorizationHeader.trim().split(/\s+/);

	if (scheme !== 'Bearer' || !token || extra.length > 0) {
		return null;
	}

	return token;
}

module.exports = {
	createAuthToken,
	hashAuthToken,
	parseBearerToken
};
