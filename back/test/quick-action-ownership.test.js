const assert = require('node:assert/strict');
const test = require('node:test');

const { ObjectId } = require('mongodb');

const { completeActiveTask, completeAllActiveTasks } = require('../lib/quick-actions');
const { openTaskRun } = require('../lib/task-runs');

function createActiveTask(userId, taskId) {
	const activatedAt = new Date('2026-07-18T12:00:00.000Z');

	return {
		_id: taskId,
		userId,
		name: 'Token-isolated task',
		mode: 'repeatable',
		trackingType: 'time',
		activeToday: true,
		activeTallyCount: 0,
		daymapLocked: false,
		archived: false,
		activatedAt,
		lastStartedAt: activatedAt
	};
}

function createReadOnlyCompletionDb({ task, taskRun }) {
	let mutationCount = 0;
	const cursor = {
		sort() {
			return this;
		},
		limit() {
			return this;
		},
		async next() {
			return taskRun;
		}
	};

	return {
		get mutationCount() {
			return mutationCount;
		},
		collection(name) {
			if (name === 'tasks') {
				return {
					async findOne() {
						return task;
					},
					async findOneAndUpdate() {
						mutationCount += 1;
						throw new Error('An unowned run must not mutate its task.');
					}
				};
			}

			if (name === 'task_runs') {
				return {
					find() {
						return cursor;
					},
					async insertOne() {
						mutationCount += 1;
						throw new Error('An existing unowned run must not be replaced.');
					},
					async findOneAndUpdate() {
						mutationCount += 1;
						throw new Error('An unowned run must not be closed.');
					}
				};
			}

			throw new Error(`Unexpected collection: ${name}`);
		}
	};
}

test('open task runs persist the originating quick token id only when supplied', async () => {
	const userId = new ObjectId();
	const taskId = new ObjectId();
	const quickTokenId = new ObjectId();
	const insertedDocuments = [];
	const db = {
		collection(name) {
			assert.equal(name, 'task_runs');

			return {
				async insertOne(document) {
					insertedDocuments.push(document);

					return { insertedId: new ObjectId() };
				}
			};
		}
	};

	await openTaskRun(db, {
		userId,
		taskId,
		startedByQuickTokenId: quickTokenId.toString()
	});
	await openTaskRun(db, {
		userId,
		taskId
	});

	assert.ok(insertedDocuments[0].startedByQuickTokenId.equals(quickTokenId));
	assert.equal(Object.hasOwn(insertedDocuments[1], 'startedByQuickTokenId'), false);
});

test('targeted quick completion refuses other-token and unattributed runs without mutation', async () => {
	const userId = new ObjectId();
	const taskId = new ObjectId();
	const firstQuickTokenId = new ObjectId();
	const secondQuickTokenId = new ObjectId();
	const task = createActiveTask(userId, taskId);

	for (const startedByQuickTokenId of [firstQuickTokenId, null]) {
		const taskRun = {
			_id: new ObjectId(),
			userId,
			taskId,
			startedAt: task.activatedAt,
			endedAt: null
		};

		if (startedByQuickTokenId) {
			taskRun.startedByQuickTokenId = startedByQuickTokenId;
		}

		const db = createReadOnlyCompletionDb({ task, taskRun });
		const result = await completeActiveTask(db, {
			userId,
			taskId,
			quickTokenId: secondQuickTokenId,
			completedAt: new Date('2026-07-18T12:05:00.000Z')
		});

		assert.equal(result.stoppedCount, 0);
		assert.equal(result.notStoppedReason, 'not_owned');
		assert.equal(db.mutationCount, 0);
	}
});

test('targeted quick completion closes a run started by the same token', async () => {
	const userId = new ObjectId();
	const taskId = new ObjectId();
	const quickTokenId = new ObjectId();
	let task = createActiveTask(userId, taskId);
	let closeFilter;
	let taskRun = {
		_id: new ObjectId(),
		userId,
		taskId,
		startedByQuickTokenId: quickTokenId,
		instanceNote: null,
		startedAt: task.activatedAt,
		endedAt: null
	};
	const db = {
		collection(name) {
			if (name === 'tasks') {
				return {
					async findOne() {
						return task;
					},
					async findOneAndUpdate(_filter, update) {
						task = {
							...task,
							...update.$set
						};

						return task;
					},
					async updateOne(_filter, update) {
						if (update.$unset?.quickActionTransition !== undefined) {
							delete task.quickActionTransition;
						}

						return { modifiedCount: 1 };
					}
				};
			}

			if (name === 'task_runs') {
				return {
					find() {
						return {
							sort() {
								return this;
							},
							limit() {
								return this;
							},
							async next() {
								return taskRun;
							}
						};
					},
					async findOneAndUpdate(filter, update) {
						closeFilter = filter;
						taskRun = {
							...taskRun,
							...update.$set
						};

						return taskRun;
					}
				};
			}

			throw new Error(`Unexpected collection: ${name}`);
		}
	};
	const completedAt = new Date('2026-07-18T12:05:00.000Z');
	const result = await completeActiveTask(db, {
		userId,
		taskId,
		quickTokenId,
		completedAt
	});

	assert.equal(result.stoppedCount, 1);
	assert.equal(task.activeToday, false);
	assert.equal(taskRun.endingReason, 'done');
	assert.equal(taskRun.endedAt, completedAt);
	assert.ok(taskRun.startedByQuickTokenId.equals(quickTokenId));
	assert.ok(closeFilter.startedByQuickTokenId.equals(quickTokenId));
});

test('bulk quick completion selects open runs by the calling token id', async () => {
	const userId = new ObjectId();
	const quickTokenId = new ObjectId();
	let observedFilter;
	const db = {
		collection(name) {
			assert.equal(name, 'task_runs');

			return {
				find(filter) {
					observedFilter = filter;

					return {
						project() {
							return this;
						},
						async toArray() {
							return [];
						}
					};
				}
			};
		}
	};
	const result = await completeAllActiveTasks(db, {
		userId,
		quickTokenId
	});

	assert.equal(result.stoppedCount, 0);
	assert.ok(observedFilter.userId.equals(userId));
	assert.ok(observedFilter.startedByQuickTokenId.equals(quickTokenId));
	assert.equal(observedFilter.endedAt, null);
});
