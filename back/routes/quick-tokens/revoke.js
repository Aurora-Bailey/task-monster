const { ObjectId } = require('mongodb');

const { revokeQuickToken } = require('../../lib/quick-tokens');

async function revokeQuickTokenRoute(app) {
	app.delete(
		'/quick-tokens/:tokenId',
		{
			schema: {
				params: {
					type: 'object',
					required: ['tokenId'],
					properties: {
						tokenId: { type: 'string' }
					}
				},
				response: {
					200: {
						type: 'object',
						required: ['revokedTokenId', 'revokedAt'],
						properties: {
							revokedTokenId: { type: 'string' },
							revokedAt: { type: 'string' }
						}
					}
				}
			}
		},
		async (request, reply) => {
			const { tokenId } = request.params;

			if (!ObjectId.isValid(tokenId)) {
				return reply.code(400).send({
					message: 'Invalid token id.'
				});
			}

			const revokedAt = new Date();
			const revokedToken = await revokeQuickToken(app.mongo.db, {
				userId: request.auth.userId,
				tokenId,
				revokedAt
			});

			if (!revokedToken) {
				return reply.code(404).send({
					message: 'Token not found.'
				});
			}

			return {
				revokedTokenId: tokenId,
				revokedAt: revokedAt.toISOString()
			};
		}
	);
}

module.exports = revokeQuickTokenRoute;
