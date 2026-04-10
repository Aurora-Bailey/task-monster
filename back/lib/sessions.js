const { createAuthToken, hashAuthToken } = require('./tokens');

async function createSession(db, { userId, username, ipAddress, userAgent }) {
	const token = createAuthToken();
	const tokenHash = hashAuthToken(token);
	const createdAt = new Date();

	const result = await db.collection('sessions').insertOne({
		userId,
		username,
		tokenHash,
		tokenPreview: token.slice(-8),
		createdAt,
		lastUsedAt: createdAt,
		lastUsedIp: ipAddress,
		userAgent: userAgent || null,
		revokedAt: null
	});

	return {
		token,
		session: {
			id: result.insertedId.toString(),
			createdAt: createdAt.toISOString(),
			lastUsedAt: createdAt.toISOString(),
			tokenPreview: token.slice(-8)
		}
	};
}

module.exports = {
	createSession
};
