const { normalizeTaskHueShift } = require('./tasks');

function getMigratedHueShift(task) {
	const sourceValue = Object.hasOwn(task, 'intensity') ? task.intensity : task.hueShift;

	return normalizeTaskHueShift(sourceValue);
}

async function migrateTaskHueShift(db) {
	const tasks = await db
		.collection('tasks')
		.find(
			{},
			{
				projection: {
					_id: 1,
					hueShift: 1,
					intensity: 1
				}
			}
		)
		.toArray();
	const operations = [];

	for (const task of tasks) {
		const hueShift = getMigratedHueShift(task);
		const hasLegacyIntensity = Object.hasOwn(task, 'intensity');

		if (!hasLegacyIntensity && task.hueShift === hueShift) {
			continue;
		}

		const update = {
			$set: {
				hueShift
			}
		};

		if (hasLegacyIntensity) {
			update.$unset = {
				intensity: ''
			};
		}

		operations.push({
			updateOne: {
				filter: {
					_id: task._id
				},
				update
			}
		});
	}

	if (operations.length > 0) {
		await db.collection('tasks').bulkWrite(operations, {
			ordered: false
		});
	}

	return {
		scannedCount: tasks.length,
		updatedCount: operations.length
	};
}

module.exports = {
	getMigratedHueShift,
	migrateTaskHueShift
};
