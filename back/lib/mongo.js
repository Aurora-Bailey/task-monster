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
}

module.exports = {
	connectToMongo,
	ensureDatabaseIndexes
};
