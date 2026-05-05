const { ObjectId } = require('mongodb');

const { serializedPanicLogItemJsonSchema } = require('./panic');
const { getLocalWeekdayIndex, getUtcRangeForLocalDay } = require('./local-days');

const TASK_COLOR_MAP = Object.freeze({
	red: '#c74a4a',
	orange: '#de7d37',
	gold: '#d7b23d',
	green: '#5f9b55',
	teal: '#3d9790',
	blue: '#4f6ed6',
	violet: '#8a5bd1'
});

const TASK_MODE_VALUES = Object.freeze(['one-time', 'repeatable']);
const TASK_TRACKING_TYPE_VALUES = Object.freeze(['time', 'tally']);
const TASK_WEEKDAY_VALUES = Object.freeze([0, 1, 2, 3, 4, 5, 6]);

const serializedTaskJsonSchema = {
	type: 'object',
	required: [
		'id',
		'name',
		'color',
		'colorKey',
		'mode',
		'trackingType',
		'tallyUnit',
		'tallyTarget',
		'activeTallyCount',
		'lastCompletedTallyCount',
		'note',
		'instanceNote',
		'daymapLocked',
		'daymapWeekdays',
		'scheduledToday',
		'mappedToday',
		'mappedAt',
		'queuePosition',
		'activeToday',
		'activatedAt',
		'startedToday',
		'panicMilliseconds',
		'panicMeasuredAt',
		'effectiveMilliseconds',
		'taskPanicLog',
		'nextDueAt',
		'lastCompletedAt',
		'lastStartedAt',
		'lastInactivatedAt',
		'createdAt',
		'updatedAt'
	],
	properties: {
		id: { type: 'string' },
		name: { type: 'string' },
		color: { type: 'string' },
		colorKey: { type: 'string' },
		mode: { type: 'string' },
		trackingType: { type: 'string' },
		tallyUnit: { type: ['string', 'null'] },
		tallyTarget: { type: ['integer', 'null'] },
		activeTallyCount: { type: 'integer' },
		lastCompletedTallyCount: { type: ['integer', 'null'] },
		note: { type: ['string', 'null'] },
		instanceNote: { type: ['string', 'null'] },
		daymapLocked: { type: 'boolean' },
		daymapWeekdays: {
			type: 'array',
			items: {
				type: 'integer',
				minimum: 0,
				maximum: 6
			}
		},
		scheduledToday: { type: 'boolean' },
		mappedToday: { type: 'boolean' },
		mappedAt: { type: ['string', 'null'] },
		queuePosition: { type: ['integer', 'null'] },
		activeToday: { type: 'boolean' },
		activatedAt: { type: ['string', 'null'] },
		startedToday: { type: 'boolean' },
		panicMilliseconds: { type: 'integer' },
		panicMeasuredAt: { type: ['string', 'null'] },
		effectiveMilliseconds: { type: 'integer' },
		taskPanicLog: {
			type: 'array',
			items: serializedPanicLogItemJsonSchema
		},
		nextDueAt: { type: ['string', 'null'] },
		lastCompletedAt: { type: ['string', 'null'] },
		lastStartedAt: { type: ['string', 'null'] },
		lastInactivatedAt: { type: ['string', 'null'] },
		createdAt: { type: 'string' },
		updatedAt: { type: 'string' }
	}
};

const serializedCompletedTaskJsonSchema = {
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
		'tallyTarget',
		'activeTallyCount',
		'lastCompletedTallyCount',
		'note',
		'instanceNote',
		'daymapLocked',
		'daymapWeekdays',
		'scheduledToday',
		'mappedToday',
		'mappedAt',
		'queuePosition',
		'activeToday',
		'activatedAt',
		'startedToday',
		'panicMilliseconds',
		'effectiveMilliseconds',
		'taskPanicLog',
		'nextDueAt',
		'lastCompletedAt',
		'lastStartedAt',
		'lastInactivatedAt',
		'createdAt',
		'updatedAt',
		'completedAt',
		'startedAt',
		'endedAt',
		'spentMilliseconds',
		'tallyCount'
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
		tallyTarget: { type: ['integer', 'null'] },
		activeTallyCount: { type: 'integer' },
		lastCompletedTallyCount: { type: ['integer', 'null'] },
		note: { type: ['string', 'null'] },
		instanceNote: { type: ['string', 'null'] },
		daymapLocked: { type: 'boolean' },
		daymapWeekdays: {
			type: 'array',
			items: {
				type: 'integer',
				minimum: 0,
				maximum: 6
			}
		},
		scheduledToday: { type: 'boolean' },
		mappedToday: { type: 'boolean' },
		mappedAt: { type: ['string', 'null'] },
		queuePosition: { type: ['integer', 'null'] },
		activeToday: { type: 'boolean' },
		activatedAt: { type: ['string', 'null'] },
		startedToday: { type: 'boolean' },
		panicMilliseconds: { type: 'integer' },
		effectiveMilliseconds: { type: 'integer' },
		taskPanicLog: {
			type: 'array',
			items: serializedPanicLogItemJsonSchema
		},
		nextDueAt: { type: ['string', 'null'] },
		lastCompletedAt: { type: ['string', 'null'] },
		lastStartedAt: { type: ['string', 'null'] },
		lastInactivatedAt: { type: ['string', 'null'] },
		createdAt: { type: 'string' },
		updatedAt: { type: 'string' },
		completedAt: { type: 'string' },
		startedAt: { type: 'string' },
		endedAt: { type: 'string' },
		spentMilliseconds: { type: 'integer' },
		tallyCount: { type: ['integer', 'null'] }
	}
};

