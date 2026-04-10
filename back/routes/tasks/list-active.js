const { ObjectId } = require('mongodb');

const { serializedTaskJsonSchema, serializeTask } = require('../../lib/tasks');

async function listActiveTasksRoute(app) {
	app.get(
		'/tasks/active',
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
					activeToday: true
				})
				.sort({
					activatedAt: 1,
					createdAt: 1
				})
				.toArray();

			return {
				tasks: tasks.map(serializeTask)
			};
		}
	);
}

module.exports = listActiveTasksRoute;
