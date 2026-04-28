const { ObjectId } = require('mongodb');

const {
	buildPanicLogItemsForWindow,
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
				const taskStartTimes = [
					...tasks
						.filter((task) => task.activatedAt instanceof Date)
						.map((task) => task.activatedAt),
					...openTaskRuns
						.filter((taskRun) => taskRun.startedAt instanceof Date)
						.map((taskRun) => taskRun.startedAt)
				];
				const earliestTaskStartedAt = taskStartTimes.reduce(
					(earliest, taskStartedAt) =>
						earliest === null || taskStartedAt.getTime() < earliest.getTime()
							? taskStartedAt
							: earliest,
					null
				);
				const panicRuns = earliestTaskStartedAt
					? await loadPanicRunsOverlappingWindow(app.mongo.db, {
							userId: request.auth.userId,
							startedAt: earliestTaskStartedAt,
							endedAt: measuredAt
						})
					: [];

			return {
				tasks: tasks.map((task) => {
					const openTaskRun = openTaskRunsByTaskId.get(task._id.toString());
					const taskStartedAt =
						openTaskRun?.startedAt instanceof Date ? openTaskRun.startedAt : task.activatedAt;
					const panicMilliseconds =
						taskStartedAt instanceof Date
							? getPanicMillisecondsForWindow({
									panicRuns,
									startedAt: taskStartedAt,
									endedAt: measuredAt,
									now: measuredAt
								})
							: 0;
					const effectiveMilliseconds =
						taskStartedAt instanceof Date
							? Math.max(
									0,
									measuredAt.getTime() - taskStartedAt.getTime() - panicMilliseconds
								)
							: 0;
					const taskPanicLog =
						taskStartedAt instanceof Date
							? buildPanicLogItemsForWindow({
									panicRuns,
									startedAt: taskStartedAt,
									endedAt: measuredAt,
									now: measuredAt
								})
							: [];

					return serializeTask({
						...task,
						instanceNote: openTaskRun?.instanceNote ?? null,
						panicMilliseconds,
						panicMeasuredAt: measuredAt,
						effectiveMilliseconds,
						taskPanicLog
					});
				})
			};
			}
	);
}

module.exports = listActiveTasksRoute;
