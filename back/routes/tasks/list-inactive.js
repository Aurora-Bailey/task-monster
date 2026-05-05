const { ObjectId } = require('mongodb');

const {
	getCurrentLocalDay,
	getLocalWeekdayIndex,
	parseTimezoneOffsetMinutes
} = require('../../lib/local-days');
const { decorateTasksForLocalDay, serializedTaskJsonSchema, serializeTask } = require('../../lib/tasks');

function compareInactiveTasks(left, right) {
	if (left.mode !== right.mode) {
		return left.mode === 'repeatable' ? -1 : 1;
	}

	return right.updatedAt.getTime() - left.updatedAt.getTime();
}

async function listInactiveTasksRoute(app) {
	app.get(
		'/tasks/inactive',
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
					daymapWeekdays: {
						$ne: weekdayIndex
					},
					mappedToday: {
						$ne: true
					}
				})
				.toArray();
			const decoratedTasks = await decorateTasksForLocalDay(app.mongo.db, {
				tasks,
				userId: request.auth.userId,
				day: localDay,
				timezoneOffsetMinutes
			});

			return {
				tasks: decoratedTasks.sort(compareInactiveTasks).map(serializeTask)
			};
		}
	);
}

module.exports = listInactiveTasksRoute;
