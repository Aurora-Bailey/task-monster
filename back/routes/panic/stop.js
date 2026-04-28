const { ObjectId } = require('mongodb');

const {
	buildPanicStatus,
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
		},
		note: {
			type: 'string',
			maxLength: 4000
		},
		emotionalCharge: {
			type: 'integer',
			minimum: 1,
			maximum: 10
		}
	}
};

async function stopPanicRoute(app) {
	app.post(
		'/panic/stop',
		{
			schema: {
				body: panicActionBodySchema,
				response: {
					200: {
						type: 'object',
						required: ['panic'],
						properties: {
							panic: serializedPanicStatusJsonSchema
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
			const stoppedAt = new Date();
			const note = request.body?.note === '' ? null : request.body?.note ?? null;
			const emotionalCharge = Number.isInteger(request.body?.emotionalCharge)
				? request.body.emotionalCharge
				: null;

			await app.mongo.db.collection('panic_runs').updateMany(
				{
					userId,
					endedAt: null
				},
				{
					$set: {
						endedAt: stoppedAt,
						note,
						emotionalCharge,
						updatedAt: stoppedAt
					}
				}
			);

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
					now: stoppedAt
				})
			};
		}
	);
}

module.exports = stopPanicRoute;
