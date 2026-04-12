const { ObjectId } = require('mongodb');

const { getNextQueuePosition } = require('../../lib/task-queue');
const { findOwnedTask, serializedTaskJsonSchema, serializeTask } = require('../../lib/tasks');

const taskParamsSchema = {
	type: 'object',
	required: ['taskId'],
	properties: {
		taskId: { type: 'string' }
	}
};

async function queueTaskRoute(app) {
	app.post(
		'/tasks/:taskId/queue',
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

			if (task.activeToday || task.mappedToday !== true) {
				return reply.code(409).send({
					message: 'Only daymap tasks can be queued.'
				});
			}

			if (Number.isInteger(task.queuePosition) && task.queuePosition > 0) {
				return reply.code(409).send({
					message: 'Task is already queued.'
				});
			}

			const updatedAt = new Date();
			const queuePosition = await getNextQueuePosition(app.mongo.db, {
				userId: request.auth.userId
			});
			const result = await app.mongo.db.collection('tasks').findOneAndUpdate(
				{
					_id: task._id,
					userId: task.userId,
					archived: false,
					mappedToday: true,
					activeToday: false,
					queuePosition: null
				},
				{
					$set: {
						queuePosition,
						updatedAt
					}
				},
				{
					returnDocument: 'after'
				}
			);

			if (!result) {
				return reply.code(409).send({
					message: 'Task could not be queued.'
				});
			}

			return {
				task: serializeTask(result)
			};
		}
	);
}

module.exports = queueTaskRoute;
