const { hashAuthToken, parseBearerToken } = require('./tokens');

async function authenticateRequest(app, request, reply) {
	if (request.routeOptions.config?.isPublic === true) {
		return;
	}

	const token = parseBearerToken(request.headers.authorization);

	if (!token) {
		return reply.code(403).send({
			message: 'Forbidden'
		});
	}

	const tokenHash = hashAuthToken(token);
	const session = await app.mongo.db.collection('sessions').findOne({
		tokenHash,
		revokedAt: null
	});

	if (!session) {
		return reply.code(403).send({
			message: 'Forbidden'
		});
	}

	request.auth = {
		sessionId: session._id.toString(),
		userId: session.userId.toString(),
		username: session.username
	};

	await app.mongo.db.collection('sessions').updateOne(
		{ _id: session._id },
		{
			$set: {
				lastUsedAt: new Date(),
				lastUsedIp: request.ip,
				userAgent: request.headers['user-agent'] || null
			}
		}
	);
}

module.exports = {
	authenticateRequest
};
