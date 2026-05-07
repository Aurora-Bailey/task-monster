const { ObjectId } = require('mongodb');

const { deleteOpenTaskRun } = require('../../lib/task-runs');
const { findOwnedTask, serializedTaskJsonSchema, serializeTask } = require('../../lib/tasks');

const taskParamsSchema = {
	type: 'object',
	required: ['taskId'],
	properties: {
		taskId: { type: 'string' }
	}
};

async function findMostRecentStartedRun(db, { userId, taskId, excludeRunId = null }) {
	const filter = {
		userId,
		taskId
	};

	if (excludeRunId) {
		filter._id = {
			$ne: excludeRunId
		};
	}

	return db
		.collection('task_runs')
		.find(filter)
		.sort({
			startedAt: -1
		})
		.limit(1)
		.next();
}

async function cancelActiveTaskRoute(app) {
	app.post(
		'/tasks/:taskId/cancel-active',
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
					message: 'Task is not active.'
				});
			}

			const canceledAt = new Date();
			const openTaskRun = await app.mongo.db
				.collection('task_runs')
				.find({
					userId: task.userId,
					taskId: task._id,
					endedAt: null
				})
				.sort({
					startedAt: -1
				})
				.limit(1)
				.next();
			const previousStartedRun = await findMostRecentStartedRun(app.mongo.db, {
				userId: task.userId,
				taskId: task._id,
				excludeRunId: openTaskRun?._id ?? null
			});
			const restoredTallyCount =
				task.trackingType === 'tally' && Number.isInteger(openTaskRun?.startTallyCount)
					? openTaskRun.startTallyCount
					: Number.isInteger(task.activeTallyCount)
						? task.activeTallyCount
						: 0;
			const mappedAt = task.mappedAt || canceledAt;

			const result = await app.mongo.db.collection('tasks').findOneAndUpdate(
				{
					_id: task._id,
					userId: task.userId,
					archived: false,
					activeToday: true
				},
				{
					$set: {
						mappedToday: true,
						mappedAt,
						queuePosition: null,
						activeToday: false,
						activatedAt: null,
						activeTallyCount: restoredTallyCount,
						lastStartedAt: previousStartedRun?.startedAt ?? null,
						updatedAt: canceledAt
					}
				},
				{
					returnDocument: 'after'
				}
			);

			if (!result) {
				return reply.code(409).send({
					message: 'Task activation could not be canceled.'
				});
			}

			await deleteOpenTaskRun(app.mongo.db, {
				userId: request.auth.userId,
				taskId
			});

			return {
				task: serializeTask(result)
			};
		}
	);
}

module.exports = cancelActiveTaskRoute;
