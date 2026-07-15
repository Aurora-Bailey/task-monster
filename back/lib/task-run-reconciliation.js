const { openTaskRun } = require('./task-runs');

const RECONCILED_RUN_NOTE = '-- Reconciled open task run';

function appendReconciliationNote(instanceNote) {
	const trimmedNote = typeof instanceNote === 'string' ? instanceNote.trimEnd() : '';

	return trimmedNote ? `${trimmedNote}\n\n${RECONCILED_RUN_NOTE}` : RECONCILED_RUN_NOTE;
}

function getSafeEndedAt(taskRun, candidate) {
	const startedAt = taskRun.startedAt instanceof Date ? taskRun.startedAt : new Date();
	const candidateEndedAt = candidate instanceof Date ? candidate : startedAt;

	return new Date(Math.max(startedAt.getTime(), candidateEndedAt.getTime()));
}

async function closeReconciledRun(db, { taskRun, endedAt }) {
	return db.collection('task_runs').updateOne(
		{
			_id: taskRun._id,
			userId: taskRun.userId,
			taskId: taskRun.taskId,
			endedAt: null
		},
		{
			$set: {
				endedAt,
				endingReason: 'inactive',
				instanceNote: appendReconciliationNote(taskRun.instanceNote),
				updatedAt: endedAt
			}
		}
	);
}

async function reconcileOpenTaskRuns(db) {
	const openTaskRuns = await db
		.collection('task_runs')
		.find({
			endedAt: null
		})
		.sort({
			startedAt: -1,
			_id: -1
		})
		.toArray();
	const runsByTask = new Map();

	for (const taskRun of openTaskRuns) {
		const taskKey = `${taskRun.userId.toString()}:${taskRun.taskId.toString()}`;
		const taskRuns = runsByTask.get(taskKey) ?? [];
		taskRuns.push(taskRun);
		runsByTask.set(taskKey, taskRuns);
	}

	let closedOrphanCount = 0;
	let closedDuplicateCount = 0;
	let createdMissingCount = 0;

	for (const taskRuns of runsByTask.values()) {
		const [latestTaskRun, ...olderTaskRuns] = taskRuns;
		const task = await db.collection('tasks').findOne({
			_id: latestTaskRun.taskId,
			userId: latestTaskRun.userId
		});

		if (!task || task.archived === true || task.activeToday !== true) {
			for (const taskRun of taskRuns) {
				const endedAt = getSafeEndedAt(
					taskRun,
					task?.lastInactivatedAt ?? task?.lastCompletedAt ?? task?.updatedAt
				);
				const result = await closeReconciledRun(db, {
					taskRun,
					endedAt
				});
				closedOrphanCount += result.modifiedCount;
			}

			continue;
		}

		for (const taskRun of olderTaskRuns) {
			const endedAt = getSafeEndedAt(taskRun, latestTaskRun.startedAt);
			const result = await closeReconciledRun(db, {
				taskRun,
				endedAt
			});
			closedDuplicateCount += result.modifiedCount;
		}
	}

	const activeTasks = await db
		.collection('tasks')
		.find({
			archived: false,
			activeToday: true
		})
		.toArray();

	for (const task of activeTasks) {
		const taskKey = `${task.userId.toString()}:${task._id.toString()}`;

		if (runsByTask.has(taskKey)) {
			continue;
		}

		const startedAt =
			task.activatedAt instanceof Date
				? task.activatedAt
				: task.lastStartedAt instanceof Date
					? task.lastStartedAt
					: task.updatedAt instanceof Date
						? task.updatedAt
						: new Date();

		try {
			await openTaskRun(db, {
				userId: task.userId,
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
						: null,
				instanceNote: RECONCILED_RUN_NOTE
			});
			createdMissingCount += 1;
		} catch (error) {
			if (error?.code !== 11000) {
				throw error;
			}
		}
	}

	return {
		closedOrphanCount,
		closedDuplicateCount,
		createdMissingCount
	};
}

module.exports = {
	RECONCILED_RUN_NOTE,
	appendReconciliationNote,
	reconcileOpenTaskRuns
};
