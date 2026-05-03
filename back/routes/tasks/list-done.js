const { ObjectId } = require('mongodb');

const {
	buildPanicLogItemsForWindow,
	getPanicMillisecondsForWindow,
	loadPanicRunsOverlappingWindow
} = require('../../lib/panic');
const { serializedCompletedTaskJsonSchema, serializeTask } = require('../../lib/tasks');

const COMPLETED_TASK_LIMIT = 100;
const COMPLETED_DAY_LIMIT = 120;
const DEFAULT_RECENT_DONE_LIMIT = 10;
const MAX_RECENT_DONE_LIMIT = 50;

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

function parseRecentDoneLimit(value) {
	if (value === undefined) {
		return DEFAULT_RECENT_DONE_LIMIT;
	}

	const parsed = Number.parseInt(value, 10);

	if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_RECENT_DONE_LIMIT) {
		throw new Error(`Limit must be between 1 and ${MAX_RECENT_DONE_LIMIT}.`);
	}

	return parsed;
}

function parseDoneCursor(value) {
	if (value === undefined) {
		return null;
	}

	const [endedAtValue, runIdValue, ...extraParts] = String(value).split('|');
	const endedAt = new Date(endedAtValue);

	if (
		extraParts.length > 0 ||
		!endedAtValue ||
		!runIdValue ||
		Number.isNaN(endedAt.getTime()) ||
		!ObjectId.isValid(runIdValue)
	) {
		throw new Error('Invalid done cursor.');
	}

	return {
		endedAt,
		runId: new ObjectId(runIdValue)
	};
}

function buildDoneCursor(taskRun) {
	return `${taskRun.endedAt.toISOString()}|${taskRun._id.toString()}`;
}

function buildCursorMatch(cursor) {
	if (!cursor) {
		return {};
	}

	return {
		$or: [
			{
				endedAt: {
					$lt: cursor.endedAt
				}
			},
			{
				endedAt: cursor.endedAt,
				_id: {
					$lt: cursor.runId
				}
			}
		]
	};
}

async function loadPanicRunsForTaskRuns(app, { userId, taskRuns }) {
	const earliestStartedAt = taskRuns.reduce(
		(earliest, taskRun) =>
			earliest === null || taskRun.startedAt.getTime() < earliest.getTime()
				? taskRun.startedAt
				: earliest,
		null
	);
	const latestEndedAt = taskRuns.reduce(
		(latest, taskRun) =>
			latest === null || taskRun.endedAt.getTime() > latest.getTime() ? taskRun.endedAt : latest,
		null
	);

	if (!earliestStartedAt || !latestEndedAt) {
		return [];
	}

	return loadPanicRunsOverlappingWindow(app.mongo.db, {
		userId,
		startedAt: earliestStartedAt,
		endedAt: latestEndedAt
	});
}

function serializeCompletedTaskRun(taskRun, { measuredAt, panicRuns }) {
	const serializedTask = serializeTask({
		...taskRun.task,
		trackingType: taskRun.trackingType ?? taskRun.task.trackingType,
		tallyUnit: taskRun.tallyUnit ?? taskRun.task.tallyUnit,
		tallyTarget: Number.isInteger(taskRun.tallyTarget)
			? taskRun.tallyTarget
			: taskRun.task.tallyTarget
	});
	const tallyCount = Number.isInteger(taskRun.tallyCount)
		? taskRun.tallyCount
		: Number.isInteger(taskRun.startTallyCount)
			? taskRun.startTallyCount
			: null;
	const spentMilliseconds = Math.max(0, taskRun.endedAt.getTime() - taskRun.startedAt.getTime());
	const panicMilliseconds = getPanicMillisecondsForWindow({
		panicRuns,
		startedAt: taskRun.startedAt,
		endedAt: taskRun.endedAt,
		now: measuredAt
	});
	const taskPanicLog = buildPanicLogItemsForWindow({
		panicRuns,
		startedAt: taskRun.startedAt,
		endedAt: taskRun.endedAt,
		now: measuredAt,
		includeOpenRuns: false
	});

	return {
		...serializedTask,
		id: taskRun._id.toString(),
		taskId: serializedTask.id,
		instanceNote: taskRun.instanceNote ?? null,
		completedAt: taskRun.endedAt.toISOString(),
		startedAt: taskRun.startedAt.toISOString(),
		endedAt: taskRun.endedAt.toISOString(),
		spentMilliseconds,
		panicMilliseconds,
		effectiveMilliseconds: Math.max(0, spentMilliseconds - panicMilliseconds),
		taskPanicLog,
		tallyCount
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
							type: 'string'
						},
						limit: {
							type: 'string'
						},
						cursor: {
							type: 'string'
						}
					}
				},
				response: {
					200: {
						type: 'object',
						required: ['tasks', 'days', 'selectedDay', 'nextCursor', 'hasMore'],
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
							},
							nextCursor: {
								type: ['string', 'null']
							},
							hasMore: {
								type: 'boolean'
							}
						}
					}
				}
			}
		},
		async (request, reply) => {
			let timezoneOffsetMinutes;
			let recentDoneLimit;
			let doneCursor;

			try {
				timezoneOffsetMinutes = parseTimezoneOffsetMinutes(request.query.tzOffsetMinutes);
				recentDoneLimit = parseRecentDoneLimit(request.query.limit);
				doneCursor = parseDoneCursor(request.query.cursor);
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
			const measuredAt = new Date();
			const isRecentFeed = request.query.limit !== undefined || request.query.cursor !== undefined;
			const timezone = toTimezoneOffsetString(timezoneOffsetMinutes);
			const doneMatch = {
				userId,
				endingReason: 'done',
				endedAt: {
					$ne: null
				}
			};

			if (isRecentFeed) {
				const taskRuns = await app.mongo.db
					.collection('task_runs')
					.aggregate([
						{
							$match: {
								...doneMatch,
								...buildCursorMatch(doneCursor)
							}
						},
						{
							$sort: {
								endedAt: -1,
								_id: -1
							}
						},
						{
							$limit: recentDoneLimit + 1
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
				const pageTaskRuns = taskRuns.slice(0, recentDoneLimit);
				const hasMore = taskRuns.length > recentDoneLimit;
				const panicRuns = await loadPanicRunsForTaskRuns(app, {
					userId: request.auth.userId,
					taskRuns: pageTaskRuns
				});

				return {
					tasks: pageTaskRuns.map((taskRun) =>
						serializeCompletedTaskRun(taskRun, {
							measuredAt,
							panicRuns
						})
					),
					days: [],
					selectedDay: null,
					nextCursor: hasMore && pageTaskRuns.length > 0 ? buildDoneCursor(pageTaskRuns.at(-1)) : null,
					hasMore
				};
			}

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
					selectedDay: null,
					nextCursor: null,
					hasMore: false
				};
			}

			const { startedAt, endedBefore } = getUtcRangeForLocalDay(
				selectedDay,
				timezoneOffsetMinutes
			);
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
							endedAt: -1,
							_id: -1
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
			const panicRuns = await loadPanicRunsForTaskRuns(app, {
				userId: request.auth.userId,
				taskRuns
			});

			return {
				days,
				selectedDay,
				tasks: taskRuns.map((taskRun) =>
					serializeCompletedTaskRun(taskRun, {
						measuredAt,
						panicRuns
					})
				),
				nextCursor: null,
				hasMore: false
			};
		}
	);
}

module.exports = listDoneTasksRoute;
