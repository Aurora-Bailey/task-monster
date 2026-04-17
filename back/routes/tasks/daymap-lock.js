const { ObjectId } = require('mongodb');

const { findOwnedTask, serializedTaskJsonSchema, serializeTask } = require('../../lib/tasks');

const taskParamsSchema = {
	type: 'object',
	required: ['taskId'],
	properties: {
		taskId: { type: 'string' }
	}
};

async function updateTaskDaymapLockRoute(app) {
	app.patch(
		'/tasks/:taskId/daymap-lock',
		{
			schema: {
				params: taskParamsSchema,
				body: {
					type: 'object',
					required: ['daymapLocked'],
					additionalProperties: false,
					properties: {
						daymapLocked: {
							type: 'boolean'
						}
					}
				},
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

			const updatedAt = new Date();
			const result = await app.mongo.db.collection('tasks').findOneAndUpdate(
				{
					_id: task._id,
					userId: task.userId,
					archived: false
				},
				{
					$set: {
						daymapLocked: request.body.daymapLocked,
						updatedAt
					}
				},
				{
					returnDocument: 'after'
				}
			);

			if (!result) {
				return reply.code(409).send({
					message: 'Task lock could not be updated.'
				});
			}

			return {
				task: serializeTask(result)
			};
		}
	);
}

module.exports = updateTaskDaymapLockRoute;
