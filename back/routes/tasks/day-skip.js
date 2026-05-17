const { ObjectId } = require('mongodb');

const {
	getCurrentLocalDay,
	getLocalWeekdayIndex,
	parseTimezoneOffsetMinutes
} = require('../../lib/local-days');
const { collapseQueuePositionsAfter } = require('../../lib/task-queue');
const {
	decorateTasksForLocalDay,
	findOwnedTask,
	isTaskScheduledForWeekday,
	serializedTaskJsonSchema,
	serializeTask
} = require('../../lib/tasks');

const taskParamsSchema = {
	type: 'object',
	required: ['taskId'],
	properties: {
		taskId: { type: 'string' }
	}
};

async function updateTaskDaySkipRoute(app) {
	app.patch(
		'/tasks/:taskId/day-skip',
		{
			schema: {
				params: taskParamsSchema,
				body: {
					type: 'object',
					required: ['skipped'],
					additionalProperties: false,
					properties: {
						skipped: {
							type: 'boolean'
						},
						tzOffsetMinutes: {
							type: ['integer', 'string']
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

			let timezoneOffsetMinutes;

			try {
				timezoneOffsetMinutes = parseTimezoneOffsetMinutes(request.body.tzOffsetMinutes);
			} catch (error) {
				return reply.code(400).send({
					message: error.message
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
					message: 'Active tasks cannot be skipped.'
				});
			}

			const localDay = getCurrentLocalDay(timezoneOffsetMinutes);
			const weekdayIndex = getLocalWeekdayIndex(localDay);
			const taskIsOnDaymap =
				task.mappedToday === true || isTaskScheduledForWeekday(task, weekdayIndex);

			if (!taskIsOnDaymap) {
				return reply.code(409).send({
					message: 'Only daymap tasks can be skipped for today.'
				});
			}

			const updatedAt = new Date();
			const previousQueuePosition = Number.isInteger(task.queuePosition)
				? task.queuePosition
				: null;
			const skipUpdate = request.body.skipped
				? {
						skippedLocalDay: localDay,
						skippedAt: updatedAt,
						queuePosition: null,
						updatedAt
					}
				: {
						skippedLocalDay: null,
						skippedAt: null,
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
					$set: skipUpdate
				},
				{
					returnDocument: 'after'
				}
			);

			if (!result) {
				return reply.code(409).send({
					message: "Task skip couldn't be updated."
				});
			}

			if (request.body.skipped) {
				await collapseQueuePositionsAfter(app.mongo.db, {
					userId: request.auth.userId,
					queuePosition: previousQueuePosition
				});
			}

			const [decoratedTask] = await decorateTasksForLocalDay(app.mongo.db, {
				tasks: [result],
				userId: request.auth.userId,
				day: localDay,
				timezoneOffsetMinutes
			});

			return {
				task: serializeTask(decoratedTask)
			};
		}
	);
}

module.exports = updateTaskDaySkipRoute;
