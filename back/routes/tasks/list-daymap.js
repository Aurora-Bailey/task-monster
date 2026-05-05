const { ObjectId } = require('mongodb');

const {
	getCurrentLocalDay,
	getLocalWeekdayIndex,
	parseTimezoneOffsetMinutes
} = require('../../lib/local-days');
const { decorateTasksForLocalDay, serializedTaskJsonSchema, serializeTask } = require('../../lib/tasks');

function compareDaymapTasks(left, right) {
	if (left.mode !== right.mode) {
		return left.mode === 'repeatable' ? -1 : 1;
	}

	const leftTime = (left.mappedAt || left.updatedAt || left.createdAt).getTime();
	const rightTime = (right.mappedAt || right.updatedAt || right.createdAt).getTime();

	return rightTime - leftTime;
}

async function listDaymapTasksRoute(app) {
	app.get(
		'/tasks/daymap',
		{
			schema: {
				querystring: {
					type: 'object',
					additionalProperties: false,
					properties: {
						tzOffsetMinutes: {
							type: ['integer', 'string']
						}
					}
				},
				response: {
					200: {
						type: 'object',
						required: ['tasks'],
						properties: {
							tasks: {
								type: 'array',
								items: serializedTaskJsonSchema
							}
						}
					}
				}
			}
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

			const localDay = getCurrentLocalDay(timezoneOffsetMinutes);
			const weekdayIndex = getLocalWeekdayIndex(localDay);
			const tasks = await app.mongo.db
				.collection('tasks')
				.find({
					userId: new ObjectId(request.auth.userId),
					archived: false,
					activeToday: false,
					$or: [
						{
							mappedToday: true
						},
						{
							daymapWeekdays: weekdayIndex
						}
					]
				})
				.toArray();
			const decoratedTasks = await decorateTasksForLocalDay(app.mongo.db, {
				tasks,
				userId: request.auth.userId,
				day: localDay,
				timezoneOffsetMinutes
			});

			return {
				tasks: decoratedTasks.sort(compareDaymapTasks).map(serializeTask)
			};
		}
	);
}

module.exports = listDaymapTasksRoute;
