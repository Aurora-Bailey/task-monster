const { ObjectId } = require('mongodb');

const { serializedPanicLogItemJsonSchema } = require('./panic');

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
		'mappedToday',
		'mappedAt',
		'queuePosition',
		'activeToday',
		'activatedAt',
		'panicMilliseconds',
		'panicMeasuredAt',
		'effectiveMilliseconds',
		'taskPanicLog',
		'nextDueAt',
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
		tallyUnit: { type: ['string', 'null'] },
		tallyTarget: { type: ['integer', 'null'] },
		activeTallyCount: { type: 'integer' },
		lastCompletedTallyCount: { type: ['integer', 'null'] },
		note: { type: ['string', 'null'] },
		instanceNote: { type: ['string', 'null'] },
		daymapLocked: { type: 'boolean' },
		mappedToday: { type: 'boolean' },
		mappedAt: { type: ['string', 'null'] },
		queuePosition: { type: ['integer', 'null'] },
		activeToday: { type: 'boolean' },
		activatedAt: { type: ['string', 'null'] },
		panicMilliseconds: { type: 'integer' },
		panicMeasuredAt: { type: ['string', 'null'] },
		effectiveMilliseconds: { type: 'integer' },
		taskPanicLog: {
			type: 'array',
			items: serializedPanicLogItemJsonSchema
		},
		nextDueAt: { type: ['string', 'null'] },
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
		'tallyUnit',
		'tallyTarget',
		'activeTallyCount',
		'lastCompletedTallyCount',
		'note',
		'instanceNote',
		'daymapLocked',
		'mappedToday',
		'mappedAt',
		'queuePosition',
		'activeToday',
		'activatedAt',
		'panicMilliseconds',
		'effectiveMilliseconds',
		'taskPanicLog',
		'nextDueAt',
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
		tallyUnit: { type: ['string', 'null'] },
		tallyTarget: { type: ['integer', 'null'] },
		activeTallyCount: { type: 'integer' },
		lastCompletedTallyCount: { type: ['integer', 'null'] },
		note: { type: ['string', 'null'] },
		instanceNote: { type: ['string', 'null'] },
		daymapLocked: { type: 'boolean' },
		mappedToday: { type: 'boolean' },
		mappedAt: { type: ['string', 'null'] },
		queuePosition: { type: ['integer', 'null'] },
		activeToday: { type: 'boolean' },
		activatedAt: { type: ['string', 'null'] },
		panicMilliseconds: { type: 'integer' },
		effectiveMilliseconds: { type: 'integer' },
		taskPanicLog: {
			type: 'array',
			items: serializedPanicLogItemJsonSchema
		},
		nextDueAt: { type: ['string', 'null'] },
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
		tallyUnit: task.tallyUnit ?? null,
		tallyTarget: Number.isInteger(task.tallyTarget) ? task.tallyTarget : null,
		activeTallyCount: Number.isInteger(task.activeTallyCount) ? task.activeTallyCount : 0,
		lastCompletedTallyCount: Number.isInteger(task.lastCompletedTallyCount)
			? task.lastCompletedTallyCount
			: null,
		note: task.note ?? null,
		instanceNote: task.instanceNote ?? null,
		daymapLocked: task.daymapLocked === true,
		mappedToday: task.mappedToday === true,
		mappedAt: task.mappedAt ? task.mappedAt.toISOString() : null,
		queuePosition: Number.isInteger(task.queuePosition) ? task.queuePosition : null,
		activeToday: task.activeToday,
		activatedAt: task.activatedAt ? task.activatedAt.toISOString() : null,
		panicMilliseconds: Number.isInteger(task.panicMilliseconds) ? task.panicMilliseconds : 0,
		panicMeasuredAt: task.panicMeasuredAt ? task.panicMeasuredAt.toISOString() : null,
		effectiveMilliseconds: Number.isInteger(task.effectiveMilliseconds)
			? task.effectiveMilliseconds
			: 0,
		taskPanicLog: Array.isArray(task.taskPanicLog) ? task.taskPanicLog : [],
		nextDueAt: task.nextDueAt ? task.nextDueAt.toISOString() : null,
		lastCompletedAt: task.lastCompletedAt ? task.lastCompletedAt.toISOString() : null,
		lastInactivatedAt: task.lastInactivatedAt ? task.lastInactivatedAt.toISOString() : null,
		createdAt: task.createdAt.toISOString(),
		updatedAt: task.updatedAt.toISOString()
	};
}

module.exports = {
	TASK_COLOR_MAP,
	TASK_MODE_VALUES,
	TASK_TRACKING_TYPE_VALUES,
	findOwnedTask,
	isAllowedTaskColor,
	isAllowedTaskMode,
	isAllowedTaskTrackingType,
	serializedCompletedTaskJsonSchema,
	serializedTaskJsonSchema,
	toObjectId,
	serializeTask
};
