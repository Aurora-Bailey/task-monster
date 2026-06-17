const { requireQuickToken } = require('../../../lib/quick-tokens');
const { runQuickNext } = require('../../../lib/quick-actions');

async function quickNextRoute(app) {
	app.post(
		'/api/quick/next',
		{
			config: {
				isPublic: true
			},
			preHandler: requireQuickToken(['tasks:next']),
			schema: {
				response: {
					200: {
						type: 'object',
						required: [
							'ok',
							'action',
							'message',
							'previousTaskRunId',
							'nextTaskId',
							'nextTaskTitle',
							'at'
						],
						properties: {
							ok: { type: 'boolean' },
							action: { type: 'string' },
							message: { type: 'string' },
							previousTaskRunId: { type: ['string', 'null'] },
							nextTaskId: { type: ['string', 'null'] },
							nextTaskTitle: { type: ['string', 'null'] },
							at: { type: 'string' }
						}
					}
				}
			}
		},
		async (request) => {
			const at = new Date();
			const result = await runQuickNext(app.mongo.db, {
				userId: request.quick.userId,
				at
			});
			const message = result.nextTaskTitle
				? `Next Task: ${result.nextTaskTitle}`
				: 'No next task queued';

			return {
				ok: true,
				action: 'next',
				message,
				previousTaskRunId: result.previousTaskRunId,
				nextTaskId: result.nextTaskId,
				nextTaskTitle: result.nextTaskTitle,
				at: at.toISOString()
			};
		}
	);
}

module.exports = quickNextRoute;
