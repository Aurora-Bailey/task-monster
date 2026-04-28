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

const doneTaskSchema = {
	params: taskParamsSchema,
	body: {
		type: 'object',
		additionalProperties: false,
		properties: {
			startedAt: {
				type: ['string', 'null'],
				format: 'date-time'
			},
			completedAt: {
				type: ['string', 'null'],
				format: 'date-time'
			},
			instanceNote: {
				type: ['string', 'null'],
				maxLength: 4000
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
};

async function doneTaskRoute(app) {
	app.post(
		'/tasks/:taskId/done',
		{
			schema: doneTaskSchema
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

			const openTaskRun = await app.mongo.db.collection('task_runs').findOne(
				{
					userId: task.userId,
					taskId: task._id,
					endedAt: null
				},
				{
					sort: {
						startedAt: -1
					}
				}
			);

			if (!openTaskRun || !(openTaskRun.startedAt instanceof Date)) {
				return reply.code(409).send({
					message: 'Task must be active before it can be marked done.'
				});
			}

			const activeCountBeforeUpdate = await app.mongo.db.collection('tasks').countDocuments({
				userId: task.userId,
				archived: false,
				activeToday: true
			});
			const actionedAt = new Date();
			const requestedStartedAt = request.body?.startedAt;
			const requestedCompletedAt = request.body?.completedAt;
			let startedAt = openTaskRun.startedAt;
			let completedAt = actionedAt;

			if (typeof requestedStartedAt === 'string') {
				const parsedStartedAt = new Date(requestedStartedAt);

				if (Number.isNaN(parsedStartedAt.getTime())) {
					return reply.code(400).send({
						message: 'Invalid start time.'
					});
				}

				startedAt = parsedStartedAt;
			}

			if (typeof requestedCompletedAt === 'string') {
				const parsedCompletedAt = new Date(requestedCompletedAt);

				if (Number.isNaN(parsedCompletedAt.getTime())) {
					return reply.code(400).send({
						message: 'Invalid completion time.'
					});
				}

				completedAt = new Date(Math.min(parsedCompletedAt.getTime(), actionedAt.getTime()));
			}

			completedAt = new Date(Math.max(startedAt.getTime(), completedAt.getTime()));
			startedAt = new Date(Math.min(startedAt.getTime(), completedAt.getTime()));

			const remapToDaymap = task.mode === 'repeatable' && task.daymapLocked === true;
			const completedTallyCount =
				task.trackingType === 'tally' && Number.isInteger(task.activeTallyCount)
					? task.activeTallyCount
					: null;
			const previousQueuePosition = Number.isInteger(task.queuePosition) ? task.queuePosition : null;
			const instanceNote = Object.hasOwn(request.body || {}, 'instanceNote')
				? typeof request.body.instanceNote === 'string'
					? request.body.instanceNote
					: null
				: undefined;
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
						mappedAt: remapToDaymap ? actionedAt : null,
						queuePosition: null,
						activeToday: false,
						activatedAt: null,
						activeTallyCount: 0,
						lastCompletedTallyCount: completedTallyCount,
						lastCompletedAt: completedAt,
						lastInactivatedAt: completedAt,
						archived: task.mode === 'one-time',
						updatedAt: actionedAt
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
				startedAt,
				endedAt: completedAt,
				endingReason: 'done',
				tallyCount: completedTallyCount ?? undefined,
				instanceNote
			});

			if (activeCountBeforeUpdate < 2) {
				await activateNextQueuedTask(app.mongo.db, {
					userId: request.auth.userId,
					activatedAt: actionedAt
				});
			}

			return {
				task: serializeTask(result)
			};
		}
	);
}

module.exports = doneTaskRoute;
