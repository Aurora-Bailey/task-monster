const { ObjectId } = require('mongodb');

const { updateOpenTaskRunFields } = require('../../lib/task-runs');
const {
	TASK_COLOR_MAP,
	TASK_MODE_VALUES,
	TASK_TRACKING_TYPE_VALUES,
	TASK_WEEKDAY_VALUES,
	areTaskWeekdaysEqual,
	findOwnedTask,
	normalizeTaskIntensity,
	normalizeTaskWeekdays,
	serializedTaskJsonSchema,
	serializeTask
} = require('../../lib/tasks');

const updateTaskSchema = {
	params: {
		type: 'object',
		required: ['taskId'],
		properties: {
			taskId: { type: 'string' }
		}
	},
	body: {
		type: 'object',
		additionalProperties: false,
		properties: {
			name: {
				type: 'string',
				minLength: 1,
				maxLength: 120
			},
			color: {
				type: 'string',
				enum: [...Object.keys(TASK_COLOR_MAP)]
			},
			mode: {
				type: 'string',
				enum: [...TASK_MODE_VALUES]
			},
			trackingType: {
				type: 'string',
				enum: [...TASK_TRACKING_TYPE_VALUES]
			},
			tallyUnit: {
				type: ['string', 'null'],
				maxLength: 60
			},
			tallyTarget: {
				type: ['integer', 'null'],
				minimum: 1,
				maximum: 100000
			},
			activeTallyCount: {
				type: 'integer',
				minimum: 0,
				maximum: 1000000
			},
			note: {
				type: ['string', 'null'],
				maxLength: 2000
			},
			intensity: {
				type: 'integer',
				minimum: 1,
				maximum: 100
			},
			nextDueAt: {
				type: ['string', 'null'],
				format: 'date-time'
			},
			daymapLocked: {
				type: 'boolean'
			},
			daymapWeekdays: {
				type: 'array',
				maxItems: 7,
				uniqueItems: true,
				items: {
					type: 'integer',
					enum: [...TASK_WEEKDAY_VALUES]
				}
			},
			startedAt: {
				type: 'string',
				format: 'date-time'
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

async function updateTaskRoute(app) {
	app.patch(
		'/tasks/:taskId',
		{
			schema: updateTaskSchema
		},
		async (request, reply) => {
			const { taskId } = request.params;

			if (!ObjectId.isValid(taskId)) {
				return reply.code(400).send({
					message: 'Invalid task id.'
				});
			}

			if (Object.keys(request.body || {}).length === 0) {
				return reply.code(400).send({
					message: 'No task changes were provided.'
				});
			}

			const task = await findOwnedTask(app.mongo.db, {
				taskId,
				userId: request.auth.userId
			});

			if (!task) {
				return reply.code(404).send({
					message: 'Task not found.'
				});
			}

			const changes = [];
			const updatedAt = new Date();
			const nextTask = {
				...task,
				intensity: normalizeTaskIntensity(task.intensity)
			};
			const providedTallyUnit = Object.hasOwn(request.body, 'tallyUnit');
			const providedTallyTarget = Object.hasOwn(request.body, 'tallyTarget');
			const providedActiveTallyCount = Object.hasOwn(request.body, 'activeTallyCount');
			const providedIntensity = Object.hasOwn(request.body, 'intensity');
			const providedNextDueAt = Object.hasOwn(request.body, 'nextDueAt');
			const providedDaymapWeekdays = Object.hasOwn(request.body, 'daymapWeekdays');

			if (typeof request.body.name === 'string') {
				const nextName = request.body.name.trim();

				if (!nextName) {
					return reply.code(400).send({
						message: 'Task name cannot be empty.'
					});
				}

				if (nextName !== task.name) {
					nextTask.name = nextName;
					changes.push({
						field: 'task name',
						label: 'Changed: task name',
						value: `"${nextName}"`
					});
				}
			}

			if (typeof request.body.color === 'string' && request.body.color !== task.colorKey) {
				nextTask.colorKey = request.body.color;
				nextTask.colorHex = TASK_COLOR_MAP[request.body.color];
				changes.push({
					field: 'category',
					label: 'Changed: category',
					value: request.body.color
				});
			}

			if (typeof request.body.mode === 'string' && request.body.mode !== task.mode) {
				nextTask.mode = request.body.mode;
				changes.push({
					field: 'mode',
					label: 'Changed: mode',
					value: request.body.mode
				});
			}

			if (Object.hasOwn(request.body, 'note') && request.body.note !== (task.note ?? null)) {
				nextTask.note = typeof request.body.note === 'string' ? request.body.note : null;
				changes.push({
					field: 'task note',
					label: 'Changed: task note',
					value: nextTask.note ? `"${nextTask.note}"` : 'cleared'
				});
			}

			if (providedIntensity) {
				const nextIntensity = normalizeTaskIntensity(request.body.intensity);

				if (nextIntensity !== normalizeTaskIntensity(task.intensity)) {
					nextTask.intensity = nextIntensity;
					changes.push({
						field: 'intensity',
						label: 'Changed: intensity',
						value: String(nextIntensity)
					});
				}
			}

			if (providedNextDueAt) {
				let nextDueAt = null;

				if (typeof request.body.nextDueAt === 'string') {
					nextDueAt = new Date(request.body.nextDueAt);

					if (Number.isNaN(nextDueAt.getTime())) {
						return reply.code(400).send({
							message: 'Next due time is not valid.'
						});
					}
				}

				const currentNextDueAtTime =
					task.nextDueAt instanceof Date ? task.nextDueAt.getTime() : null;
				const nextDueAtTime = nextDueAt instanceof Date ? nextDueAt.getTime() : null;

				if (currentNextDueAtTime !== nextDueAtTime) {
					nextTask.nextDueAt = nextDueAt;
					changes.push({
						field: 'next due',
						label: 'Changed: next due',
						value: nextDueAt ? nextDueAt.toISOString() : 'cleared'
					});
				}
			}

			if (Object.hasOwn(request.body, 'daymapLocked') && request.body.daymapLocked !== (task.daymapLocked === true)) {
				nextTask.daymapLocked = request.body.daymapLocked;
				changes.push({
					field: 'daymap lock',
					label: 'Changed: daymap lock',
					value: request.body.daymapLocked ? 'locked' : 'unlocked'
				});
			}

			if (providedDaymapWeekdays) {
				const nextDaymapWeekdays = normalizeTaskWeekdays(request.body.daymapWeekdays);

				if (!areTaskWeekdaysEqual(nextDaymapWeekdays, task.daymapWeekdays)) {
					nextTask.daymapWeekdays = nextDaymapWeekdays;
					changes.push({
						field: 'daymap schedule',
						label: 'Changed: daymap schedule',
						value: nextDaymapWeekdays.length > 0 ? nextDaymapWeekdays.join(',') : 'cleared'
					});
				}
			}

			if (typeof request.body.trackingType === 'string' && request.body.trackingType !== (task.trackingType || 'time')) {
				nextTask.trackingType = request.body.trackingType;
				changes.push({
					field: 'tracking type',
					label: 'Changed: tracking type',
					value: request.body.trackingType
				});
			}

			const nextTrackingType = nextTask.trackingType || 'time';

			if (nextTrackingType === 'time' && (providedTallyUnit || providedTallyTarget || providedActiveTallyCount)) {
				return reply.code(400).send({
					message: 'Time tasks do not use tally fields.'
				});
			}

			if (nextTrackingType === 'tally') {
				const nextTallyUnit = providedTallyUnit
					? typeof request.body.tallyUnit === 'string'
						? request.body.tallyUnit.trim()
						: ''
					: nextTask.tallyUnit ?? '';
				const nextTallyTarget = providedTallyTarget
					? request.body.tallyTarget
					: nextTask.tallyTarget;

				if (!nextTallyUnit) {
					return reply.code(400).send({
						message: 'Tally tasks need a unit label.'
					});
				}

				if (!Number.isInteger(nextTallyTarget) || nextTallyTarget < 1) {
					return reply.code(400).send({
						message: 'Tally tasks need a valid target.'
					});
				}

				if (nextTallyUnit !== (task.tallyUnit ?? '')) {
					changes.push({
						field: 'tally unit',
						label: 'Changed: tally unit',
						value: nextTallyUnit
					});
				}

				if (nextTallyTarget !== task.tallyTarget) {
					changes.push({
						field: 'tally target',
						label: 'Changed: tally target',
						value: String(nextTallyTarget)
					});
				}

				nextTask.tallyUnit = nextTallyUnit;
				nextTask.tallyTarget = nextTallyTarget;

				if (providedActiveTallyCount) {
					nextTask.activeTallyCount = request.body.activeTallyCount;
					changes.push({
						field: 'active tally',
						label: 'Changed: active tally',
						value: String(request.body.activeTallyCount)
					});
				}
			} else {
				nextTask.tallyUnit = null;
				nextTask.tallyTarget = null;
				nextTask.activeTallyCount = 0;
			}

			let updatedOpenTaskRun = null;
			const openRunPatch = {};

			if (Object.hasOwn(request.body, 'startedAt')) {
				if (task.activeToday !== true) {
					return reply.code(409).send({
						message: 'Only active tasks can have their started time updated.'
					});
				}

				const parsedStartedAt = new Date(request.body.startedAt);

				if (Number.isNaN(parsedStartedAt.getTime())) {
					return reply.code(400).send({
						message: 'Started time is not valid.'
					});
				}

				const clampedStartedAt = new Date(Math.min(parsedStartedAt.getTime(), updatedAt.getTime()));
				nextTask.activatedAt = clampedStartedAt;
				nextTask.lastStartedAt = clampedStartedAt;
				openRunPatch.startedAt = clampedStartedAt;
				changes.push({
					field: 'started time',
					label: 'Changed: started time',
					value: clampedStartedAt.toISOString()
				});
			}

			if (task.activeToday === true && nextTrackingType !== (task.trackingType || 'time')) {
				openRunPatch.trackingType = nextTrackingType;
				openRunPatch.tallyUnit = nextTrackingType === 'tally' ? nextTask.tallyUnit : null;
				openRunPatch.tallyTarget = nextTrackingType === 'tally' ? nextTask.tallyTarget : null;
				openRunPatch.tallyCount = nextTrackingType === 'tally' ? nextTask.activeTallyCount : null;
				openRunPatch.startTallyCount = nextTrackingType === 'tally' ? nextTask.activeTallyCount : null;
			} else if (task.activeToday === true && nextTrackingType === 'tally') {
				if (providedActiveTallyCount) {
					openRunPatch.tallyCount = nextTask.activeTallyCount;
				}

				if (providedTallyUnit) {
					openRunPatch.tallyUnit = nextTask.tallyUnit;
				}

				if (providedTallyTarget) {
					openRunPatch.tallyTarget = nextTask.tallyTarget;
				}
			}

			const taskUpdate = {
				name: nextTask.name,
				colorKey: nextTask.colorKey,
				colorHex: nextTask.colorHex,
				mode: nextTask.mode,
				trackingType: nextTrackingType,
				tallyUnit: nextTask.tallyUnit,
				tallyTarget: nextTask.tallyTarget,
				activeTallyCount: nextTask.activeTallyCount,
				note: nextTask.note ?? null,
				intensity: normalizeTaskIntensity(nextTask.intensity),
				nextDueAt: nextTask.nextDueAt ?? null,
				daymapLocked: nextTask.daymapLocked === true,
				daymapWeekdays: normalizeTaskWeekdays(nextTask.daymapWeekdays),
				activatedAt: nextTask.activatedAt ?? null,
				lastStartedAt: nextTask.lastStartedAt ?? null,
				updatedAt
			};

			const result = await app.mongo.db.collection('tasks').findOneAndUpdate(
				{
					_id: task._id,
					userId: task.userId
				},
				{
					$set: taskUpdate
				},
				{
					returnDocument: 'after'
				}
			);

			if (!result) {
				return reply.code(409).send({
					message: 'Task could not be updated.'
				});
			}

			if (Object.keys(openRunPatch).length > 0) {
				updatedOpenTaskRun = await updateOpenTaskRunFields(app.mongo.db, {
					userId: request.auth.userId,
					taskId,
					fields: openRunPatch,
					updatedAt
				});

				if (!updatedOpenTaskRun) {
					return reply.code(409).send({
						message: 'Active run could not be updated.'
					});
				}
			}

			return {
				task: serializeTask({
					...result,
					instanceNote: updatedOpenTaskRun?.instanceNote ?? task.instanceNote ?? null
				}),
				changes
			};
		}
	);
}

module.exports = updateTaskRoute;
