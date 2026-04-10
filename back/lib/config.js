function readPort(value, fallback) {
	if (value === undefined) {
		return fallback;
	}

	const parsed = Number.parseInt(value, 10);

	if (!Number.isInteger(parsed) || parsed <= 0) {
		throw new Error(`Invalid PORT value: ${value}`);
	}

	return parsed;
}

function loadConfig() {
	return {
		host: process.env.HOST || '127.0.0.1',
		port: readPort(process.env.PORT, 3001),
		mongoUrl: process.env.MONGO_URL || 'mongodb://127.0.0.1:27017',
		mongoDbName: process.env.MONGO_DB_NAME || 'task-monster'
	};
}

module.exports = {
	loadConfig
};
