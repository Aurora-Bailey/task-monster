const { ObjectId } = require('mongodb');

const { runQuickAddTask } = require('../../../lib/quick-actions');
const { requireQuickToken } = require('../../../lib/quick-tokens');

async function quickAddTaskRoute(app) {
	app.post(
		'/api/quick/add-task',
		{
			config: {
				isPublic: true
			},
			preHandler: requireQuickToken(['tasks:start']),
			schema: {
				body: {
					type: 'object',
					additionalProperties: false,
					properties: {
						source: { type: 'string' },
						action: { type: 'string' },
						taskId: {}
					}
				},
				response: {
					200: {
						type: 'object',
						required: ['ok', 'action', 'message', 'taskId', 'taskTitle', 'at'],
						properties: {
							ok: { type: 'boolean' },
							action: { type: 'string' },
							message: { type: 'string' },
							taskId: { type: 'string' },
							taskTitle: { type: 'string' },
							at: { type: 'string' }
						}
					}
				}
			}
		},
		async (request, reply) => {
			const taskId = request.body?.taskId;

			if (typeof taskId !== 'string' || !ObjectId.isValid(taskId)) {
				return reply.code(400).send({
					ok: false,
					error: 'invalid_task_id',
					message: 'Invalid task id'
				});
			}

			const at = new Date();
			const result = await runQuickAddTask(app.mongo.db, {
				userId: request.quick.userId,
				taskId,
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
				action: 'add-task',
				message: `${result.taskTitle} active`,
				taskId: result.taskId,
				taskTitle: result.taskTitle,
				at: at.toISOString()
			};
		}
	);
}

module.exports = quickAddTaskRoute;
