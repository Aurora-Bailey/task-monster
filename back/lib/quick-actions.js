const { activateNextQueuedTask, collapseQueuePositionsAfter } = require('./task-queue');
const { closeOpenTaskRun, openTaskRun } = require('./task-runs');
const { serializeTask, toObjectId } = require('./tasks');

const SHORTCUT_INSTANCE_NOTE = '-- Ended with shortcut';

function appendShortcutInstanceNote(instanceNote) {
	const trimmedNote = typeof instanceNote === 'string' ? instanceNote.trimEnd() : '';

	return trimmedNote ? `${trimmedNote}\n\n${SHORTCUT_INSTANCE_NOTE}` : SHORTCUT_INSTANCE_NOTE;
}

function normalizeTaskIds(taskIds = []) {
	return taskIds.filter(Boolean).map((taskId) => toObjectId(taskId));
}

async function completeAllActiveTasks(
	db,
	{ userId, completedAt = new Date(), excludeTaskIds = [] } = {}
) {
	const excludedTaskObjectIds = normalizeTaskIds(excludeTaskIds);
	const activeTaskFilter = {
		userId: toObjectId(userId),
		archived: false,
		activeToday: true
	};

	if (excludedTaskObjectIds.length > 0) {
		activeTaskFilter._id = {
			$nin: excludedTaskObjectIds
		};
	}

	const activeTasks = await db
		.collection('tasks')
		.find(activeTaskFilter)
		.sort({
			activatedAt: -1,
			createdAt: -1
		})
		.toArray();
	const closedRuns = [];

	for (const task of activeTasks) {
		const openTaskRun = await db
			.collection('task_runs')
			.find({
				userId: task.userId,
				taskId: task._id,
				endedAt: null
			})
			.sort({
				startedAt: -1
			})
			.limit(1)
			.next();
		const startedAt = openTaskRun?.startedAt instanceof Date ? openTaskRun.startedAt : completedAt;
		const remapToDaymap = task.mode === 'repeatable' && task.daymapLocked === true;
		const completedTallyCount =
			task.trackingType === 'tally' && Number.isInteger(task.activeTallyCount)
				? task.activeTallyCount
				: null;
		const previousQueuePosition = Number.isInteger(task.queuePosition) ? task.queuePosition : null;
		const updatedTask = await db.collection('tasks').findOneAndUpdate(
			{
				_id: task._id,
				userId: task.userId,
				archived: false,
				activeToday: true
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
			continue;
		}

		await collapseQueuePositionsAfter(db, {
			userId,
			queuePosition: previousQueuePosition
		});

		const closedRun = await closeOpenTaskRun(db, {
			userId,
			taskId: task._id,
			startedAt,
			endedAt: completedAt,
			endingReason: 'done',
			tallyCount: completedTallyCount ?? undefined,
			instanceNote: appendShortcutInstanceNote(openTaskRun?.instanceNote)
		});

		if (closedRun) {
			closedRuns.push(closedRun);
		}
	}

	return {
		stoppedCount: closedRuns.length,
		previousTaskRunId: closedRuns[0]?._id?.toString() ?? null
	};
}

async function startNextQueuedTask(db, { userId, startedAt = new Date() } = {}) {
	const nextTask = await activateNextQueuedTask(db, {
		userId,
		activatedAt: startedAt
	});

	return nextTask ? serializeTask(nextTask) : null;
}

async function startTaskById(db, { userId, taskId, startedAt = new Date() } = {}) {
	const task = await db.collection('tasks').findOne({
		_id: toObjectId(taskId),
		userId: toObjectId(userId),
		archived: false
	});

	if (!task) {
		return null;
	}

	if (task.activeToday === true) {
		return serializeTask(task);
	}

	const previousQueuePosition = Number.isInteger(task.queuePosition) ? task.queuePosition : null;
	const activeTallyCount =
		task.trackingType === 'tally' && Number.isInteger(task.activeTallyCount)
			? task.activeTallyCount
			: 0;
	const startedTask = await db.collection('tasks').findOneAndUpdate(
		{
			_id: task._id,
			userId: task.userId,
			archived: false,
			activeToday: false
		},
		{
			$set: {
				mappedToday: true,
				mappedAt: task.mappedAt || startedAt,
				queuePosition: null,
				activeToday: true,
				activatedAt: startedAt,
				lastStartedAt: startedAt,
				activeTallyCount,
				updatedAt: startedAt
			}
		},
		{
			returnDocument: 'after'
		}
	);

	if (!startedTask) {
		return null;
	}

	await collapseQueuePositionsAfter(db, {
		userId,
		queuePosition: previousQueuePosition
	});

	await openTaskRun(db, {
		userId,
		taskId: task._id,
		startedAt,
		trackingType: task.trackingType || 'time',
		tallyUnit: task.tallyUnit ?? null,
		tallyTarget: Number.isInteger(task.tallyTarget) ? task.tallyTarget : null,
		startTallyCount: task.trackingType === 'tally' ? activeTallyCount : null,
		tallyCount: task.trackingType === 'tally' ? activeTallyCount : null
	});

	return serializeTask(startedTask);
}

async function runQuickStop(db, { userId, at = new Date() } = {}) {
	return completeAllActiveTasks(db, {
		userId,
		completedAt: at
	});
}

async function runQuickNext(db, { userId, at = new Date() } = {}) {
	const stopResult = await completeAllActiveTasks(db, {
		userId,
		completedAt: at
	});
	const nextTask = await startNextQueuedTask(db, {
		userId,
		startedAt: at
	});

	return {
		previousTaskRunId: stopResult.previousTaskRunId,
		stoppedCount: stopResult.stoppedCount,
		nextTaskId: nextTask?.id ?? null,
		nextTaskTitle: nextTask?.name ?? null
	};
}

async function runQuickStart(db, { userId, taskId, at = new Date() } = {}) {
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
		completedAt: at,
		excludeTaskIds: [taskObjectId]
	});
	const startedTask = await startTaskById(db, {
		userId,
		taskId: taskObjectId,
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
	SHORTCUT_INSTANCE_NOTE,
	appendShortcutInstanceNote,
	completeAllActiveTasks,
	runQuickNext,
	runQuickStart,
	runQuickStop,
	startTaskById,
	startNextQueuedTask
};
