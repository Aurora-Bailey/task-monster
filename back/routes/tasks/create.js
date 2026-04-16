const { ObjectId } = require('mongodb');

const {
	TASK_COLOR_MAP,
	TASK_DURATION_VALUES,
	TASK_MODE_VALUES,
	TASK_SNOOZE_VALUES,
	TASK_TRACKING_TYPE_VALUES,
	isAllowedTaskColor,
	isAllowedTaskDuration,
	isAllowedTaskMode,
	isAllowedTaskSnooze,
	isAllowedTaskTrackingType,
	serializedTaskJsonSchema,
	serializeTask
} = require('../../lib/tasks');

const createTaskSchema = {
	body: {
		type: 'object',
		required: ['name', 'color', 'mode', 'alarmEnabled'],
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
			alarmEnabled: {
				type: 'boolean'
			},
			durationMinutes: {
				type: ['integer', 'null'],
				enum: [...TASK_DURATION_VALUES, null]
			},
			snoozeMinutes: {
				type: ['integer', 'null'],
				enum: [...TASK_SNOOZE_VALUES, null]
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
			note: {
				type: ['string', 'null'],
				maxLength: 2000
			}
		}
	},
	response: {
		201: {
			type: 'object',
			required: ['task'],
			properties: {
				task: {
					...serializedTaskJsonSchema
				}
			}
		}
	}
};

async function createTaskRoute(app) {
	app.post(
		'/tasks',
		{
			schema: createTaskSchema
		},
		async (request, reply) => {
			const name = request.body.name.trim();
			const color = request.body.color;
			const mode = request.body.mode;
			const trackingType = request.body.trackingType || 'time';
			const alarmEnabled = request.body.alarmEnabled;
			const note = typeof request.body.note === 'string' ? request.body.note : null;

			if (!name) {
				return reply.code(400).send({
					message: 'Task name cannot be empty.'
				});
			}

			if (!isAllowedTaskColor(color)) {
				return reply.code(400).send({
					message: 'Task color is not supported.'
				});
			}

			if (!isAllowedTaskMode(mode)) {
				return reply.code(400).send({
					message: 'Task mode is not supported.'
				});
			}

			if (!isAllowedTaskTrackingType(trackingType)) {
				return reply.code(400).send({
					message: 'Task tracking type is not supported.'
				});
			}

			let durationMinutes = null;
			let snoozeMinutes = null;
			let tallyUnit = null;
			let tallyTarget = null;

			if (trackingType === 'time' && alarmEnabled) {
				durationMinutes = request.body.durationMinutes;
				snoozeMinutes = request.body.snoozeMinutes;

				if (!isAllowedTaskDuration(durationMinutes)) {
					return reply.code(400).send({
						message: 'Task length is not supported.'
					});
				}

				if (!isAllowedTaskSnooze(snoozeMinutes)) {
					return reply.code(400).send({
						message: 'Snooze length is not supported.'
					});
				}
			}

			if (trackingType === 'tally') {
				if (alarmEnabled) {
					return reply.code(400).send({
						message: 'Tally tasks do not use alarms.'
					});
				}

				tallyUnit = typeof request.body.tallyUnit === 'string' ? request.body.tallyUnit.trim() : '';
				tallyTarget = request.body.tallyTarget;

				if (!tallyUnit) {
					return reply.code(400).send({
						message: 'Tally tasks need a unit label.'
					});
				}

				if (!Number.isInteger(tallyTarget) || tallyTarget < 1) {
					return reply.code(400).send({
						message: 'Tally tasks need a valid target.'
					});
				}
			}

			const createdAt = new Date();
			const task = {
				userId: new ObjectId(request.auth.userId),
				name,
				colorKey: color,
				colorHex: TASK_COLOR_MAP[color],
				mode,
				trackingType,
				alarmEnabled: trackingType === 'time' ? alarmEnabled : false,
				durationMinutes,
				snoozeMinutes,
				tallyUnit,
				tallyTarget,
				activeTallyCount: 0,
				lastCompletedTallyCount: null,
				note,
				mappedToday: false,
				mappedAt: null,
				queuePosition: null,
				activeToday: false,
				activatedAt: null,
				alarmDueAt: null,
				lastCompletedAt: null,
				lastInactivatedAt: null,
				archived: false,
				createdAt,
				updatedAt: createdAt
			};

			const result = await app.mongo.db.collection('tasks').insertOne(task);

			return reply.code(201).send({
				task: serializeTask({
					...task,
					_id: result.insertedId
				})
			});
		}
	);
}

module.exports = createTaskRoute;
