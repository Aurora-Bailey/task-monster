const { ObjectId } = require('mongodb');

const { serializedCompletedTaskJsonSchema, serializeTask } = require('../../lib/tasks');

const COMPLETED_TASK_LIMIT = 100;
const COMPLETED_DAY_LIMIT = 120;

function parseTimezoneOffsetMinutes(value) {
	if (value === undefined) {
		return 0;
	}

	const parsed = Number.parseInt(value, 10);

	if (!Number.isInteger(parsed) || parsed < -840 || parsed > 840) {
		throw new Error('Invalid timezone offset.');
	}

	return parsed;
}

function isValidDayString(value) {
	return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toTimezoneOffsetString(timezoneOffsetMinutes) {
	const localOffsetMinutes = -timezoneOffsetMinutes;
	const sign = localOffsetMinutes >= 0 ? '+' : '-';
	const absoluteMinutes = Math.abs(localOffsetMinutes);
	const hours = String(Math.floor(absoluteMinutes / 60)).padStart(2, '0');
	const minutes = String(absoluteMinutes % 60).padStart(2, '0');

	return `${sign}${hours}:${minutes}`;
}

function getUtcRangeForLocalDay(day, timezoneOffsetMinutes) {
	const [year, month, date] = day.split('-').map((part) => Number.parseInt(part, 10));

	return {
		startedAt: new Date(Date.UTC(year, month - 1, date, 0, 0, 0, 0) + timezoneOffsetMinutes * 60 * 1000),
		endedBefore: new Date(
			Date.UTC(year, month - 1, date + 1, 0, 0, 0, 0) + timezoneOffsetMinutes * 60 * 1000
		)
	};
}

async function listDoneTasksRoute(app) {
	app.get(
		'/tasks/done',
		{
			schema: {
				querystring: {
					type: 'object',
					additionalProperties: false,
					properties: {
						day: {
							type: 'string'
						},
						tzOffsetMinutes: {
							type: ['integer', 'string']
						}
					}
				},
				response: {
					200: {
						type: 'object',
						required: ['tasks', 'days', 'selectedDay'],
						properties: {
							tasks: {
								type: 'array',
								items: serializedCompletedTaskJsonSchema
							},
							days: {
								type: 'array',
								items: {
									type: 'string'
								}
							},
							selectedDay: {
								type: ['string', 'null']
							}
						}
					}
				}
			}
		},
		async (request, reply) => {
			let timezoneOffsetMinutes;

			try {
				timezoneOffsetMinutes = parseTimezoneOffsetMinutes(request.query.tzOffsetMinutes);
			} catch (error) {
				return reply.code(400).send({
					message: error.message
				});
			}

			if (request.query.day !== undefined && !isValidDayString(request.query.day)) {
				return reply.code(400).send({
					message: 'Invalid day.'
				});
			}

			const userId = new ObjectId(request.auth.userId);
			const timezone = toTimezoneOffsetString(timezoneOffsetMinutes);
			const doneMatch = {
				userId,
				endingReason: 'done',
				endedAt: {
					$ne: null
				}
			};
			const dayRows = await app.mongo.db
				.collection('task_runs')
				.aggregate([
					{
						$match: doneMatch
					},
					{
						$group: {
							_id: {
								$dateToString: {
									format: '%Y-%m-%d',
									date: '$endedAt',
									timezone
								}
							}
						}
					},
					{
						$sort: {
							_id: -1
						}
					},
					{
						$limit: COMPLETED_DAY_LIMIT
					}
				])
				.toArray();
			const days = dayRows.map((row) => row._id);
			const selectedDay = request.query.day || days[0] || null;

			if (!selectedDay) {
				return {
					tasks: [],
					days,
					selectedDay: null
				};
			}

			const { startedAt, endedBefore } = getUtcRangeForLocalDay(selectedDay, timezoneOffsetMinutes);
			const taskRuns = await app.mongo.db
				.collection('task_runs')
				.aggregate([
					{
						$match: {
							...doneMatch,
							endedAt: {
								$gte: startedAt,
								$lt: endedBefore
							}
						}
					},
					{
						$sort: {
							endedAt: -1
						}
					},
					{
						$limit: COMPLETED_TASK_LIMIT
					},
					{
						$lookup: {
							from: 'tasks',
							localField: 'taskId',
							foreignField: '_id',
							as: 'task'
						}
					},
					{
						$unwind: '$task'
					}
				])
				.toArray();

			return {
				days,
				selectedDay,
				tasks: taskRuns.map((taskRun) => {
					const serializedTask = serializeTask(taskRun.task);

					return {
						...serializedTask,
						id: taskRun._id.toString(),
						taskId: serializedTask.id,
						completedAt: taskRun.endedAt.toISOString(),
						startedAt: taskRun.startedAt.toISOString(),
						endedAt: taskRun.endedAt.toISOString(),
						spentMilliseconds: Math.max(
							0,
							taskRun.endedAt.getTime() - taskRun.startedAt.getTime()
						)
					};
				})
			};
		}
	);
}

module.exports = listDoneTasksRoute;
