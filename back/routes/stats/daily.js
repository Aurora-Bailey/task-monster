const { ObjectId } = require('mongodb');

const {
	buildPanicLog,
	getPanicMillisecondsForWindow,
	loadPanicRunsForDay,
	serializedPanicLogItemJsonSchema
} = require('../../lib/panic');
const {
	getCurrentLocalDay,
	getUtcRangeForLocalDay,
	isValidDayString,
	parseTimezoneOffsetMinutes
} = require('../../lib/local-days');

const BREAKDOWN_LIMIT = 10;
const DONE_LOG_LIMIT = 12;
const SESSION_LOG_LIMIT = 100;
const OVERLAP_BANDS = [
	{ key: 'solo', label: 'Solo' },
	{ key: 'double', label: 'Double' },
	{ key: 'triple', label: 'Triple' },
	{ key: 'quadPlus', label: 'Quad+' }
];

function buildCadenceBuckets(day, timezoneOffsetMinutes) {
	const [year, month, date] = day.split('-').map((part) => Number.parseInt(part, 10));

	return Array.from({ length: 24 }, (_, hour) => ({
		hour,
		label: formatHourLabel(hour),
		startedAt: new Date(
			Date.UTC(year, month - 1, date, hour, 0, 0, 0) + timezoneOffsetMinutes * 60 * 1000
		),
		endedBefore: new Date(
			Date.UTC(year, month - 1, date, hour + 1, 0, 0, 0) + timezoneOffsetMinutes * 60 * 1000
		),
		milliseconds: 0
	}));
}

function formatHourLabel(hour) {
	if (hour === 0) {
		return '12a';
	}

	if (hour < 12) {
		return `${hour}a`;
	}

	if (hour === 12) {
		return '12p';
	}

	return `${hour - 12}p`;
}

function getOverlapMilliseconds(startedAt, endedBefore, leftStartedAt, leftEndedBefore) {
	return Math.max(
		0,
		Math.min(endedBefore.getTime(), leftEndedBefore.getTime()) -
			Math.max(startedAt.getTime(), leftStartedAt.getTime())
	);
}

function toOutcome(endingReason) {
	if (endingReason === 'done') {
		return 'done';
	}

	if (endingReason === 'inactive') {
		return 'inactive';
	}

	return 'active';
}

function getFallbackTask(taskId) {
	return {
		id: taskId,
		name: 'Unknown task',
		color: '#6f7d8b',
		colorKey: 'unknown',
		mode: 'repeatable',
		trackingType: 'time',
		tallyUnit: null
	};
}

