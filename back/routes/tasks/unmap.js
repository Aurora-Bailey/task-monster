const { ObjectId } = require('mongodb');

const { findOwnedTask, serializedTaskJsonSchema, serializeTask } = require('../../lib/tasks');

const taskParamsSchema = {
	type: 'object',
	required: ['taskId'],
	properties: {
		taskId: { type: 'string' }
	}
};

async function unmapTaskRoute(app) {
	app.post(
		'/tasks/:taskId/unmap',
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
					message: 'Active tasks must leave the table before they can be removed from the day map.'
				});
			}

			if (task.mappedToday !== true) {
				return reply.code(409).send({
					message: 'Task is already back in the inactive pool.'
				});
			}

			const updatedAt = new Date();
			const result = await app.mongo.db.collection('tasks').findOneAndUpdate(
				{
					_id: task._id,
					userId: task.userId,
					archived: false,
					activeToday: false,
					mappedToday: true
				},
				{
					$set: {
						mappedToday: false,
						mappedAt: null,
						updatedAt
					}
				},
				{
					returnDocument: 'after'
				}
			);

			if (!result) {
				return reply.code(409).send({
					message: 'Task could not be moved back to inactive.'
				});
			}

			return {
				task: serializeTask(result)
			};
		}
	);
}

module.exports = unmapTaskRoute;
