const { ObjectId } = require('mongodb');

const {
	buildPanicStatus,
	loadOpenPanicRuns,
	loadPanicRunsOverlappingLocalDay,
	serializedPanicStatusJsonSchema
} = require('../../lib/panic');
const {
	getCurrentLocalDay,
	isValidDayString,
	parseTimezoneOffsetMinutes
} = require('../../lib/local-days');

const panicActionBodySchema = {
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
};

async function startPanicRoute(app) {
	app.post(
		'/panic/start',
		{
			schema: {
				body: panicActionBodySchema,
				response: {
					200: {
						type: 'object',
						required: ['panic', 'pausedTaskCount'],
						properties: {
							panic: serializedPanicStatusJsonSchema,
							pausedTaskCount: { type: 'integer' }
						}
					}
				}
			}
		},
		async (request, reply) => {
			let timezoneOffsetMinutes;

			try {
				timezoneOffsetMinutes = parseTimezoneOffsetMinutes(request.body?.tzOffsetMinutes);
			} catch (error) {
				return reply.code(400).send({
					message: error.message
				});
			}

			if (request.body?.day !== undefined && !isValidDayString(request.body.day)) {
				return reply.code(400).send({
					message: 'Invalid day.'
				});
			}

			const day = request.body?.day || getCurrentLocalDay(timezoneOffsetMinutes);
			const userId = new ObjectId(request.auth.userId);
			const startedAt = new Date();
			const existingOpenRuns = await loadOpenPanicRuns(app.mongo.db, {
				userId
			});

			if (existingOpenRuns.length === 0) {
					await app.mongo.db.collection('panic_runs').insertOne({
						userId,
						day,
						timezoneOffsetMinutes,
						startedAt,
						endedAt: null,
						note: null,
						emotionalCharge: null,
						createdAt: startedAt,
						updatedAt: startedAt
					});
			}

			const panicRuns = await loadPanicRunsOverlappingLocalDay(app.mongo.db, {
				userId,
				day,
				timezoneOffsetMinutes
			});

			return {
				panic: buildPanicStatus({
					day,
					panicRuns,
					timezoneOffsetMinutes,
					now: startedAt
				}),
				pausedTaskCount: 0
			};
		}
	);
}

module.exports = startPanicRoute;
