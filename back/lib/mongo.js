const { MongoClient } = require('mongodb');

async function connectToMongo({ mongoUrl, databaseName }) {
	const client = new MongoClient(mongoUrl, {
		serverSelectionTimeoutMS: 5000
	});

	await client.connect();

	return {
		client,
		db: client.db(databaseName)
	};
}

async function ensureDatabaseIndexes(db) {
	await db.collection('users').createIndex(
		{ usernameLower: 1 },
		{
			name: 'users_usernameLower_unique',
			unique: true
		}
	);

	await db.collection('sessions').createIndex(
		{ tokenHash: 1 },
		{
			name: 'sessions_tokenHash_unique',
			unique: true
		}
	);

	await db.collection('sessions').createIndex(
		{ userId: 1, revokedAt: 1, createdAt: -1 },
		{
			name: 'sessions_userId_revokedAt_createdAt'
		}
	);

	await db.collection('login_attempts').createIndex(
		{ expireAt: 1 },
		{
			name: 'login_attempts_expireAt_ttl',
			expireAfterSeconds: 0
		}
	);

	await db.collection('login_attempts').createIndex(
		{ ipAddress: 1, createdAt: 1 },
		{
			name: 'login_attempts_ipAddress_createdAt'
		}
	);

	await db.collection('login_attempts').createIndex(
		{ ipAddress: 1, usernameLower: 1, createdAt: 1 },
		{
			name: 'login_attempts_ipAddress_usernameLower_createdAt'
		}
	);

	await db.collection('login_events').createIndex(
		{ userId: 1, createdAt: -1 },
		{
			name: 'login_events_userId_createdAt'
		}
	);

	await db.collection('tasks').createIndex(
		{ userId: 1, archived: 1, mappedToday: 1, activeToday: 1, createdAt: -1 },
		{
			name: 'tasks_userId_archived_mappedToday_activeToday_createdAt'
		}
	);

	await db.collection('tasks').createIndex(
		{ userId: 1, archived: 1, mappedToday: 1, activeToday: 1, queuePosition: 1 },
		{
			name: 'tasks_userId_archived_mappedToday_activeToday_queuePosition'
		}
	);

	await db.collection('task_runs').createIndex(
		{ userId: 1, taskId: 1, endedAt: 1, startedAt: -1 },
		{
			name: 'task_runs_userId_taskId_endedAt_startedAt'
		}
	);

	await db.collection('task_runs').createIndex(
		{ userId: 1, startedAt: -1 },
		{
			name: 'task_runs_userId_startedAt'
		}
	);

	await db.collection('task_runs').createIndex(
		{ userId: 1, endingReason: 1, endedAt: -1 },
		{
			name: 'task_runs_userId_endingReason_endedAt'
		}
	);

	await db.collection('panic_runs').createIndex(
		{ userId: 1, day: 1, startedAt: 1 },
		{
			name: 'panic_runs_userId_day_startedAt'
		}
	);

	await db.collection('panic_runs').createIndex(
		{ userId: 1, day: 1, endedAt: 1, startedAt: -1 },
		{
			name: 'panic_runs_userId_day_endedAt_startedAt'
		}
	);

	await db.collection('assistant_messages').createIndex(
		{ userId: 1, createdAt: -1, _id: -1 },
		{
			name: 'assistant_messages_userId_createdAt_id'
		}
	);
}

module.exports = {
	connectToMongo,
	ensureDatabaseIndexes
};
