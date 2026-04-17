const { ObjectId } = require('mongodb');

const {
	getPanicMillisecondsForWindow,
	loadPanicRunsOverlappingWindow
} = require('../../lib/panic');
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
				const measuredAt = new Date();
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
				const taskIds = tasks.map((task) => task._id);
				const openTaskRuns = taskIds.length
					? await app.mongo.db
							.collection('task_runs')
							.find({
								userId: new ObjectId(request.auth.userId),
								taskId: {
									$in: taskIds
								},
								endedAt: null
							})
							.sort({
								startedAt: -1
							})
							.toArray()
					: [];
				const openTaskRunsByTaskId = new Map();

				for (const taskRun of openTaskRuns) {
					const taskId = taskRun.taskId.toString();

					if (!openTaskRunsByTaskId.has(taskId)) {
						openTaskRunsByTaskId.set(taskId, taskRun);
					}
				}
				const activeTasksWithStart = tasks.filter((task) => task.activatedAt instanceof Date);
				const earliestActivatedAt = activeTasksWithStart.reduce(
					(earliest, task) =>
						earliest === null || task.activatedAt.getTime() < earliest.getTime()
							? task.activatedAt
							: earliest,
					null
				);
				const panicRuns = earliestActivatedAt
					? await loadPanicRunsOverlappingWindow(app.mongo.db, {
							userId: request.auth.userId,
							startedAt: earliestActivatedAt,
							endedAt: measuredAt
						})
					: [];

				return {
						tasks: tasks.map((task) =>
							serializeTask({
								...task,
								instanceNote: openTaskRunsByTaskId.get(task._id.toString())?.instanceNote ?? null,
								panicMilliseconds:
									task.activatedAt instanceof Date
									? getPanicMillisecondsForWindow({
											panicRuns,
											startedAt: task.activatedAt,
											endedAt: measuredAt,
											now: measuredAt
										})
									: 0,
							panicMeasuredAt: measuredAt
						})
					)
				};
			}
	);
}

module.exports = listActiveTasksRoute;
