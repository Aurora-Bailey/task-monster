const { ObjectId } = require('mongodb');

const { collapseQueuePositionsAfter } = require('../../lib/task-queue');
const { findOwnedTask, serializedTaskJsonSchema, serializeTask } = require('../../lib/tasks');

const taskParamsSchema = {
	type: 'object',
	required: ['taskId'],
	properties: {
		taskId: { type: 'string' }
	}
};

async function unqueueTaskRoute(app) {
	app.post(
		'/tasks/:taskId/unqueue',
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
					message: 'Active tasks are already on the table.'
				});
			}

			if (!Number.isInteger(task.queuePosition) || task.queuePosition < 1) {
				return reply.code(409).send({
					message: 'Task is not queued.'
				});
			}

			const updatedAt = new Date();
			const result = await app.mongo.db.collection('tasks').findOneAndUpdate(
				{
					_id: task._id,
					userId: task.userId,
					archived: false,
					activeToday: false,
					queuePosition: task.queuePosition
				},
				{
					$set: {
						queuePosition: null,
						updatedAt
					}
				},
				{
					returnDocument: 'after'
				}
			);

			if (!result) {
				return reply.code(409).send({
					message: 'Task could not be removed from the queue.'
				});
			}

			await collapseQueuePositionsAfter(app.mongo.db, {
				userId: request.auth.userId,
				queuePosition: task.queuePosition
			});

			return {
				task: serializeTask(result)
			};
		}
	);
}

module.exports = unqueueTaskRoute;
