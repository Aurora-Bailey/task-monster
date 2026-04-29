const { ObjectId } = require('mongodb');

const { activateNextQueuedTask, collapseQueuePositionsAfter } = require('../../lib/task-queue');
const { closeOpenTaskRun, createCompletedTaskRun } = require('../../lib/task-runs');
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
				required: ['task', 'changes'],
				properties: {
					task: serializedTaskJsonSchema,
					changes: {
						type: 'array',
						items: {
							type: 'object',
							required: ['field', 'label', 'value'],
							properties: {
								field: { type: 'string' },
								label: { type: 'string' },
								value: { type: 'string' }
							}
						}
					}
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
			const actionedAt = new Date();
			const requestedStartedAt = request.body?.startedAt;
			const requestedCompletedAt = request.body?.completedAt;
			const wasActive = task.activeToday === true;
			let openTaskRun = null;
			let activeCountBeforeUpdate = 0;
			let startedAt = actionedAt;
			let completedAt = actionedAt;

			if (wasActive) {
				openTaskRun = await app.mongo.db.collection('task_runs').findOne(
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

				activeCountBeforeUpdate = await app.mongo.db.collection('tasks').countDocuments({
					userId: task.userId,
					archived: false,
					activeToday: true
				});
				startedAt = openTaskRun.startedAt;
			} else {
				if (typeof requestedStartedAt !== 'string' || typeof requestedCompletedAt !== 'string') {
					return reply.code(409).send({
						message: 'Inactive or daymap tasks need both startedAt and completedAt to be marked done historically.'
					});
				}
			}

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
			const changes = [];
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

			if (!wasActive || startedAt.getTime() !== openTaskRun.startedAt.getTime()) {
				changes.push({
					field: 'started time',
					label: 'Changed: started time',
					value: startedAt.toISOString()
				});
			}

			if (
				!wasActive ||
				typeof requestedCompletedAt === 'string' ||
				completedAt.getTime() !== actionedAt.getTime()
			) {
				changes.push({
					field: 'completed time',
					label: 'Changed: completed time',
					value: completedAt.toISOString()
				});
			}

			if (instanceNote !== undefined && instanceNote !== (openTaskRun?.instanceNote ?? null)) {
				changes.push({
					field: 'instance note',
					label: 'Changed: instance note',
					value: instanceNote ? `"${instanceNote}"` : 'cleared'
				});
			}

			const result = await app.mongo.db.collection('tasks').findOneAndUpdate(
				{
					_id: task._id,
					userId: task.userId,
					archived: false
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

			if (wasActive) {
				await closeOpenTaskRun(app.mongo.db, {
					userId: request.auth.userId,
					taskId,
					startedAt,
					endedAt: completedAt,
					endingReason: 'done',
					tallyCount: completedTallyCount ?? undefined,
					instanceNote
				});
			} else {
				await createCompletedTaskRun(app.mongo.db, {
					userId: request.auth.userId,
					taskId,
					startedAt,
					endedAt: completedAt,
					endingReason: 'done',
					trackingType: task.trackingType || 'time',
					tallyUnit: task.tallyUnit ?? null,
					tallyTarget: Number.isInteger(task.tallyTarget) ? task.tallyTarget : null,
					startTallyCount: task.trackingType === 'tally' ? completedTallyCount : null,
					tallyCount: completedTallyCount,
					instanceNote: instanceNote ?? null
				});
			}

			if (wasActive && activeCountBeforeUpdate < 2) {
				await activateNextQueuedTask(app.mongo.db, {
					userId: request.auth.userId,
					activatedAt: actionedAt
				});
			}

			return {
				task: serializeTask(result),
				changes
			};
		}
		);
}

module.exports = doneTaskRoute;
