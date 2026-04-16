const { ObjectId } = require('mongodb');

const {
	buildPanicStatus,
	loadPanicRunsForDay,
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

			await app.mongo.db.collection('panic_runs').findOneAndUpdate(
				{
					userId,
					day,
					endedAt: null
				},
				{
					$set: {
						endedAt: stoppedAt,
						updatedAt: stoppedAt
					}
				},
				{
					sort: {
						startedAt: -1
					},
					returnDocument: 'after'
				}
			);

			const panicRuns = await loadPanicRunsForDay(app.mongo.db, {
				userId,
				day
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
