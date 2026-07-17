const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const test = require('node:test');

const { MongoClient, ObjectId } = require('mongodb');

const { ensureDatabaseIndexes } = require('../lib/mongo');
const {
	SHORTCUT_INSTANCE_NOTE,
	runQuickAddTask,
	runQuickStopTask
} = require('../lib/quick-actions');

function createDeferred() {
	let resolve;
	const promise = new Promise((resolvePromise) => {
		resolve = resolvePromise;
	});

	return { promise, resolve };
}

function createTask(userId) {
	const createdAt = new Date('2026-07-15T12:00:00.000Z');

	return {
		_id: new ObjectId(),
		userId,
		name: 'Overlapping quick action',
		colorHex: '#4f6ed6',
		colorKey: 'blue',
		mode: 'repeatable',
		trackingType: 'time',
		activeTallyCount: 0,
		lastCompletedTallyCount: null,
		hueShift: 50,
		daymapLocked: false,
		daymapWeekdays: [],
		mappedToday: true,
		mappedAt: createdAt,
		queuePosition: null,
		activeToday: false,
		activatedAt: null,
		archived: false,
		createdAt,
		updatedAt: createdAt
	};
}

const mongoUrl = process.env.TEST_MONGO_URL;

test(
	'overlapping targeted add and stop never leave an open run on an inactive task',
	{
		skip: mongoUrl ? false : 'TEST_MONGO_URL is required for Mongo-backed integration tests'
	},
	async (t) => {
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
		const userId = new ObjectId();
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
			notes: 'Final completion note.',
			at: new Date('2026-07-15T13:02:00.000Z')
		});
		const retryResult = await runQuickStopTask(db, {
			userId,
			taskId: task._id,
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
	}
);
