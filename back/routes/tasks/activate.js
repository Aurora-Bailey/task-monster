const { ObjectId } = require('mongodb');

const { openTaskRun } = require('../../lib/task-runs');
const { findOwnedTask, serializedTaskJsonSchema, serializeTask } = require('../../lib/tasks');

const taskParamsSchema = {
	type: 'object',
	required: ['taskId'],
	properties: {
		taskId: { type: 'string' }
	}
};

async function activateTaskRoute(app) {
	app.post(
		'/tasks/:taskId/activate',
		{
			schema: {
				params: taskParamsSchema,
				response: {
					200: {
						type: 'object',
						required: ['task'],
						properties: {
							task: serializedTaskJsonSchema
						}
					}
				}
			}
		},
		async (request, reply) => {
			const { taskId } = request.params;

			if (!ObjectId.isValid(taskId)) {
				return reply.code(400).send({
					message: 'Invalid task id.'
				});
			}

			const task = await findOwnedTask(app.mongo.db, {
				taskId,
				userId: request.auth.userId
			});

			if (!task || task.archived) {
				return reply.code(404).send({
					message: 'Task not found.'
				});
			}

			if (task.activeToday) {
				return reply.code(409).send({
					message: 'Task is already active.'
				});
			}

			const activatedAt = new Date();
			const alarmDueAt =
				task.alarmEnabled && task.durationMinutes
					? new Date(activatedAt.getTime() + task.durationMinutes * 60 * 1000)
					: null;
			const mappedAt = task.mappedAt || activatedAt;

			const result = await app.mongo.db.collection('tasks').findOneAndUpdate(
				{
					_id: task._id,
					userId: task.userId,
					archived: false,
					activeToday: false
				},
				{
					$set: {
						mappedToday: true,
						mappedAt,
						activeToday: true,
						activatedAt,
						alarmDueAt,
						updatedAt: activatedAt
					}
				},
				{
					returnDocument: 'after'
				}
			);

			if (!result) {
				return reply.code(409).send({
					message: 'Task could not be activated.'
				});
			}

			await openTaskRun(app.mongo.db, {
				userId: request.auth.userId,
				taskId,
				startedAt: activatedAt
			});

			return {
				task: serializeTask(result)
			};
		}
	);
}

module.exports = activateTaskRoute;
