const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const test = require('node:test');

const { MongoClient, ObjectId } = require('mongodb');

const { ensureDatabaseIndexes } = require('../lib/mongo');
const {
	SHORTCUT_INSTANCE_NOTE,
	runQuickAddTask,
	runQuickNext,
	runQuickStart,
	runQuickStop,
	runQuickStopTask
} = require('../lib/quick-actions');
const { openTaskRun } = require('../lib/task-runs');
const doneTaskRoute = require('../routes/tasks/done');

function createDeferred() {
	let resolve;
	const promise = new Promise((resolvePromise) => {
		resolve = resolvePromise;
	});

	return { promise, resolve };
}

function createTask(
	userId,
	{ name = 'Overlapping quick action', mappedToday = true, queuePosition = null } = {}
) {
	const createdAt = new Date('2026-07-15T12:00:00.000Z');

	return {
		_id: new ObjectId(),
		userId,
		name,
		colorHex: '#4f6ed6',
		colorKey: 'blue',
		mode: 'repeatable',
		trackingType: 'time',
		activeTallyCount: 0,
		lastCompletedTallyCount: null,
		hueShift: 50,
		daymapLocked: false,
		daymapWeekdays: [],
		mappedToday,
		mappedAt: createdAt,
		queuePosition,
		activeToday: false,
		activatedAt: null,
		archived: false,
		createdAt,
		updatedAt: createdAt
	};
}

const mongoUrl = process.env.TEST_MONGO_URL;

async function createIntegrationDatabase(t) {
	const client = new MongoClient(mongoUrl, {
		serverSelectionTimeoutMS: 5000
	});
	await client.connect();
	const db = client.db(`task-monster-quick-actions-${randomUUID()}`);

	t.after(async () => {
		await db.dropDatabase();
		await client.close();
	});

	await ensureDatabaseIndexes(db);

	return db;
}

async function activateUnattributedTask(db, { userId, task, activatedAt }) {
	await db.collection('tasks').updateOne(
		{
			_id: task._id,
			userId
		},
		{
			$set: {
				activeToday: true,
				activatedAt,
				lastStartedAt: activatedAt,
				updatedAt: activatedAt
			}
		}
	);
	await openTaskRun(db, {
		userId,
		taskId: task._id,
		startedAt: activatedAt,
		trackingType: task.trackingType
	});
}

async function markDoneThroughApp(db, { userId, taskId }) {
	let handler;
	const app = {
		mongo: { db },
		post(_path, _options, routeHandler) {
			handler = routeHandler;
		}
	};
	await doneTaskRoute(app);
	let statusCode = 200;
	const reply = {
		code(nextStatusCode) {
			statusCode = nextStatusCode;
			return this;
		},
		send(payload) {
			return payload;
		}
	};
	const result = await handler(
		{
			params: { taskId: taskId.toString() },
			body: {},
			auth: { userId: userId.toString() }
		},
		reply
	);

	assert.equal(statusCode, 200);

	return result;
}