function isAllowedTaskColor(color) {
	return Object.hasOwn(TASK_COLOR_MAP, color);
}

function isAllowedTaskMode(mode) {
	return TASK_MODE_VALUES.includes(mode);
}

function isAllowedTaskTrackingType(trackingType) {
	return TASK_TRACKING_TYPE_VALUES.includes(trackingType);
}

function normalizeTaskWeekdays(value) {
	if (!Array.isArray(value)) {
		return [];
	}

	return [...new Set(value)]
		.filter((weekday) => Number.isInteger(weekday) && TASK_WEEKDAY_VALUES.includes(weekday))
		.sort((left, right) => left - right);
}

function areTaskWeekdaysEqual(left, right) {
	const normalizedLeft = normalizeTaskWeekdays(left);
	const normalizedRight = normalizeTaskWeekdays(right);

	return (
		normalizedLeft.length === normalizedRight.length &&
		normalizedLeft.every((weekday, index) => weekday === normalizedRight[index])
	);
}

function isTaskScheduledForWeekday(task, weekdayIndex) {
	return normalizeTaskWeekdays(task.daymapWeekdays).includes(weekdayIndex);
}

function toObjectId(value) {
	return value instanceof ObjectId ? value : new ObjectId(value);
}

async function findOwnedTask(db, { taskId, userId }) {
	return db.collection('tasks').findOne({
		_id: toObjectId(taskId),
		userId: toObjectId(userId)
	});
}

async function decorateTasksForLocalDay(db, { tasks, userId, day, timezoneOffsetMinutes }) {
	if (!Array.isArray(tasks) || tasks.length === 0) {
		return [];
	}

	const weekdayIndex = getLocalWeekdayIndex(day);
	const { startedAt, endedBefore } = getUtcRangeForLocalDay(day, timezoneOffsetMinutes);
	const taskIds = tasks.map((task) => task._id);
	const startedRuns = await db
		.collection('task_runs')
		.aggregate([
			{
				$match: {
					userId: toObjectId(userId),
					taskId: {
						$in: taskIds
					},
					startedAt: {
						$gte: startedAt,
						$lt: endedBefore
					}
				}
			},
			{
				$group: {
					_id: '$taskId',
					lastStartedAt: {
						$max: '$startedAt'
					}
				}
			}
		])
		.toArray();
	const lastStartedAtByTaskId = new Map(
		startedRuns.map((taskRun) => [taskRun._id.toString(), taskRun.lastStartedAt])
	);

	return tasks.map((task) => {
		const lastStartedAt = lastStartedAtByTaskId.get(task._id.toString()) ?? task.lastStartedAt ?? null;

		return {
			...task,
			scheduledToday: isTaskScheduledForWeekday(task, weekdayIndex),
			startedToday: lastStartedAtByTaskId.has(task._id.toString()),
			lastStartedAt
		};
	});
}

function serializeTask(task) {
	return {
		id: task._id.toString(),
		name: task.name,
		color: task.colorHex,
		colorKey: task.colorKey,
		mode: task.mode,
		trackingType: task.trackingType || 'time',
		tallyUnit: task.tallyUnit ?? null,
		tallyTarget: Number.isInteger(task.tallyTarget) ? task.tallyTarget : null,
		activeTallyCount: Number.isInteger(task.activeTallyCount) ? task.activeTallyCount : 0,
		lastCompletedTallyCount: Number.isInteger(task.lastCompletedTallyCount)
			? task.lastCompletedTallyCount
			: null,
		note: task.note ?? null,
		instanceNote: task.instanceNote ?? null,
		daymapLocked: task.daymapLocked === true,
		daymapWeekdays: normalizeTaskWeekdays(task.daymapWeekdays),
		scheduledToday: task.scheduledToday === true,
		mappedToday: task.mappedToday === true,
		mappedAt: task.mappedAt ? task.mappedAt.toISOString() : null,
		queuePosition: Number.isInteger(task.queuePosition) ? task.queuePosition : null,
		activeToday: task.activeToday,
		activatedAt: task.activatedAt ? task.activatedAt.toISOString() : null,
		startedToday: task.startedToday === true,
		panicMilliseconds: Number.isInteger(task.panicMilliseconds) ? task.panicMilliseconds : 0,
		panicMeasuredAt: task.panicMeasuredAt ? task.panicMeasuredAt.toISOString() : null,
		effectiveMilliseconds: Number.isInteger(task.effectiveMilliseconds)
			? task.effectiveMilliseconds
			: 0,
		taskPanicLog: Array.isArray(task.taskPanicLog) ? task.taskPanicLog : [],
		nextDueAt: task.nextDueAt ? task.nextDueAt.toISOString() : null,
		lastCompletedAt: task.lastCompletedAt ? task.lastCompletedAt.toISOString() : null,
		lastStartedAt: task.lastStartedAt ? task.lastStartedAt.toISOString() : null,
		lastInactivatedAt: task.lastInactivatedAt ? task.lastInactivatedAt.toISOString() : null,
		createdAt: task.createdAt.toISOString(),
		updatedAt: task.updatedAt.toISOString()
	};
}

module.exports = {
	TASK_COLOR_MAP,
	TASK_MODE_VALUES,
	TASK_TRACKING_TYPE_VALUES,
	TASK_WEEKDAY_VALUES,
	areTaskWeekdaysEqual,
	decorateTasksForLocalDay,
	findOwnedTask,
	isAllowedTaskColor,
	isAllowedTaskMode,
	isAllowedTaskTrackingType,
	isTaskScheduledForWeekday,
	normalizeTaskWeekdays,
	serializedCompletedTaskJsonSchema,
	serializedTaskJsonSchema,
	toObjectId,
	serializeTask
};
