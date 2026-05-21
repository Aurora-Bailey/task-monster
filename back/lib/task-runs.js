const { toObjectId } = require('./tasks');

async function openTaskRun(
	db,
	{
		userId,
		taskId,
		startedAt = new Date(),
		trackingType = 'time',
		tallyUnit = null,
		tallyTarget = null,
		startTallyCount = null,
		tallyCount = null,
		instanceNote = null
	}
) {
	await db.collection('task_runs').insertOne({
		userId: toObjectId(userId),
		taskId: toObjectId(taskId),
		trackingType,
		tallyUnit,
		tallyTarget,
		startTallyCount,
		tallyCount,
		instanceNote,
		startedAt,
		endedAt: null,
		endingReason: null,
		createdAt: startedAt,
		updatedAt: startedAt
	});
}

async function closeOpenTaskRun(
	db,
	{
		userId,
		taskId,
		startedAt,
		endedAt = new Date(),
		endingReason = 'inactive',
		tallyCount,
		instanceNote
	}
) {
	const update = {
		endedAt,
		endingReason,
		updatedAt: endedAt
	};

	if (tallyCount !== undefined) {
		update.tallyCount = tallyCount;
	}

	if (instanceNote !== undefined) {
		update.instanceNote = instanceNote;
	}

	if (startedAt instanceof Date) {
		update.startedAt = startedAt;
	}

	return db.collection('task_runs').findOneAndUpdate(
		{
			userId: toObjectId(userId),
			taskId: toObjectId(taskId),
			endedAt: null
		},
		{
			$set: update
		},
		{
			sort: {
				startedAt: -1
			},
			returnDocument: 'after'
		}
	);
}

async function deleteOpenTaskRun(db, { userId, taskId }) {
	const openTaskRun = await db
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

	if (!openTaskRun) {
		return null;
	}

	await db.collection('task_runs').deleteOne({
		_id: openTaskRun._id,
		userId: openTaskRun.userId,
		taskId: openTaskRun.taskId,
		endedAt: null
	});

	return openTaskRun;
}

async function createCompletedTaskRun(
	db,
	{
		userId,
		taskId,
		startedAt,
		endedAt = new Date(),
		endingReason = 'done',
		trackingType = 'time',
		tallyUnit = null,
		tallyTarget = null,
		startTallyCount = null,
		tallyCount = null,
		instanceNote = null
	}
) {
	return db.collection('task_runs').insertOne({
		userId: toObjectId(userId),
		taskId: toObjectId(taskId),
		trackingType,
		tallyUnit,
		tallyTarget,
		startTallyCount,
		tallyCount,
		instanceNote,
		startedAt,
		endedAt,
		endingReason,
		createdAt: startedAt,
		updatedAt: endedAt
	});
}

async function updateOpenTaskRunTally(
	db,
	{ userId, taskId, tallyCount = 0, updatedAt = new Date() }
) {
	return updateOpenTaskRunFields(db, {
		userId,
		taskId,
		fields: {
			tallyCount
		},
		updatedAt
	});
}

async function updateOpenTaskRunInstanceNote(
	db,
	{ userId, taskId, instanceNote = null, updatedAt = new Date() }
) {
	return updateOpenTaskRunFields(db, {
		userId,
		taskId,
		fields: {
			instanceNote
		},
		updatedAt
	});
}

async function updateOpenTaskRunFields(
	db,
	{ userId, taskId, fields = {}, updatedAt = new Date() }
) {
	return db.collection('task_runs').findOneAndUpdate(
		{
			userId: toObjectId(userId),
			taskId: toObjectId(taskId),
			endedAt: null
		},
		{
			$set: {
				...fields,
				updatedAt
			}
		},
		{
			sort: {
				startedAt: -1
			},
			returnDocument: 'after'
		}
	);
}

async function syncTaskRunHistoryFields(
	db,
	{ userId, taskId, updatedAt = new Date(), restoreOneTimeWithoutDoneRuns = false }
) {
	const ownedRunMatch = {
		userId: toObjectId(userId),
		taskId: toObjectId(taskId)
	};
	const [latestStartedRun, latestDoneRun, latestClosedRun] = await Promise.all([
		db
			.collection('task_runs')
			.find(ownedRunMatch)
			.sort({
				startedAt: -1,
				_id: -1
			})
			.limit(1)
			.next(),
		db
			.collection('task_runs')
			.find({
				...ownedRunMatch,
				endingReason: 'done',
				endedAt: {
					$ne: null
				}
			})
			.sort({
				endedAt: -1,
				_id: -1
			})
			.limit(1)
			.next(),
		db
			.collection('task_runs')
			.find({
				...ownedRunMatch,
				endedAt: {
					$ne: null
				}
			})
			.sort({
				endedAt: -1,
				_id: -1
			})
			.limit(1)
			.next()
	]);
	const latestCompletedTallyCount = Number.isInteger(latestDoneRun?.tallyCount)
		? latestDoneRun.tallyCount
		: Number.isInteger(latestDoneRun?.startTallyCount)
			? latestDoneRun.startTallyCount
			: null;
	const fields = {
		lastStartedAt: latestStartedRun?.startedAt ?? null,
		lastCompletedAt: latestDoneRun?.endedAt ?? null,
		lastCompletedTallyCount: latestCompletedTallyCount,
		lastInactivatedAt: latestClosedRun?.endedAt ?? null,
		updatedAt
	};

	if (restoreOneTimeWithoutDoneRuns && !latestDoneRun) {
		Object.assign(fields, {
			archived: false,
			mappedToday: false,
			mappedAt: null,
			queuePosition: null,
			activeToday: false,
			activatedAt: null
		});
	}

	return db.collection('tasks').findOneAndUpdate(
		{
			_id: toObjectId(taskId),
			userId: toObjectId(userId)
		},
		{
			$set: fields
		},
		{
			returnDocument: 'after'
		}
	);
}

module.exports = {
	closeOpenTaskRun,
	createCompletedTaskRun,
	deleteOpenTaskRun,
	openTaskRun,
	syncTaskRunHistoryFields,
	updateOpenTaskRunFields,
	updateOpenTaskRunInstanceNote,
	updateOpenTaskRunTally
};
