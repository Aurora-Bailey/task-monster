const {
	buildPanicLogItemsForWindow,
	getPanicMillisecondsForWindow,
	loadPanicRunsOverlappingWindow
} = require('./panic');
const { serializeTask } = require('./tasks');

async function loadPanicRunsForTaskRuns(db, { userId, taskRuns }) {
	const earliestStartedAt = taskRuns.reduce(
		(earliest, taskRun) =>
			earliest === null || taskRun.startedAt.getTime() < earliest.getTime()
				? taskRun.startedAt
				: earliest,
		null
	);
	const latestEndedAt = taskRuns.reduce(
		(latest, taskRun) =>
			latest === null || taskRun.endedAt.getTime() > latest.getTime() ? taskRun.endedAt : latest,
		null
	);

	if (!earliestStartedAt || !latestEndedAt) {
		return [];
	}

	return loadPanicRunsOverlappingWindow(db, {
		userId,
		startedAt: earliestStartedAt,
		endedAt: latestEndedAt
	});
}

function serializeCompletedTaskRun(taskRun, { measuredAt, panicRuns }) {
	const serializedTask = serializeTask({
		...taskRun.task,
		trackingType: taskRun.trackingType ?? taskRun.task.trackingType,
		tallyUnit: taskRun.tallyUnit ?? taskRun.task.tallyUnit,
		tallyTarget: Number.isInteger(taskRun.tallyTarget)
			? taskRun.tallyTarget
			: taskRun.task.tallyTarget
	});
	const tallyCount = Number.isInteger(taskRun.tallyCount)
		? taskRun.tallyCount
		: Number.isInteger(taskRun.startTallyCount)
			? taskRun.startTallyCount
			: null;
	const spentMilliseconds = Math.max(0, taskRun.endedAt.getTime() - taskRun.startedAt.getTime());
	const panicMilliseconds = getPanicMillisecondsForWindow({
		panicRuns,
		startedAt: taskRun.startedAt,
		endedAt: taskRun.endedAt,
		now: measuredAt
	});
	const taskPanicLog = buildPanicLogItemsForWindow({
		panicRuns,
		startedAt: taskRun.startedAt,
		endedAt: taskRun.endedAt,
		now: measuredAt,
		includeOpenRuns: false
	});

	return {
		...serializedTask,
		id: taskRun._id.toString(),
		taskId: serializedTask.id,
		instanceNote: taskRun.instanceNote ?? null,
		completedAt: taskRun.endedAt.toISOString(),
		startedAt: taskRun.startedAt.toISOString(),
		endedAt: taskRun.endedAt.toISOString(),
		spentMilliseconds,
		panicMilliseconds,
		effectiveMilliseconds: Math.max(0, spentMilliseconds - panicMilliseconds),
		taskPanicLog,
		tallyCount
	};
}

module.exports = {
	loadPanicRunsForTaskRuns,
	serializeCompletedTaskRun
};
