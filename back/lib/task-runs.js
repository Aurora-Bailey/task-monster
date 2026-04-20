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
	{ userId, taskId, endedAt = new Date(), endingReason = 'inactive', tallyCount, instanceNote }
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

async function updateOpenTaskRunTally(
	db,
	{ userId, taskId, tallyCount = 0, updatedAt = new Date() }
) {
	return db.collection('task_runs').findOneAndUpdate(
		{
			userId: toObjectId(userId),
			taskId: toObjectId(taskId),
			endedAt: null
		},
		{
			$set: {
				tallyCount,
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

async function updateOpenTaskRunInstanceNote(
	db,
	{ userId, taskId, instanceNote = null, updatedAt = new Date() }
) {
	return db.collection('task_runs').findOneAndUpdate(
		{
			userId: toObjectId(userId),
			taskId: toObjectId(taskId),
			endedAt: null
		},
		{
			$set: {
				instanceNote,
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

module.exports = {
	closeOpenTaskRun,
	openTaskRun,
	updateOpenTaskRunInstanceNote,
	updateOpenTaskRunTally
};
