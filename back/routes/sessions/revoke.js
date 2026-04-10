const { ObjectId } = require('mongodb');

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
			const result = await app.mongo.db.collection('sessions').findOneAndUpdate(
				{
					_id: new ObjectId(sessionId),
					userId: new ObjectId(request.auth.userId),
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
