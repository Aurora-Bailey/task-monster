const { loadConfig } = require('../lib/config');
const { loadRootEnv } = require('../lib/load-env');
const { normalizeStoredBellSound } = require('../lib/bell-sounds');
const { connectToMongo } = require('../lib/mongo');
const { normalizeStoredPomodoro } = require('../lib/pomodoro');

loadRootEnv();

async function main() {
	const config = loadConfig();
	const mongo = await connectToMongo({
		mongoUrl: config.mongoUrl,
		databaseName: config.mongoDbName
	});

	try {
		const tasksCollection = mongo.db.collection('tasks');
		const tasks = await tasksCollection.find({}).toArray();
		let updatedCount = 0;

		for (const task of tasks) {
			const nextPomodoro = normalizeStoredPomodoro(task);
			const nextBellSound = normalizeStoredBellSound(task);
			const update = {
				$unset: {
					alarmEnabled: '',
					durationMinutes: '',
					snoozeMinutes: '',
					alarmDueAt: ''
				}
			};

			if (task.trackingType === 'tally') {
				update.$set = {
					pomodoro: null,
					bellSound: null
				};
			} else {
				update.$set = {
					pomodoro: nextPomodoro,
					bellSound: nextBellSound
				};
			}

			const result = await tasksCollection.updateOne(
				{
					_id: task._id
				},
				update
			);

			if (result.modifiedCount > 0) {
				updatedCount += 1;
			}
		}

		console.log(`Pomodoro migration complete. Updated ${updatedCount} of ${tasks.length} tasks.`);
	} finally {
		await mongo.client.close();
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
