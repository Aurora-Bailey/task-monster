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
}

module.exports = {
	connectToMongo,
	ensureDatabaseIndexes
};
