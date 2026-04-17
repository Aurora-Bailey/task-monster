const { ObjectId } = require('mongodb');

const { activateNextQueuedTask, collapseQueuePositionsAfter } = require('../../lib/task-queue');
const { closeOpenTaskRun } = require('../../lib/task-runs');
const { findOwnedTask, serializedTaskJsonSchema, serializeTask } = require('../../lib/tasks');

const taskParamsSchema = {
	type: 'object',
	required: ['taskId'],
	properties: {
		taskId: { type: 'string' }
	}
};

async function doneTaskRoute(app) {
	app.post(
		'/tasks/:taskId/done',
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

			if (!task.activeToday) {
				return reply.code(409).send({
					message: 'Task must be active before it can be marked done.'
				});
			}

			const activeCountBeforeUpdate = await app.mongo.db.collection('tasks').countDocuments({
				userId: task.userId,
				archived: false,
				activeToday: true
			});
			const completedAt = new Date();
			const remapToDaymap = task.mode === 'repeatable' && task.daymapLocked === true;
			const completedTallyCount =
				task.trackingType === 'tally' && Number.isInteger(task.activeTallyCount)
					? task.activeTallyCount
					: null;
			const previousQueuePosition = Number.isInteger(task.queuePosition) ? task.queuePosition : null;
			const result = await app.mongo.db.collection('tasks').findOneAndUpdate(
				{
					_id: task._id,
					userId: task.userId,
					archived: false,
					activeToday: true
				},
				{
					$set: {
						mappedToday: remapToDaymap,
						mappedAt: remapToDaymap ? completedAt : null,
						queuePosition: null,
						activeToday: false,
						activatedAt: null,
						alarmDueAt: null,
						activeTallyCount: 0,
						lastCompletedTallyCount: completedTallyCount,
						lastCompletedAt: completedAt,
						lastInactivatedAt: completedAt,
						archived: task.mode === 'one-time',
						updatedAt: completedAt
					}
				},
				{
					returnDocument: 'after'
				}
			);

			if (!result) {
				return reply.code(409).send({
					message: 'Task could not be marked done.'
				});
			}

			await collapseQueuePositionsAfter(app.mongo.db, {
				userId: request.auth.userId,
				queuePosition: previousQueuePosition
			});

			await closeOpenTaskRun(app.mongo.db, {
				userId: request.auth.userId,
				taskId,
				endedAt: completedAt,
				endingReason: 'done',
				tallyCount: completedTallyCount ?? undefined
			});

			if (activeCountBeforeUpdate < 2) {
				await activateNextQueuedTask(app.mongo.db, {
					userId: request.auth.userId,
					activatedAt: completedAt
				});
			}

			return {
				task: serializeTask(result)
			};
		}
	);
}

module.exports = doneTaskRoute;