const dailyStatsSchema = {
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
				required: [
					'selectedDay',
					'summary',
					'overlapBands',
					'breakdown',
					'cadence',
					'panicLog',
					'doneLog',
					'sessionLog'
				],
			properties: {
				selectedDay: {
					type: 'string'
				},
				summary: {
					type: 'object',
						required: [
							'trackedMilliseconds',
							'effectiveTrackedMilliseconds',
							'taskPanicMilliseconds',
							'wallClockMilliseconds',
							'overlapMilliseconds',
							'runCount',
							'completedCount',
							'pausedCount',
							'panicMilliseconds',
							'panicCount',
							'longestPanicMilliseconds',
							'tallyUnits',
							'averageRunMilliseconds',
							'longestRunMilliseconds'
						],
						properties: {
							trackedMilliseconds: { type: 'integer' },
							effectiveTrackedMilliseconds: { type: 'integer' },
							taskPanicMilliseconds: { type: 'integer' },
							wallClockMilliseconds: { type: 'integer' },
							overlapMilliseconds: { type: 'integer' },
							runCount: { type: 'integer' },
							completedCount: { type: 'integer' },
							pausedCount: { type: 'integer' },
							panicMilliseconds: { type: 'integer' },
							panicCount: { type: 'integer' },
							longestPanicMilliseconds: { type: 'integer' },
							tallyUnits: { type: 'integer' },
							averageRunMilliseconds: { type: 'integer' },
							longestRunMilliseconds: { type: 'integer' }
						}
					},
				overlapBands: {
					type: 'array',
					items: {
						type: 'object',
						required: ['key', 'label', 'milliseconds'],
						properties: {
							key: { type: 'string' },
							label: { type: 'string' },
							milliseconds: { type: 'integer' }
						}
					}
				},
				breakdown: {
					type: 'array',
					items: {
						type: 'object',
						required: [
							'taskId',
							'name',
							'color',
							'colorKey',
							'mode',
							'trackingType',
							'tallyUnit',
							'totalMilliseconds',
							'totalTallyCount',
							'runCount',
							'completedCount'
						],
						properties: {
							taskId: { type: 'string' },
							name: { type: 'string' },
							color: { type: 'string' },
							colorKey: { type: 'string' },
							mode: { type: 'string' },
							trackingType: { type: 'string' },
							tallyUnit: { type: ['string', 'null'] },
							totalMilliseconds: { type: 'integer' },
							totalTallyCount: { type: 'integer' },
							runCount: { type: 'integer' },
							completedCount: { type: 'integer' }
						}
					}
				},
					cadence: {
						type: 'array',
						items: {
							type: 'object',
							required: ['hour', 'label', 'milliseconds'],
						properties: {
							hour: { type: 'integer' },
							label: { type: 'string' },
							milliseconds: { type: 'integer' }
							}
						}
					},
					panicLog: {
						type: 'array',
						items: serializedPanicLogItemJsonSchema
					},
					doneLog: {
						type: 'array',
						items: {
						type: 'object',
						required: [
							'id',
							'taskId',
							'name',
							'color',
							'colorKey',
							'mode',
							'trackingType',
							'tallyUnit',
							'completedAt',
							'spentMilliseconds',
							'tallyCount',
							'instanceNote'
						],
						properties: {
							id: { type: 'string' },
							taskId: { type: 'string' },
							name: { type: 'string' },
							color: { type: 'string' },
							colorKey: { type: 'string' },
							mode: { type: 'string' },
							trackingType: { type: 'string' },
							tallyUnit: { type: ['string', 'null'] },
							completedAt: { type: 'string' },
							spentMilliseconds: { type: 'integer' },
							tallyCount: { type: ['integer', 'null'] },
							instanceNote: { type: ['string', 'null'] }
						}
					}
				},
				sessionLog: {
					type: 'array',
					items: {
						type: 'object',
						required: [
							'id',
							'taskId',
							'name',
							'color',
							'colorKey',
							'mode',
							'trackingType',
							'tallyUnit',
							'startedAt',
							'endedAt',
							'spentMilliseconds',
							'tallyCount',
							'instanceNote',
							'outcome'
						],
						properties: {
							id: { type: 'string' },
							taskId: { type: 'string' },
							name: { type: 'string' },
							color: { type: 'string' },
							colorKey: { type: 'string' },
							mode: { type: 'string' },
							trackingType: { type: 'string' },
							tallyUnit: { type: ['string', 'null'] },
							startedAt: { type: 'string' },
							endedAt: { type: 'string' },
							spentMilliseconds: { type: 'integer' },
							tallyCount: { type: ['integer', 'null'] },
							instanceNote: { type: ['string', 'null'] },
							outcome: { type: 'string' }
						}
					}
				}
			}
		}
	}
};

