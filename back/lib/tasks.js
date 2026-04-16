const { ObjectId } = require('mongodb');

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
const TASK_DURATION_VALUES = Object.freeze([5, 10, 15, 20, 30, 45, 60, 90, 120, 180]);
const TASK_SNOOZE_VALUES = Object.freeze([5, 10, 15, 20, 30]);

const serializedTaskJsonSchema = {
	type: 'object',
	required: [
		'id',
		'name',
		'color',
		'colorKey',
		'mode',
		'trackingType',
		'alarmEnabled',
		'durationMinutes',
		'snoozeMinutes',
		'tallyUnit',
		'tallyTarget',
		'activeTallyCount',
		'lastCompletedTallyCount',
		'note',
		'mappedToday',
		'mappedAt',
		'queuePosition',
		'activeToday',
		'activatedAt',
		'alarmDueAt',
		'panicMilliseconds',
		'panicMeasuredAt',
		'lastCompletedAt',
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
		alarmEnabled: { type: 'boolean' },
		durationMinutes: { type: ['integer', 'null'] },
		snoozeMinutes: { type: ['integer', 'null'] },
		tallyUnit: { type: ['string', 'null'] },
		tallyTarget: { type: ['integer', 'null'] },
		activeTallyCount: { type: 'integer' },
		lastCompletedTallyCount: { type: ['integer', 'null'] },
		note: { type: ['string', 'null'] },
		mappedToday: { type: 'boolean' },
		mappedAt: { type: ['string', 'null'] },
			queuePosition: { type: ['integer', 'null'] },
			activeToday: { type: 'boolean' },
			activatedAt: { type: ['string', 'null'] },
			alarmDueAt: { type: ['string', 'null'] },
			panicMilliseconds: { type: 'integer' },
			panicMeasuredAt: { type: ['string', 'null'] },
			lastCompletedAt: { type: ['string', 'null'] },
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
		'alarmEnabled',
		'durationMinutes',
		'snoozeMinutes',
		'tallyUnit',
		'tallyTarget',
		'activeTallyCount',
		'lastCompletedTallyCount',
		'note',
		'mappedToday',
		'mappedAt',
		'queuePosition',
			'activeToday',
			'activatedAt',
			'alarmDueAt',
			'panicMilliseconds',
			'lastCompletedAt',
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
		alarmEnabled: { type: 'boolean' },
		durationMinutes: { type: ['integer', 'null'] },
		snoozeMinutes: { type: ['integer', 'null'] },
		tallyUnit: { type: ['string', 'null'] },
		tallyTarget: { type: ['integer', 'null'] },
		activeTallyCount: { type: 'integer' },
		lastCompletedTallyCount: { type: ['integer', 'null'] },
		note: { type: ['string', 'null'] },
		mappedToday: { type: 'boolean' },
		mappedAt: { type: ['string', 'null'] },
			queuePosition: { type: ['integer', 'null'] },
			activeToday: { type: 'boolean' },
			activatedAt: { type: ['string', 'null'] },
			alarmDueAt: { type: ['string', 'null'] },
			panicMilliseconds: { type: 'integer' },
			lastCompletedAt: { type: ['string', 'null'] },
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

function isAllowedTaskDuration(durationMinutes) {
	return TASK_DURATION_VALUES.includes(durationMinutes);
}

function isAllowedTaskSnooze(snoozeMinutes) {
	return TASK_SNOOZE_VALUES.includes(snoozeMinutes);
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

function serializeTask(task) {
	return {
		id: task._id.toString(),
		name: task.name,
		color: task.colorHex,
		colorKey: task.colorKey,
		mode: task.mode,
		trackingType: task.trackingType || 'time',
		alarmEnabled: task.alarmEnabled,
		durationMinutes: task.durationMinutes ?? null,
		snoozeMinutes: task.snoozeMinutes ?? null,
		tallyUnit: task.tallyUnit ?? null,
		tallyTarget: Number.isInteger(task.tallyTarget) ? task.tallyTarget : null,
		activeTallyCount: Number.isInteger(task.activeTallyCount) ? task.activeTallyCount : 0,
		lastCompletedTallyCount: Number.isInteger(task.lastCompletedTallyCount)
			? task.lastCompletedTallyCount
			: null,
		note: task.note ?? null,
		mappedToday: task.mappedToday === true,
		mappedAt: task.mappedAt ? task.mappedAt.toISOString() : null,
			queuePosition: Number.isInteger(task.queuePosition) ? task.queuePosition : null,
			activeToday: task.activeToday,
			activatedAt: task.activatedAt ? task.activatedAt.toISOString() : null,
			alarmDueAt: task.alarmDueAt ? task.alarmDueAt.toISOString() : null,
			panicMilliseconds: Number.isInteger(task.panicMilliseconds) ? task.panicMilliseconds : 0,
			panicMeasuredAt: task.panicMeasuredAt ? task.panicMeasuredAt.toISOString() : null,
			lastCompletedAt: task.lastCompletedAt ? task.lastCompletedAt.toISOString() : null,
			lastInactivatedAt: task.lastInactivatedAt ? task.lastInactivatedAt.toISOString() : null,
		createdAt: task.createdAt.toISOString(),
		updatedAt: task.updatedAt.toISOString()
	};
}

module.exports = {
	TASK_COLOR_MAP,
	TASK_DURATION_VALUES,
	TASK_MODE_VALUES,
	TASK_SNOOZE_VALUES,
	TASK_TRACKING_TYPE_VALUES,
	findOwnedTask,
	isAllowedTaskColor,
	isAllowedTaskDuration,
	isAllowedTaskMode,
	isAllowedTaskSnooze,
	isAllowedTaskTrackingType,
	serializedCompletedTaskJsonSchema,
	serializedTaskJsonSchema,
	toObjectId,
	serializeTask
};
