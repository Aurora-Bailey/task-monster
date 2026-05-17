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

async function updateTaskDaymapPinRoute(app) {
	app.patch(
		'/tasks/:taskId/daymap-pin',
		{
			schema: {
				params: taskParamsSchema,
				body: {
					type: 'object',
					required: ['pinned'],
					additionalProperties: false,
					properties: {
						pinned: {
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

			if (task.activeToday) {
				return reply.code(409).send({
					message: 'Active tasks cannot change daymap pinning.'
				});
			}

			const updatedAt = new Date();
			const previousQueuePosition = Number.isInteger(task.queuePosition)
				? task.queuePosition
				: null;
			const pinnedUpdate = request.body.pinned
				? {
						mappedToday: true,
						mappedAt: task.mappedAt || updatedAt,
						daymapLocked: task.mode === 'repeatable',
						queuePosition: null,
						updatedAt
					}
				: {
						mappedToday: false,
						mappedAt: null,
						daymapLocked: false,
						queuePosition: null,
						activeTallyCount: 0,
						updatedAt
					};
			const result = await app.mongo.db.collection('tasks').findOneAndUpdate(
				{
					_id: task._id,
					userId: task.userId,
					archived: false,
					activeToday: false
				},
				{
					$set: pinnedUpdate
				},
				{
					returnDocument: 'after'
				}
			);

			if (!result) {
				return reply.code(409).send({
					message: 'Task daymap pin could not be updated.'
				});
			}

			await collapseQueuePositionsAfter(app.mongo.db, {
				userId: request.auth.userId,
				queuePosition: previousQueuePosition
			});

			return {
				task: serializeTask(result)
			};
		}
	);
}

module.exports = updateTaskDaymapPinRoute;