test(
	'overlapping targeted add and stop never leave an open run on an inactive task',
	{
		skip: mongoUrl ? false : 'TEST_MONGO_URL is required for Mongo-backed integration tests'
	},
	async (t) => {
		const db = await createIntegrationDatabase(t);
		const userId = new ObjectId();
		const quickTokenId = new ObjectId();
		const task = createTask(userId);
		await db.collection('tasks').insertOne(task);

		const runInserted = createDeferred();
		const releaseActivation = createDeferred();
		let shouldPauseInsertion = true;
		const pausingDb = {
			collection(name) {
				const collection = db.collection(name);

				if (name !== 'task_runs') {
					return collection;
				}

				return new Proxy(collection, {
					get(target, property) {
						if (property === 'insertOne') {
							return async (document, options) => {
								const result = await target.insertOne(document, options);

								if (shouldPauseInsertion && document.taskId.equals(task._id)) {
									shouldPauseInsertion = false;
									runInserted.resolve();
									await releaseActivation.promise;
								}

								return result;
							};
						}

						const value = target[property];
						return typeof value === 'function' ? value.bind(target) : value;
					}
				});
			}
		};
		const addTaskPromise = runQuickAddTask(pausingDb, {
			userId,
			taskId: task._id,
			quickTokenId,
			at: new Date('2026-07-15T13:00:00.000Z')
		});

		await runInserted.promise;
		await db.collection('task_runs').updateOne(
			{
				taskId: task._id,
				userId,
				endedAt: null
			},
			{
				$set: {
					instanceNote: 'Existing session context.'
				}
			}
		);
		const stopResult = await runQuickStopTask(db, {
			userId,
			taskId: task._id,
			quickTokenId,
			notes: '  Finished the requested work.  ',
			at: new Date('2026-07-15T13:01:00.000Z')
		});
		assert.equal(stopResult.stoppedCount, 1);

		releaseActivation.resolve();
		await addTaskPromise;

		const [finalTask, openRunCount, allRuns] = await Promise.all([
			db.collection('tasks').findOne({ _id: task._id, userId }),
			db.collection('task_runs').countDocuments({ taskId: task._id, userId, endedAt: null }),
			db.collection('task_runs').find({ taskId: task._id, userId }).toArray()
		]);

		assert.equal(finalTask.activeToday, true);
		assert.equal(Boolean(finalTask.quickActionTransition), false);
		assert.equal(openRunCount, 1);
		assert.equal(allRuns.length, 2);
		assert.equal(allRuns.filter((taskRun) => taskRun.endingReason === 'done').length, 1);
		assert.equal(finalTask.activeToday === false && openRunCount > 0, false);
		assert.equal(
			allRuns.find((taskRun) => taskRun.endingReason === 'done').instanceNote,
			`Existing session context.\n\nFinished the requested work.\n\n${SHORTCUT_INSTANCE_NOTE}`
		);

		const finalStopResult = await runQuickStopTask(db, {
			userId,
			taskId: task._id,
			quickTokenId,
			notes: 'Final completion note.',
			at: new Date('2026-07-15T13:02:00.000Z')
		});
		const retryResult = await runQuickStopTask(db, {
			userId,
			taskId: task._id,
			quickTokenId,
			notes: 'This retry must not change history.',
			at: new Date('2026-07-15T13:03:00.000Z')
		});
		const finalCompletedRun = await db.collection('task_runs').findOne({
			taskId: task._id,
			userId,
			endedAt: new Date('2026-07-15T13:02:00.000Z')
		});

		assert.equal(finalStopResult.stoppedCount, 1);
		assert.equal(retryResult.stoppedCount, 0);
		assert.equal(
			finalCompletedRun.instanceNote,
			`Final completion note.\n\n${SHORTCUT_INSTANCE_NOTE}`
		);
		assert.ok(finalCompletedRun.startedByQuickTokenId.equals(quickTokenId));
	}
);

