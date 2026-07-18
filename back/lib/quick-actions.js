const { randomUUID } = require('node:crypto');

const { activateNextQueuedTask, collapseQueuePositionsAfter } = require('./task-queue');
const { closeOpenTaskRun, openTaskRun } = require('./task-runs');
const { serializeTask, toObjectId } = require('./tasks');

const SHORTCUT_INSTANCE_NOTE = '-- Ended with shortcut';
const MAX_QUICK_ACTION_NOTES_CHARACTERS = 4000;
const MAX_QUICK_ACTION_NOTES_WORDS = 500;
const QUICK_ACTION_TRANSITION_WAIT_ATTEMPTS = 10;
const QUICK_ACTION_TRANSITION_WAIT_MILLISECONDS = 10;

function normalizeQuickActionNotes(notes) {
	return typeof notes === 'string' ? notes.trim() : '';
}

function countQuickActionNoteWords(notes) {
	const normalizedNotes = normalizeQuickActionNotes(notes);

	return normalizedNotes ? normalizedNotes.split(/\s+/u).length : 0;
}

function validateQuickActionNotes(notes) {
	if (notes === undefined || notes === null) {
		return {
			ok: true,
			notes: null
		};
	}

	if (typeof notes !== 'string') {
		return {
			ok: false,
			error: 'invalid_notes',
			message: 'Notes must be a string.'
		};
	}

	const normalizedNotes = normalizeQuickActionNotes(notes);

	if (Array.from(normalizedNotes).length > MAX_QUICK_ACTION_NOTES_CHARACTERS) {
		return {
			ok: false,
			error: 'notes_too_long',
			message: `Notes must be ${MAX_QUICK_ACTION_NOTES_CHARACTERS.toLocaleString('en-US')} characters or fewer.`
		};
	}

	if (countQuickActionNoteWords(normalizedNotes) > MAX_QUICK_ACTION_NOTES_WORDS) {
		return {
			ok: false,
			error: 'notes_too_long',
			message: `Notes must be ${MAX_QUICK_ACTION_NOTES_WORDS} words or fewer.`
		};
	}

	return {
		ok: true,
		notes: normalizedNotes || null
	};
}

function appendShortcutInstanceNote(instanceNote, notes) {
	const trimmedNote = typeof instanceNote === 'string' ? instanceNote.trimEnd() : '';
	const normalizedNotes = normalizeQuickActionNotes(notes);

	return [trimmedNote, normalizedNotes, SHORTCUT_INSTANCE_NOTE].filter(Boolean).join('\n\n');
}

function normalizeTaskIds(taskIds = []) {
	return taskIds.filter(Boolean).map((taskId) => toObjectId(taskId));
}

function emptyCompletionResult(notStoppedReason = 'not_active') {
	return {
		stoppedCount: 0,
		previousTaskRunId: null,
		task: null,
		notStoppedReason
	};
}

function isRunOwnedByQuickToken(taskRun, quickTokenId) {
	return Boolean(
		taskRun?.startedByQuickTokenId &&
			quickTokenId &&
			toObjectId(taskRun.startedByQuickTokenId).equals(toObjectId(quickTokenId))
	);
}

