const { requireQuickToken } = require('../../../lib/quick-tokens');
const { runQuickStop } = require('../../../lib/quick-actions');

async function quickStopRoute(app) {
	app.post(
		'/api/quick/stop',
		{
			config: {
				isPublic: true
			},
			preHandler: requireQuickToken(['tasks:stop']),
			schema: {
				response: {
					200: {
						type: 'object',
						required: ['ok', 'action', 'message', 'stoppedCount', 'at'],
						properties: {
							ok: { type: 'boolean' },
							action: { type: 'string' },
							message: { type: 'string' },
							stoppedCount: { type: 'integer' },
							at: { type: 'string' }
						}
					}
				}
			}
		},
		async (request) => {
			const at = new Date();
			const result = await runQuickStop(app.mongo.db, {
				userId: request.quick.userId,
				quickTokenId: request.quick.tokenId,
				at
			});

			return {
				ok: true,
				action: 'stop',
				message: 'All tasks started by this token marked done',
				stoppedCount: result.stoppedCount,
				at: at.toISOString()
			};
		}
	);
}

module.exports = quickStopRoute;