test(
	'quick stop and next only complete runs started by the calling token',
	{
		skip: mongoUrl ? false : 'TEST_MONGO_URL is required for Mongo-backed integration tests'
	},
	async (t) => {
		const db = await createIntegrationDatabase(t);
		const userId = new ObjectId();
		const firstQuickTokenId = new ObjectId();
		const secondQuickTokenId = new ObjectId();
		const firstTokenTask = createTask(userId, { name: 'First token task' });
		const secondTokenTask = createTask(userId, { name: 'Second token task' });
		const manualTask = createTask(userId, { name: 'Manual task' });
		const queuedTask = createTask(userId, {
			name: 'Queued task',
			queuePosition: 1
		});
		await db
			.collection('tasks')
			.insertMany([firstTokenTask, secondTokenTask, manualTask, queuedTask]);

		await runQuickAddTask(db, {
			userId,
			taskId: firstTokenTask._id,
			quickTokenId: firstQuickTokenId,
			at: new Date('2026-07-15T13:00:00.000Z')
		});
		await runQuickAddTask(db, {
			userId,
			taskId: secondTokenTask._id,
			quickTokenId: secondQuickTokenId,
			at: new Date('2026-07-15T13:01:00.000Z')
		});
		await activateUnattributedTask(db, {
			userId,
			task: manualTask,
			activatedAt: new Date('2026-07-15T13:02:00.000Z')
		});

		const crossTokenStop = await runQuickStopTask(db, {
			userId,
			taskId: firstTokenTask._id,
			quickTokenId: secondQuickTokenId,
			notes: 'This note must not be saved.',
			at: new Date('2026-07-15T13:03:00.000Z')
		});
		const firstOpenRunAfterCrossTokenStop = await db.collection('task_runs').findOne({
			userId,
			taskId: firstTokenTask._id,
			endedAt: null
		});

		assert.equal(crossTokenStop.stoppedCount, 0);
		assert.equal(crossTokenStop.notStoppedReason, 'not_owned');
		assert.equal(firstOpenRunAfterCrossTokenStop.instanceNote, null);

		const firstStop = await runQuickStop(db, {
			userId,
			quickTokenId: firstQuickTokenId,
			at: new Date('2026-07-15T13:04:00.000Z')
		});
		const tasksAfterFirstStop = await db
			.collection('tasks')
			.find({ _id: { $in: [firstTokenTask._id, secondTokenTask._id, manualTask._id] } })
			.toArray();
		const activeByIdAfterFirstStop = new Map(
			tasksAfterFirstStop.map((task) => [task._id.toString(), task.activeToday])
		);

		assert.equal(firstStop.stoppedCount, 1);
		assert.equal(activeByIdAfterFirstStop.get(firstTokenTask._id.toString()), false);
		assert.equal(activeByIdAfterFirstStop.get(secondTokenTask._id.toString()), true);
		assert.equal(activeByIdAfterFirstStop.get(manualTask._id.toString()), true);

		const nextResult = await runQuickNext(db, {
			userId,
			quickTokenId: secondQuickTokenId,
			at: new Date('2026-07-15T13:05:00.000Z')
		});
		const [queuedOpenRun, manualTaskAfterNext] = await Promise.all([
			db.collection('task_runs').findOne({
				userId,
				taskId: queuedTask._id,
				endedAt: null
			}),
			db.collection('tasks').findOne({ _id: manualTask._id, userId })
		]);

		assert.equal(nextResult.stoppedCount, 1);
		assert.equal(nextResult.nextTaskId, queuedTask._id.toString());
		assert.ok(queuedOpenRun.startedByQuickTokenId.equals(secondQuickTokenId));
		assert.equal(manualTaskAfterNext.activeToday, true);

		const unrelatedStop = await runQuickStop(db, {
			userId,
			quickTokenId: firstQuickTokenId,
			at: new Date('2026-07-15T13:06:00.000Z')
		});
		const queuedTaskAfterUnrelatedStop = await db.collection('tasks').findOne({
			_id: queuedTask._id,
			userId
		});

		assert.equal(unrelatedStop.stoppedCount, 0);
		assert.equal(queuedTaskAfterUnrelatedStop.activeToday, true);

		const secondStop = await runQuickStop(db, {
			userId,
			quickTokenId: secondQuickTokenId,
			at: new Date('2026-07-15T13:07:00.000Z')
		});
		const manualTaskAfterAllQuickStops = await db.collection('tasks').findOne({
			_id: manualTask._id,
			userId
		});

		assert.equal(secondStop.stoppedCount, 1);
		assert.equal(manualTaskAfterAllQuickStops.activeToday, true);
	}
);

