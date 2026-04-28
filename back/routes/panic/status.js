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

const panicStatusSchema = {
	querystring: {
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
	},
	response: {
		200: {
			type: 'object',
			required: ['panic'],
			properties: {
				panic: serializedPanicStatusJsonSchema
			}
		}
	}
};

async function panicStatusRoute(app) {
	app.get(
		'/panic/status',
		{
			schema: panicStatusSchema
		},
		async (request, reply) => {
			let timezoneOffsetMinutes;

			try {
				timezoneOffsetMinutes = parseTimezoneOffsetMinutes(request.query.tzOffsetMinutes);
			} catch (error) {
				return reply.code(400).send({
					message: error.message
				});
			}

			if (request.query.day !== undefined && !isValidDayString(request.query.day)) {
				return reply.code(400).send({
					message: 'Invalid day.'
				});
			}

			const day = request.query.day || getCurrentLocalDay(timezoneOffsetMinutes);
			const panicRuns = await loadPanicRunsOverlappingLocalDay(app.mongo.db, {
				userId: new ObjectId(request.auth.userId),
				day,
				timezoneOffsetMinutes
			});

			return {
				panic: buildPanicStatus({
					day,
					panicRuns,
					timezoneOffsetMinutes
				})
			};
		}
	);
}

module.exports = panicStatusRoute;
