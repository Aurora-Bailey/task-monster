const { ObjectId } = require('mongodb');

async function listSessionsRoute(app) {
	app.get(
		'/sessions',
		{
			schema: {
				response: {
					200: {
						type: 'object',
						required: ['sessions'],
						properties: {
							sessions: {
								type: 'array',
								items: {
									type: 'object',
									required: [
										'id',
										'username',
										'createdAt',
										'lastUsedAt',
										'tokenPreview',
										'isCurrent'
									],
									properties: {
										id: { type: 'string' },
										username: { type: 'string' },
										createdAt: { type: 'string' },
										lastUsedAt: { type: 'string' },
										lastUsedIp: { type: ['string', 'null'] },
										userAgent: { type: ['string', 'null'] },
										tokenPreview: { type: 'string' },
										isCurrent: { type: 'boolean' }
									}
								}
							}
						}
					}
				}
			}
		},
		async (request) => {
			const sessions = await app.mongo.db
				.collection('sessions')
				.find({
					userId: new ObjectId(request.auth.userId)
				})
				.toArray();

			return {
				sessions: sessions
					.filter((session) => session.revokedAt === null)
					.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
					.map((session) => ({
						id: session._id.toString(),
						username: session.username,
						createdAt: session.createdAt.toISOString(),
						lastUsedAt: session.lastUsedAt.toISOString(),
						lastUsedIp: session.lastUsedIp ?? null,
						userAgent: session.userAgent ?? null,
						tokenPreview: session.tokenPreview,
						isCurrent: session._id.toString() === request.auth.sessionId
					}))
			};
		}
	);
}

module.exports = listSessionsRoute;
