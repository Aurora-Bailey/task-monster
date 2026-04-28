const { openTaskRun } = require('./task-runs');
const { toObjectId } = require('./tasks');

function buildQueuedTaskFilter(userId) {
	return {
		userId: toObjectId(userId),
		archived: false,
		mappedToday: true,
		activeToday: false,
		queuePosition: {
			$gte: 1
		}
	};
}

async function getNextQueuePosition(db, { userId }) {
	const queuedTask = await db.collection('tasks').find(buildQueuedTaskFilter(userId)).sort({ queuePosition: -1 }).limit(1).next();

	return queuedTask?.queuePosition ? queuedTask.queuePosition + 1 : 1;
}

async function collapseQueuePositionsAfter(db, { userId, queuePosition }) {
	if (!Number.isInteger(queuePosition) || queuePosition < 1) {
		return;
	}

	await db.collection('tasks').updateMany(
		{
			...buildQueuedTaskFilter(userId),
			queuePosition: {
				$gt: queuePosition
			}
		},
		{
			$inc: {
				queuePosition: -1
			}
		}
	);
}

async function activateNextQueuedTask(db, { userId, activatedAt = new Date() }) {
	for (let attempt = 0; attempt < 5; attempt += 1) {
		const queuedTask = await db
			.collection('tasks')
			.find(buildQueuedTaskFilter(userId))
			.sort({
				queuePosition: 1,
				mappedAt: 1,
				createdAt: 1
			})
			.limit(1)
			.next();

		if (!queuedTask) {
			return null;
		}

		const activeTallyCount =
			queuedTask.trackingType === 'tally' && Number.isInteger(queuedTask.activeTallyCount)
				? queuedTask.activeTallyCount
				: 0;
		const activatedTask = await db.collection('tasks').findOneAndUpdate(
			{
				_id: queuedTask._id,
				userId: queuedTask.userId,
				archived: false,
				mappedToday: true,
				activeToday: false,
				queuePosition: queuedTask.queuePosition
			},
			{
				$set: {
					activeToday: true,
					activatedAt,
					activeTallyCount,
					queuePosition: null,
					updatedAt: activatedAt
				}
			},
			{
				returnDocument: 'after'
			}
		);

		if (!activatedTask) {
			continue;
		}

		await collapseQueuePositionsAfter(db, {
			userId,
			queuePosition: queuedTask.queuePosition
		});

		await openTaskRun(db, {
			userId,
			taskId: queuedTask._id,
			startedAt: activatedAt,
			trackingType: queuedTask.trackingType || 'time',
			tallyUnit: queuedTask.tallyUnit ?? null,
			tallyTarget: Number.isInteger(queuedTask.tallyTarget) ? queuedTask.tallyTarget : null,
			startTallyCount: queuedTask.trackingType === 'tally' ? activeTallyCount : null,
			tallyCount: queuedTask.trackingType === 'tally' ? activeTallyCount : null
		});

		return activatedTask;
	}

	return null;
}

module.exports = {
	activateNextQueuedTask,
	collapseQueuePositionsAfter,
	getNextQueuePosition
};
