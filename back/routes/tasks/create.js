const { ObjectId } = require('mongodb');

const {
	DEFAULT_TASK_INTENSITY,
	TASK_COLOR_MAP,
	TASK_MODE_VALUES,
	TASK_TRACKING_TYPE_VALUES,
	TASK_WEEKDAY_VALUES,
	isAllowedTaskColor,
	isAllowedTaskMode,
	isAllowedTaskTrackingType,
	normalizeTaskWeekdays,
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
			daymapWeekdays: {
				type: 'array',
				maxItems: 7,
				uniqueItems: true,
				items: {
					type: 'integer',
					enum: [...TASK_WEEKDAY_VALUES]
				}
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
			const note = typeof request.body.note === 'string' ? request.body.note : null;
			const intensity = Number.isInteger(request.body.intensity)
				? request.body.intensity
				: DEFAULT_TASK_INTENSITY;
			const nextDueAtInput = request.body.nextDueAt;
			const daymapWeekdays = normalizeTaskWeekdays(request.body.daymapWeekdays);

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

			let tallyUnit = null;
			let tallyTarget = null;
			let nextDueAt = null;

			if (typeof nextDueAtInput === 'string') {
				const parsedNextDueAt = new Date(nextDueAtInput);

				if (Number.isNaN(parsedNextDueAt.getTime())) {
					return reply.code(400).send({
						message: 'Next due time is not valid.'
					});
				}

				nextDueAt = parsedNextDueAt;
			}

			if (trackingType === 'tally') {
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
				tallyUnit,
				tallyTarget,
				activeTallyCount: 0,
				lastCompletedTallyCount: null,
				nextDueAt,
				note,
				intensity,
				daymapLocked: false,
				daymapWeekdays,
				mappedToday: false,
				mappedAt: null,
				skippedLocalDay: null,
				skippedAt: null,
				queuePosition: null,
				activeToday: false,
				activatedAt: null,
				lastCompletedAt: null,
				lastStartedAt: null,
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
