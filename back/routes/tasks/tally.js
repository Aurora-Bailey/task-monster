const { ObjectId } = require('mongodb');

const { updateOpenTaskRunTally } = require('../../lib/task-runs');
const { findOwnedTask, serializedTaskJsonSchema, serializeTask } = require('../../lib/tasks');

const taskParamsSchema = {
	type: 'object',
	required: ['taskId'],
	properties: {
		taskId: { type: 'string' }
	}
};

const tallyBodySchema = {
	type: 'object',
	required: ['delta'],
	additionalProperties: false,
	properties: {
		delta: {
			type: 'integer',
			minimum: -1000,
			maximum: 1000
		}
	}
};

async function updateTaskTallyRoute(app) {
	app.post(
		'/tasks/:taskId/tally',
		{
			schema: {
				params: taskParamsSchema,
				body: tallyBodySchema,
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

			if (!task.activeToday || task.trackingType !== 'tally') {
				return reply.code(409).send({
					message: 'Task tally cannot be updated.'
				});
			}

			const delta = request.body.delta;
			const currentCount = Number.isInteger(task.activeTallyCount) ? task.activeTallyCount : 0;
			const nextCount = Math.max(0, currentCount + delta);
			const updatedAt = new Date();

			const result = await app.mongo.db.collection('tasks').findOneAndUpdate(
				{
					_id: task._id,
					userId: task.userId,
					archived: false,
					activeToday: true,
					trackingType: 'tally'
				},
				{
					$set: {
						activeTallyCount: nextCount,
						updatedAt
					}
				},
				{
					returnDocument: 'after'
				}
			);

			if (!result) {
				return reply.code(409).send({
					message: 'Task tally could not be updated.'
				});
			}

			await updateOpenTaskRunTally(app.mongo.db, {
				userId: request.auth.userId,
				taskId,
				tallyCount: nextCount,
				updatedAt
			});

			return {
				task: serializeTask(result)
			};
		}
	);
}

module.exports = updateTaskTallyRoute;
