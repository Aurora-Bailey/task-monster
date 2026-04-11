const { ObjectId } = require('mongodb');

const { serializedTaskJsonSchema, serializeTask } = require('../../lib/tasks');

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
					mappedToday: true,
					activeToday: false
				})
				.toArray();

			return {
				tasks: tasks.sort(compareDaymapTasks).map(serializeTask)
			};
		}
	);
}

module.exports = listDaymapTasksRoute;
