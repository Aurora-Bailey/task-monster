const { ObjectId } = require('mongodb');

const { requireQuickToken } = require('../../../lib/quick-tokens');
const { runQuickStart } = require('../../../lib/quick-actions');

async function quickStartRoute(app) {
	app.post(
		'/api/quick/start',
		{
			config: {
				isPublic: true
			},
			preHandler: requireQuickToken(['tasks:start']),
			schema: {
				body: {
					type: 'object',
					additionalProperties: false,
					required: ['taskId'],
					properties: {
						source: { type: 'string' },
						action: { type: 'string' },
						taskId: { type: 'string' }
					}
				},
				response: {
					200: {
						type: 'object',
						required: [
							'ok',
							'action',
							'message',
							'previousTaskRunId',
							'stoppedCount',
							'taskId',
							'taskTitle',
							'at'
						],
						properties: {
							ok: { type: 'boolean' },
							action: { type: 'string' },
							message: { type: 'string' },
							previousTaskRunId: { type: ['string', 'null'] },
							stoppedCount: { type: 'integer' },
							taskId: { type: 'string' },
							taskTitle: { type: 'string' },
							at: { type: 'string' }
						}
					}
				}
			}
		},
		async (request, reply) => {
			const { taskId } = request.body;

			if (!ObjectId.isValid(taskId)) {
				return reply.code(400).send({
					ok: false,
					error: 'invalid_task_id',
					message: 'Invalid task id'
				});
			}

			const at = new Date();
			const result = await runQuickStart(app.mongo.db, {
				userId: request.quick.userId,
				taskId,
				quickTokenId: request.quick.tokenId,
				at
			});

			if (!result) {
				return reply.code(404).send({
					ok: false,
					error: 'task_not_found',
					message: 'Task not found'
				});
			}

			return {
				ok: true,
				action: 'start',
				message: `${result.taskTitle} active`,
				previousTaskRunId: result.previousTaskRunId,
				stoppedCount: result.stoppedCount,
				taskId: result.taskId,
				taskTitle: result.taskTitle,
				at: at.toISOString()
			};
		}
	);
}

module.exports = quickStartRoute;
