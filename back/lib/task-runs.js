const { toObjectId } = require('./tasks');

async function openTaskRun(db, { userId, taskId, startedAt = new Date() }) {
	await db.collection('task_runs').insertOne({
		userId: toObjectId(userId),
		taskId: toObjectId(taskId),
		startedAt,
		endedAt: null,
		endingReason: null,
		createdAt: startedAt,
		updatedAt: startedAt
	});
}

async function closeOpenTaskRun(
	db,
	{ userId, taskId, endedAt = new Date(), endingReason = 'inactive' }
) {
	return db.collection('task_runs').findOneAndUpdate(
		{
			userId: toObjectId(userId),
			taskId: toObjectId(taskId),
			endedAt: null
		},
		{
			$set: {
				endedAt,
				endingReason,
				updatedAt: endedAt
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
	openTaskRun
};
