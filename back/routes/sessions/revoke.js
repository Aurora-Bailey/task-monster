const { ObjectId } = require('mongodb');

const { revokeSession } = require('../../lib/sessions');

async function revokeSessionRoute(app) {
	app.delete(
		'/sessions/:sessionId',
		{
			schema: {
				params: {
					type: 'object',
					required: ['sessionId'],
					properties: {
						sessionId: { type: 'string' }
					}
				},
				response: {
					200: {
						type: 'object',
						required: ['revokedSessionId', 'revokedAt', 'revokedCurrentSession'],
						properties: {
							revokedSessionId: { type: 'string' },
							revokedAt: { type: 'string' },
							revokedCurrentSession: { type: 'boolean' }
						}
					}
				}
			}
		},
		async (request, reply) => {
			const { sessionId } = request.params;

			if (!ObjectId.isValid(sessionId)) {
				return reply.code(400).send({
					message: 'Invalid session id.'
				});
			}

			const revokedAt = new Date();
			const result = await revokeSession(app.mongo.db, {
				sessionId,
				userId: request.auth.userId,
				revokedAt
			});

			if (!result) {
				return reply.code(404).send({
					message: 'Session not found.'
				});
			}

			return {
				revokedSessionId: sessionId,
				revokedAt: revokedAt.toISOString(),
				revokedCurrentSession: sessionId === request.auth.sessionId
			};
		}
	);
}

module.exports = revokeSessionRoute;