function delay(milliseconds) {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function clearQuickActionTransition(db, { userId, taskId, transitionId }) {
	return db.collection('tasks').updateOne(
		{
			_id: toObjectId(taskId),
			userId: toObjectId(userId),
			'quickActionTransition.id': transitionId
		},
		{
			$unset: {
				quickActionTransition: ''
			}
		}
	);
}

async function recoverQuickActionTransition(db, { userId, task }) {
	const transition = task?.quickActionTransition;

	if (!transition?.id) {
		return;
	}

	if (transition.type === 'activating') {
		const openTaskRun = await db.collection('task_runs').findOne({
			userId: task.userId,
			taskId: task._id,
			quickActionId: transition.id,
			endedAt: null
		});

		if (!openTaskRun) {
			await clearQuickActionTransition(db, {
				userId,
				taskId: task._id,
				transitionId: transition.id
			});
			return;
		}

		const recoveredTask = await db.collection('tasks').findOneAndUpdate(
			{
				_id: task._id,
				userId: task.userId,
				archived: false,
				activeToday: false,
				'quickActionTransition.id': transition.id
			},
			{
				$set: {
					mappedToday: true,
					mappedAt: transition.mappedAt,
					queuePosition: null,
					activeToday: true,
					activatedAt: transition.startedAt,
					lastStartedAt: transition.startedAt,
					activeTallyCount: transition.activeTallyCount,
					updatedAt: transition.startedAt
				},
				$unset: {
					quickActionTransition: ''
				}
			},
			{
				returnDocument: 'after'
			}
		);

		if (recoveredTask) {
			await collapseQueuePositionsAfter(db, {
				userId,
				queuePosition: transition.previousQueuePosition
			});
		} else {
			await clearQuickActionTransition(db, {
				userId,
				taskId: task._id,
				transitionId: transition.id
			});
		}

		return;
	}

	if (transition.type === 'completing') {
		if (task.activeToday === true) {
			await clearQuickActionTransition(db, {
				userId,
				taskId: task._id,
				transitionId: transition.id
			});
			return;
		}

		const closedRun = await closeOpenTaskRun(db, {
			userId,
			taskId: task._id,
			runId: transition.runId,
			startedAt: transition.startedAt,
			endedAt: transition.completedAt,
			endingReason: 'done',
			tallyCount: transition.completedTallyCount ?? undefined,
			instanceNote: transition.instanceNote,
			quickActionId: transition.id,
			startedByQuickTokenId: transition.startedByQuickTokenId
		});

		if (!closedRun) {
			const completedRun = await db.collection('task_runs').findOne({
				_id: toObjectId(transition.runId),
				userId: task.userId,
				taskId: task._id,
				quickActionId: transition.id,
				...(transition.startedByQuickTokenId
					? { startedByQuickTokenId: transition.startedByQuickTokenId }
					: {}),
				endedAt: {
					$ne: null
				}
			});

			if (!completedRun) {
				await clearQuickActionTransition(db, {
					userId,
					taskId: task._id,
					transitionId: transition.id
				});
				return;
			}
		}

		await clearQuickActionTransition(db, {
			userId,
			taskId: task._id,
			transitionId: transition.id
		});
		return;
	}

	await clearQuickActionTransition(db, {
		userId,
		taskId: task._id,
		transitionId: transition.id
	});
}

async function recoverQuickActionTransitions(db) {
	const tasks = await db
		.collection('tasks')
		.find({
			quickActionTransition: {
				$exists: true
			}
		})
		.toArray();

	for (const task of tasks) {
		await recoverQuickActionTransition(db, {
			userId: task.userId,
			task
		});
	}

	return {
		recoveredCount: tasks.length
	};
}

async function findSettledOwnedTask(db, { userId, taskId }) {
	for (let attempt = 0; attempt <= QUICK_ACTION_TRANSITION_WAIT_ATTEMPTS; attempt += 1) {
		const task = await db.collection('tasks').findOne({
			_id: toObjectId(taskId),
			userId: toObjectId(userId)
		});

		if (!task || !task.quickActionTransition?.id) {
			return task;
		}

		if (attempt < QUICK_ACTION_TRANSITION_WAIT_ATTEMPTS) {
			await delay(QUICK_ACTION_TRANSITION_WAIT_MILLISECONDS);
			continue;
		}

		await recoverQuickActionTransition(db, {
			userId,
			task
		});
	}

	return db.collection('tasks').findOne({
		_id: toObjectId(taskId),
		userId: toObjectId(userId)
	});
}

async function findLatestOpenTaskRun(db, { userId, taskId }) {
	return db
		.collection('task_runs')
		.find({
			userId: toObjectId(userId),
			taskId: toObjectId(taskId),
			endedAt: null
		})
		.sort({
			startedAt: -1
		})
		.limit(1)
		.next();
}

async function ensureOpenTaskRun(db, { userId, task }) {
	let taskRun = await findLatestOpenTaskRun(db, {
		userId,
		taskId: task._id
	});

	if (taskRun) {
		return taskRun;
	}

	const startedAt =
		task.activatedAt instanceof Date
			? task.activatedAt
			: task.lastStartedAt instanceof Date
				? task.lastStartedAt
				: new Date();

	try {
		taskRun = await openTaskRun(db, {
			userId,
			taskId: task._id,
			startedAt,
			trackingType: task.trackingType || 'time',
			tallyUnit: task.tallyUnit ?? null,
			tallyTarget: Number.isInteger(task.tallyTarget) ? task.tallyTarget : null,
			startTallyCount:
				task.trackingType === 'tally' && Number.isInteger(task.activeTallyCount)
					? task.activeTallyCount
					: null,
			tallyCount:
				task.trackingType === 'tally' && Number.isInteger(task.activeTallyCount)
					? task.activeTallyCount
					: null
		});
	} catch (error) {
		if (error?.code !== 11000) {
			throw error;
		}

		taskRun = await findLatestOpenTaskRun(db, {
			userId,
			taskId: task._id
		});
	}

	return taskRun;
}

async function completeActiveTask(
	db,
	{ userId, taskId, quickTokenId, completedAt = new Date(), completionNotes = null } = {}
) {
	if (!quickTokenId) {
		return emptyCompletionResult('not_owned');
	}

	for (let attempt = 0; attempt < 5; attempt += 1) {
		const task = await findSettledOwnedTask(db, {
			userId,
			taskId
		});

		if (!task || task.archived === true || task.activeToday !== true) {
			return emptyCompletionResult();
		}

		const openTaskRun = await ensureOpenTaskRun(db, {
			userId,
			task
		});

		if (!openTaskRun) {
			continue;
		}

		if (!isRunOwnedByQuickToken(openTaskRun, quickTokenId)) {
			return emptyCompletionResult('not_owned');
		}

		const transitionId = randomUUID();
		const startedAt = openTaskRun.startedAt instanceof Date ? openTaskRun.startedAt : completedAt;
		const remapToDaymap = task.mode === 'repeatable' && task.daymapLocked === true;
		const completedTallyCount =
			task.trackingType === 'tally' && Number.isInteger(task.activeTallyCount)
				? task.activeTallyCount
				: null;
		const previousQueuePosition = Number.isInteger(task.queuePosition) ? task.queuePosition : null;
		const instanceNote = appendShortcutInstanceNote(openTaskRun.instanceNote, completionNotes);
		const transition = {
			id: transitionId,
			type: 'completing',
			runId: openTaskRun._id.toString(),
			startedAt,
			completedAt,
			completedTallyCount,
			instanceNote,
			startedByQuickTokenId: openTaskRun.startedByQuickTokenId
		};
		const claimedTask = await db.collection('tasks').findOneAndUpdate(
			{
				_id: task._id,
				userId: task.userId,
				archived: false,
				activeToday: true,
				quickActionTransition: {
					$exists: false
				}
			},
			{
				$set: {
					quickActionTransition: transition
				}
			},
			{
				returnDocument: 'after'
			}
		);

		if (!claimedTask) {
			continue;
		}

		let taskStateUpdated = false;

		try {
			const updatedTask = await db.collection('tasks').findOneAndUpdate(
				{
					_id: task._id,
					userId: task.userId,
					archived: false,
					activeToday: true,
					'quickActionTransition.id': transitionId
				},
				{
					$set: {
						mappedToday: remapToDaymap,
						mappedAt: remapToDaymap ? completedAt : null,
						queuePosition: null,
						activeToday: false,
						activatedAt: null,
						activeTallyCount: 0,
						lastCompletedTallyCount: completedTallyCount,
						lastCompletedAt: completedAt,
						lastStartedAt: startedAt,
						lastInactivatedAt: completedAt,
						nextDueAt: task.mode === 'repeatable' ? (task.nextDueAt ?? null) : null,
						archived: task.mode === 'one-time',
						updatedAt: completedAt
					}
				},
				{
					returnDocument: 'after'
				}
			);

			if (!updatedTask) {
				await clearQuickActionTransition(db, {
					userId,
					taskId: task._id,
					transitionId
				});
				continue;
			}

			taskStateUpdated = true;
			let closedRun = await closeOpenTaskRun(db, {
				userId,
				taskId: task._id,
				runId: openTaskRun._id,
				startedAt,
				endedAt: completedAt,
				endingReason: 'done',
				tallyCount: completedTallyCount ?? undefined,
				instanceNote,
				quickActionId: transitionId,
				startedByQuickTokenId: quickTokenId
			});

			if (!closedRun) {
				closedRun = await db.collection('task_runs').findOne({
					_id: openTaskRun._id,
					userId: task.userId,
					taskId: task._id,
					quickActionId: transitionId,
					startedByQuickTokenId: toObjectId(quickTokenId),
					endedAt: {
						$ne: null
					}
				});
			}

			if (!closedRun) {
				continue;
			}

			await clearQuickActionTransition(db, {
				userId,
				taskId: task._id,
				transitionId
			});
			await collapseQueuePositionsAfter(db, {
				userId,
				queuePosition: previousQueuePosition
			});

			return {
				stoppedCount: 1,
				previousTaskRunId: closedRun._id.toString(),
				task: updatedTask
			};
		} catch (error) {
			if (!taskStateUpdated) {
				await clearQuickActionTransition(db, {
					userId,
					taskId: task._id,
					transitionId
				});
			}

			throw error;
		}
	}

	return emptyCompletionResult();
}

async function completeAllActiveTasks(
	db,
	{ userId, quickTokenId, completedAt = new Date(), excludeTaskIds = [] } = {}
) {
	if (!quickTokenId) {
		return {
			stoppedCount: 0,
			previousTaskRunId: null
		};
	}

	const excludedTaskObjectIds = normalizeTaskIds(excludeTaskIds);
	const ownedOpenRunFilter = {
		userId: toObjectId(userId),
		startedByQuickTokenId: toObjectId(quickTokenId),
		endedAt: null
	};

	if (excludedTaskObjectIds.length > 0) {
		ownedOpenRunFilter.taskId = {
			$nin: excludedTaskObjectIds
		};
	}

	const ownedOpenRuns = await db
		.collection('task_runs')
		.find(ownedOpenRunFilter)
		.project({ taskId: 1 })
		.toArray();

	if (ownedOpenRuns.length === 0) {
		return {
			stoppedCount: 0,
			previousTaskRunId: null
		};
	}

	const activeTaskFilter = {
		userId: toObjectId(userId),
		archived: false,
		activeToday: true,
		_id: {
			$in: ownedOpenRuns.map((taskRun) => taskRun.taskId)
		}
	};

	const activeTasks = await db
		.collection('tasks')
		.find(activeTaskFilter)
		.sort({
			activatedAt: -1,
			createdAt: -1
		})
		.toArray();
	let stoppedCount = 0;
	let previousTaskRunId = null;

	for (const task of activeTasks) {
		const result = await completeActiveTask(db, {
			userId,
			taskId: task._id,
			quickTokenId,
			completedAt
		});

		// Preserve the existing stop/next count: it represents runs that were actually closed.
		stoppedCount += result.previousTaskRunId ? 1 : 0;

		if (!previousTaskRunId && result.previousTaskRunId) {
			previousTaskRunId = result.previousTaskRunId;
		}
	}

	return {
		stoppedCount,
		previousTaskRunId
	};
}

async function startNextQueuedTask(
	db,
	{ userId, quickTokenId, startedAt = new Date() } = {}
) {
	const nextTask = await activateNextQueuedTask(db, {
		userId,
		activatedAt: startedAt,
		startedByQuickTokenId: quickTokenId
	});

	return nextTask ? serializeTask(nextTask) : null;
}

async function startTaskById(
	db,
	{ userId, taskId, quickTokenId, startedAt = new Date() } = {}
) {
	for (let attempt = 0; attempt < 5; attempt += 1) {
		const task = await findSettledOwnedTask(db, {
			userId,
			taskId
		});

		if (!task || task.archived === true) {
			return null;
		}

		if (task.activeToday === true) {
			return serializeTask(task);
		}

		const transitionId = randomUUID();
		const previousQueuePosition = Number.isInteger(task.queuePosition) ? task.queuePosition : null;
		const activeTallyCount =
			task.trackingType === 'tally' && Number.isInteger(task.activeTallyCount)
				? task.activeTallyCount
				: 0;
		const mappedAt = task.mappedAt || startedAt;
		const transition = {
			id: transitionId,
			type: 'activating',
			startedAt,
			mappedAt,
			activeTallyCount,
			previousQueuePosition
		};
		const claimedTask = await db.collection('tasks').findOneAndUpdate(
			{
				_id: task._id,
				userId: task.userId,
				archived: false,
				activeToday: false,
				quickActionTransition: {
					$exists: false
				}
			},
			{
				$set: {
					quickActionTransition: transition
				}
			},
			{
				returnDocument: 'after'
			}
		);

		if (!claimedTask) {
			continue;
		}

		let createdTaskRun = null;
		let startedTask = null;

		try {
			createdTaskRun = await openTaskRun(db, {
				userId,
				taskId: task._id,
				startedAt,
				trackingType: task.trackingType || 'time',
				tallyUnit: task.tallyUnit ?? null,
				tallyTarget: Number.isInteger(task.tallyTarget) ? task.tallyTarget : null,
				startTallyCount: task.trackingType === 'tally' ? activeTallyCount : null,
				tallyCount: task.trackingType === 'tally' ? activeTallyCount : null,
				quickActionId: transitionId,
				startedByQuickTokenId: quickTokenId
			});

			startedTask = await db.collection('tasks').findOneAndUpdate(
				{
					_id: task._id,
					userId: task.userId,
					archived: false,
					activeToday: false,
					'quickActionTransition.id': transitionId
				},
				{
					$set: {
						mappedToday: true,
						mappedAt,
						queuePosition: null,
						activeToday: true,
						activatedAt: startedAt,
						lastStartedAt: startedAt,
						activeTallyCount,
						updatedAt: startedAt
					},
					$unset: {
						quickActionTransition: ''
					}
				},
				{
					returnDocument: 'after'
				}
			);

			if (!startedTask) {
				const settledTask = await findSettledOwnedTask(db, {
					userId,
					taskId: task._id
				});

				if (settledTask?.activeToday === true) {
					return serializeTask(settledTask);
				}

				await db.collection('task_runs').deleteOne({
					_id: createdTaskRun._id,
					userId: task.userId,
					taskId: task._id,
					quickActionId: transitionId,
					endedAt: null
				});
				createdTaskRun = null;
				await clearQuickActionTransition(db, {
					userId,
					taskId: task._id,
					transitionId
				});
				continue;
			}

			await collapseQueuePositionsAfter(db, {
				userId,
				queuePosition: previousQueuePosition
			});

			return serializeTask(startedTask);
		} catch (error) {
			if (!startedTask) {
				await Promise.allSettled([
					createdTaskRun
						? db.collection('task_runs').deleteOne({
								_id: createdTaskRun._id,
								userId: task.userId,
								taskId: task._id,
								quickActionId: transitionId,
								endedAt: null
							})
						: Promise.resolve(),
					clearQuickActionTransition(db, {
						userId,
						taskId: task._id,
						transitionId
					})
				]);
			}

			if (error?.code === 11000) {
				const settledTask = await findSettledOwnedTask(db, {
					userId,
					taskId: task._id
				});

				if (settledTask?.activeToday === true) {
					return serializeTask(settledTask);
				}

				continue;
			}

			throw error;
		}
	}

	return null;
}

async function runQuickStop(db, { userId, quickTokenId, at = new Date() } = {}) {
	return completeAllActiveTasks(db, {
		userId,
		quickTokenId,
		completedAt: at
	});
}

async function runQuickAddTask(
	db,
	{ userId, taskId, quickTokenId, at = new Date() } = {}
) {
	const task = await startTaskById(db, {
		userId,
		taskId,
		quickTokenId,
		startedAt: at
	});

	if (!task) {
		return null;
	}

	return {
		taskId: task.id,
		taskTitle: task.name,
		task
	};
}

async function runQuickStopTask(
	db,
	{ userId, taskId, quickTokenId, notes = null, at = new Date() } = {}
) {
	const task = await db.collection('tasks').findOne({
		_id: toObjectId(taskId),
		userId: toObjectId(userId)
	});

	if (!task) {
		return null;
	}

	const completeResult = await completeActiveTask(db, {
		userId,
		taskId: task._id,
		quickTokenId,
		completionNotes: notes,
		completedAt: at
	});

	return {
		previousTaskRunId: completeResult.previousTaskRunId,
		stoppedCount: completeResult.stoppedCount,
		notStoppedReason: completeResult.notStoppedReason ?? null,
		taskId: task._id.toString(),
		taskTitle: task.name
	};
}

async function runQuickNext(db, { userId, quickTokenId, at = new Date() } = {}) {
	const stopResult = await completeAllActiveTasks(db, {
		userId,
		quickTokenId,
		completedAt: at
	});
	const nextTask = await startNextQueuedTask(db, {
		userId,
		quickTokenId,
		startedAt: at
	});

	return {
		previousTaskRunId: stopResult.previousTaskRunId,
		stoppedCount: stopResult.stoppedCount,
		nextTaskId: nextTask?.id ?? null,
		nextTaskTitle: nextTask?.name ?? null
	};
}

async function runQuickStart(
	db,
	{ userId, taskId, quickTokenId, at = new Date() } = {}
) {
	const taskObjectId = toObjectId(taskId);
	const task = await db.collection('tasks').findOne({
		_id: taskObjectId,
		userId: toObjectId(userId),
		archived: false
	});

	if (!task) {
		return null;
	}

	const completeResult = await completeAllActiveTasks(db, {
		userId,
		quickTokenId,
		completedAt: at,
		excludeTaskIds: [taskObjectId]
	});
	const startedTask = await startTaskById(db, {
		userId,
		taskId: taskObjectId,
		quickTokenId,
		startedAt: at
	});

	if (!startedTask) {
		return null;
	}

	return {
		previousTaskRunId: completeResult.previousTaskRunId,
		stoppedCount: completeResult.stoppedCount,
		taskId: startedTask.id,
		taskTitle: startedTask.name,
		task: startedTask
	};
}

module.exports = {
	MAX_QUICK_ACTION_NOTES_CHARACTERS,
	MAX_QUICK_ACTION_NOTES_WORDS,
	SHORTCUT_INSTANCE_NOTE,
	appendShortcutInstanceNote,
	completeAllActiveTasks,
	completeActiveTask,
	countQuickActionNoteWords,
	normalizeQuickActionNotes,
	recoverQuickActionTransitions,
	runQuickAddTask,
	runQuickNext,
	runQuickStart,
	runQuickStop,
	runQuickStopTask,
	startTaskById,
	startNextQueuedTask,
	validateQuickActionNotes
};