test(
	'quick start preserves other ownership and normal app completion remains an override',
	{
		skip: mongoUrl ? false : 'TEST_MONGO_URL is required for Mongo-backed integration tests'
	},
	async (t) => {
		const db = await createIntegrationDatabase(t);
		const userId = new ObjectId();
		const firstQuickTokenId = new ObjectId();
		const secondQuickTokenId = new ObjectId();
		const firstTokenTask = createTask(userId, { name: 'First running task' });
		const secondTokenTask = createTask(userId, { name: 'Second running task' });
		const manualTask = createTask(userId, { name: 'Unattributed running task' });
		const replacementTask = createTask(userId, { name: 'Replacement task' });
		await db
			.collection('tasks')
			.insertMany([firstTokenTask, secondTokenTask, manualTask, replacementTask]);

		await runQuickAddTask(db, {
			userId,
			taskId: firstTokenTask._id,
			quickTokenId: firstQuickTokenId,
			at: new Date('2026-07-15T14:00:00.000Z')
		});
		await runQuickAddTask(db, {
			userId,
			taskId: secondTokenTask._id,
			quickTokenId: secondQuickTokenId,
			at: new Date('2026-07-15T14:01:00.000Z')
		});
		await activateUnattributedTask(db, {
			userId,
			task: manualTask,
			activatedAt: new Date('2026-07-15T14:02:00.000Z')
		});

		const startResult = await runQuickStart(db, {
			userId,
			taskId: replacementTask._id,
			quickTokenId: firstQuickTokenId,
			at: new Date('2026-07-15T14:03:00.000Z')
		});
		const [runningTasks, replacementOpenRun] = await Promise.all([
			db
				.collection('tasks')
				.find({
					_id: {
						$in: [
							firstTokenTask._id,
							secondTokenTask._id,
							manualTask._id,
							replacementTask._id
						]
					}
				})
				.toArray(),
			db.collection('task_runs').findOne({
				userId,
				taskId: replacementTask._id,
				endedAt: null
			})
		]);
		const activeById = new Map(
			runningTasks.map((task) => [task._id.toString(), task.activeToday])
		);

		assert.equal(startResult.stoppedCount, 1);
		assert.equal(activeById.get(firstTokenTask._id.toString()), false);
		assert.equal(activeById.get(secondTokenTask._id.toString()), true);
		assert.equal(activeById.get(manualTask._id.toString()), true);
		assert.equal(activeById.get(replacementTask._id.toString()), true);
		assert.ok(replacementOpenRun.startedByQuickTokenId.equals(firstQuickTokenId));

		await runQuickAddTask(db, {
			userId,
			taskId: replacementTask._id,
			quickTokenId: secondQuickTokenId,
			at: new Date('2026-07-15T14:04:00.000Z')
		});
		const crossTokenStop = await runQuickStopTask(db, {
			userId,
			taskId: replacementTask._id,
			quickTokenId: secondQuickTokenId,
			at: new Date('2026-07-15T14:05:00.000Z')
		});
		const runAfterCrossTokenStartAndStop = await db.collection('task_runs').findOne({
			userId,
			taskId: replacementTask._id,
			endedAt: null
		});

		assert.equal(crossTokenStop.stoppedCount, 0);
		assert.equal(crossTokenStop.notStoppedReason, 'not_owned');
		assert.ok(runAfterCrossTokenStartAndStop.startedByQuickTokenId.equals(firstQuickTokenId));

		await markDoneThroughApp(db, {
			userId,
			taskId: replacementTask._id
		});
		const [replacementAfterAppDone, completedReplacementRun] = await Promise.all([
			db.collection('tasks').findOne({ _id: replacementTask._id, userId }),
			db.collection('task_runs').findOne({
				userId,
				taskId: replacementTask._id,
				endingReason: 'done'
			})
		]);

		assert.equal(replacementAfterAppDone.activeToday, false);
		assert.ok(completedReplacementRun.startedByQuickTokenId.equals(firstQuickTokenId));
	}
);
