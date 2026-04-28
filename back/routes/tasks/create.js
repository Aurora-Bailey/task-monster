const { ObjectId } = require('mongodb');

const { POMODORO_PRESET_KEYS, getPomodoroPreset, isValidPomodoroPresetKey } = require('../../lib/pomodoro');
const {
	TASK_COLOR_MAP,
	TASK_MODE_VALUES,
	TASK_TRACKING_TYPE_VALUES,
	isAllowedTaskColor,
	isAllowedTaskMode,
	isAllowedTaskTrackingType,
	serializedTaskJsonSchema,
	serializeTask
} = require('../../lib/tasks');

const createTaskSchema = {
	body: {
		type: 'object',
		required: ['name', 'color', 'mode'],
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
			pomodoroPreset: {
				type: ['string', 'null'],
				enum: [...POMODORO_PRESET_KEYS, null]
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
			const hasPomodoroPreset = Object.hasOwn(request.body, 'pomodoroPreset');
			const pomodoroPresetKey = hasPomodoroPreset
				? request.body.pomodoroPreset
				: 'medium';
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

			let pomodoro = null;
			let tallyUnit = null;
			let tallyTarget = null;

			if (trackingType === 'time') {
				if (pomodoroPresetKey !== null && !isValidPomodoroPresetKey(pomodoroPresetKey)) {
					return reply.code(400).send({
						message: 'Pomodoro preset is not supported.'
					});
				}

				pomodoro = pomodoroPresetKey === null ? null : getPomodoroPreset(pomodoroPresetKey);
			}

			if (trackingType === 'tally') {
				if (request.body.pomodoroPreset !== undefined && request.body.pomodoroPreset !== null) {
					return reply.code(400).send({
						message: 'Tally tasks do not use pomodoro presets.'
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
				pomodoro,
				tallyUnit,
				tallyTarget,
				activeTallyCount: 0,
				lastCompletedTallyCount: null,
				note,
				daymapLocked: false,
				mappedToday: false,
				mappedAt: null,
				queuePosition: null,
				activeToday: false,
				activatedAt: null,
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
