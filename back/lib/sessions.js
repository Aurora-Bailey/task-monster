const { ObjectId } = require('mongodb');

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

async function revokeSession(db, { sessionId, userId, revokedAt = new Date() }) {
	return db.collection('sessions').findOneAndUpdate(
		{
			_id: new ObjectId(sessionId),
			userId: new ObjectId(userId),
			revokedAt: null
		},
		{
			$set: {
				revokedAt
			}
		},
		{
			returnDocument: 'after'
		}
	);
}

async function revokeOtherSessions(db, { userId, currentSessionId, revokedAt = new Date() }) {
	return db.collection('sessions').updateMany(
		{
			userId: new ObjectId(userId),
			_id: {
				$ne: new ObjectId(currentSessionId)
			},
			revokedAt: null
		},
		{
			$set: {
				revokedAt
			}
		}
	);
}

module.exports = {
	createSession,
	revokeOtherSessions,
	revokeSession
};