async function dailyStatsRoute(app) {
	app.get(
		'/stats/daily',
		{
			schema: dailyStatsSchema
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

			const selectedDay = request.query.day || getCurrentLocalDay(timezoneOffsetMinutes);
				const { startedAt, endedBefore } = getUtcRangeForLocalDay(selectedDay, timezoneOffsetMinutes);
				const now = new Date();
				const cadenceBuckets = buildCadenceBuckets(selectedDay, timezoneOffsetMinutes);
				const userId = new ObjectId(request.auth.userId);
				const panicRuns = await loadPanicRunsForDay(app.mongo.db, {
					userId,
					day: selectedDay
				});
				const panicLog = buildPanicLog({
					day: selectedDay,
					panicRuns,
					timezoneOffsetMinutes,
					now
				});
				const panicMilliseconds = panicLog.reduce((total, item) => total + item.milliseconds, 0);
				const panicCount = panicLog.length;
				const longestPanicMilliseconds = panicLog.reduce(
					(longest, item) => Math.max(longest, item.milliseconds),
					0
				);

				const taskRuns = await app.mongo.db
					.collection('task_runs')
				.find({
					userId,
					startedAt: {
						$lt: endedBefore
					},
					$or: [
						{
							endedAt: null
						},
						{
							endedAt: {
								$gt: startedAt
							}
						}
					]
				})
				.sort({
					startedAt: 1
				})
				.toArray();

			const taskIds = [...new Set(taskRuns.map((taskRun) => taskRun.taskId.toString()))];
			const tasks = taskIds.length
				? await app.mongo.db
						.collection('tasks')
						.find({
							_id: {
								$in: taskIds.map((taskId) => new ObjectId(taskId))
							}
						})
						.toArray()
				: [];
			const tasksById = new Map(
				tasks.map((task) => [
					task._id.toString(),
					{
						id: task._id.toString(),
						name: task.name,
						color: task.colorHex,
						colorKey: task.colorKey,
						mode: task.mode,
						trackingType: task.trackingType || 'time',
						tallyUnit: task.tallyUnit ?? null
					}
				])
			);

			const clippedRuns = [];
			const breakdownByTaskId = new Map();
			const overlapEvents = [];
			let trackedMilliseconds = 0;
			let taskPanicMilliseconds = 0;
			let completedCount = 0;
			let pausedCount = 0;
			let tallyUnits = 0;
			let longestRunMilliseconds = 0;

			for (const taskRun of taskRuns) {
				const taskId = taskRun.taskId.toString();
				const task = tasksById.get(taskId) || getFallbackTask(taskId);
				const trackingType = taskRun.trackingType || task.trackingType || 'time';
				const tallyUnit = taskRun.tallyUnit ?? task.tallyUnit ?? null;
				const sessionTallyCount =
					trackingType === 'tally'
						? Math.max(
								0,
								(Number.isInteger(taskRun.tallyCount) ? taskRun.tallyCount : 0) -
									(Number.isInteger(taskRun.startTallyCount) ? taskRun.startTallyCount : 0)
							)
						: 0;
				const completedTallyCount =
					trackingType === 'tally' && Number.isInteger(taskRun.tallyCount) ? taskRun.tallyCount : null;
				const effectiveStartedAt = new Date(
					Math.max(taskRun.startedAt.getTime(), startedAt.getTime())
				);
				const rawEndedAt = taskRun.endedAt ? taskRun.endedAt : now;
				const effectiveEndedAt = new Date(
					Math.min(rawEndedAt.getTime(), endedBefore.getTime())
				);
				const spentMilliseconds = Math.max(
					0,
					effectiveEndedAt.getTime() - effectiveStartedAt.getTime()
				);
				const runPanicMilliseconds = getPanicMillisecondsForWindow({
					panicRuns,
					startedAt: effectiveStartedAt,
					endedAt: effectiveEndedAt,
					now
				});

				if (spentMilliseconds <= 0) {
					continue;
				}

				const outcome = toOutcome(taskRun.endingReason);
				const completedWithinDay =
					taskRun.endingReason === 'done' &&
					taskRun.endedAt &&
					taskRun.endedAt.getTime() >= startedAt.getTime() &&
					taskRun.endedAt.getTime() < endedBefore.getTime();
				const pausedWithinDay =
					taskRun.endingReason === 'inactive' &&
					taskRun.endedAt &&
					taskRun.endedAt.getTime() >= startedAt.getTime() &&
					taskRun.endedAt.getTime() < endedBefore.getTime();

				trackedMilliseconds += spentMilliseconds;
				taskPanicMilliseconds += runPanicMilliseconds;
				longestRunMilliseconds = Math.max(longestRunMilliseconds, spentMilliseconds);
				if (completedWithinDay) {
					completedCount += 1;
				}
				if (pausedWithinDay) {
					pausedCount += 1;
				}
				if ((completedWithinDay || pausedWithinDay) && sessionTallyCount > 0) {
					tallyUnits += sessionTallyCount;
				}

				overlapEvents.push({
					time: effectiveStartedAt.getTime(),
					delta: 1
				});
				overlapEvents.push({
					time: effectiveEndedAt.getTime(),
					delta: -1
				});

				for (const bucket of cadenceBuckets) {
					const overlapMilliseconds = getOverlapMilliseconds(
						effectiveStartedAt,
						effectiveEndedAt,
						bucket.startedAt,
						bucket.endedBefore
					);

					if (overlapMilliseconds > 0) {
						bucket.milliseconds += overlapMilliseconds;
					}
				}

				const currentBreakdown =
					breakdownByTaskId.get(taskId) || {
						taskId,
						name: task.name,
						color: task.color,
						colorKey: task.colorKey,
						mode: task.mode,
						trackingType,
						tallyUnit,
						totalMilliseconds: 0,
						totalTallyCount: 0,
						runCount: 0,
						completedCount: 0
					};
				currentBreakdown.totalMilliseconds += spentMilliseconds;
				if ((completedWithinDay || pausedWithinDay) && sessionTallyCount > 0) {
					currentBreakdown.totalTallyCount += sessionTallyCount;
				}
				currentBreakdown.runCount += 1;
				if (completedWithinDay) {
					currentBreakdown.completedCount += 1;
				}
				breakdownByTaskId.set(taskId, currentBreakdown);

				clippedRuns.push({
					id: taskRun._id.toString(),
					taskId,
					name: task.name,
					color: task.color,
					colorKey: task.colorKey,
					mode: task.mode,
					trackingType,
					tallyUnit,
					startedAt: effectiveStartedAt.toISOString(),
					endedAt: effectiveEndedAt.toISOString(),
					spentMilliseconds,
					panicMilliseconds: runPanicMilliseconds,
					instanceNote: taskRun.instanceNote ?? null,
					tallyCount:
						trackingType === 'tally'
							? Number.isInteger(completedTallyCount)
								? completedTallyCount
								: sessionTallyCount
							: null,
					outcome,
					completedAt:
						completedWithinDay && taskRun.endedAt ? taskRun.endedAt.toISOString() : null
				});
			}

			overlapEvents.sort((left, right) => left.time - right.time || left.delta - right.delta);

			const overlapTotals = {
				solo: 0,
				double: 0,
				triple: 0,
				quadPlus: 0
			};
			let activeCount = 0;
			let previousTime = null;

			for (const event of overlapEvents) {
				if (previousTime !== null && event.time > previousTime && activeCount > 0) {
					const duration = event.time - previousTime;

					if (activeCount === 1) {
						overlapTotals.solo += duration;
					} else if (activeCount === 2) {
						overlapTotals.double += duration;
					} else if (activeCount === 3) {
						overlapTotals.triple += duration;
					} else {
						overlapTotals.quadPlus += duration;
					}
				}

				activeCount += event.delta;
				previousTime = event.time;
			}

			const wallClockMilliseconds =
				overlapTotals.solo +
				overlapTotals.double +
				overlapTotals.triple +
				overlapTotals.quadPlus;
			const effectiveTrackedMilliseconds = Math.max(0, trackedMilliseconds - taskPanicMilliseconds);
			const averageRunMilliseconds = clippedRuns.length
				? Math.round(trackedMilliseconds / clippedRuns.length)
				: 0;

			return {
				selectedDay,
					summary: {
						trackedMilliseconds,
						effectiveTrackedMilliseconds,
						taskPanicMilliseconds,
						wallClockMilliseconds,
						overlapMilliseconds: Math.max(0, trackedMilliseconds - wallClockMilliseconds),
						runCount: clippedRuns.length,
						completedCount,
						pausedCount,
						panicMilliseconds,
						panicCount,
						longestPanicMilliseconds,
						tallyUnits,
						averageRunMilliseconds,
						longestRunMilliseconds
					},
				overlapBands: OVERLAP_BANDS.map((band) => ({
					key: band.key,
					label: band.label,
					milliseconds: overlapTotals[band.key]
				})),
				breakdown: [...breakdownByTaskId.values()]
					.sort((left, right) => right.totalMilliseconds - left.totalMilliseconds)
					.slice(0, BREAKDOWN_LIMIT),
					cadence: cadenceBuckets.map((bucket) => ({
						hour: bucket.hour,
						label: bucket.label,
						milliseconds: bucket.milliseconds
					})),
					panicLog,
					doneLog: clippedRuns
					.filter((taskRun) => taskRun.completedAt)
					.sort((left, right) => new Date(right.completedAt).getTime() - new Date(left.completedAt).getTime())
					.slice(0, DONE_LOG_LIMIT)
					.map((taskRun) => ({
						id: taskRun.id,
						taskId: taskRun.taskId,
						name: taskRun.name,
						color: taskRun.color,
						colorKey: taskRun.colorKey,
						mode: taskRun.mode,
						trackingType: taskRun.trackingType,
						tallyUnit: taskRun.tallyUnit,
						completedAt: taskRun.completedAt,
						spentMilliseconds: taskRun.spentMilliseconds,
						tallyCount: taskRun.tallyCount,
						instanceNote: taskRun.instanceNote ?? null
					})),
				sessionLog: clippedRuns
					.sort((left, right) => new Date(left.startedAt).getTime() - new Date(right.startedAt).getTime())
					.slice(0, SESSION_LOG_LIMIT)
			};
		}
	);
}

module.exports = dailyStatsRoute;
