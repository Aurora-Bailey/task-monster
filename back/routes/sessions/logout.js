const { revokeSession } = require('../../lib/sessions');

async function logoutRoute(app) {
	app.post(
		'/sessions/logout',
		{
			schema: {
				response: {
					200: {
						type: 'object',
						required: ['revokedSessionId', 'revokedAt'],
						properties: {
							revokedSessionId: { type: 'string' },
							revokedAt: { type: 'string' }
						}
					}
				}
			}
		},
		async (request, reply) => {
			const revokedAt = new Date();
			const result = await revokeSession(app.mongo.db, {
				sessionId: request.auth.sessionId,
				userId: request.auth.userId,
				revokedAt
			});

			if (!result) {
				return reply.code(404).send({
					message: 'Session not found.'
				});
			}

			return {
				revokedSessionId: request.auth.sessionId,
				revokedAt: revokedAt.toISOString()
			};
		}
	);
}

module.exports = logoutRoute;
