const { ObjectId } = require('mongodb');

const { serializedTaskJsonSchema, serializeTask } = require('../../lib/tasks');

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
		async (request) => {
			const tasks = await app.mongo.db
				.collection('tasks')
				.find({
					userId: new ObjectId(request.auth.userId),
					archived: false,
					activeToday: false
				})
				.toArray();

			return {
				tasks: tasks.sort(compareInactiveTasks).map(serializeTask)
			};
		}
	);
}

module.exports = listInactiveTasksRoute;
