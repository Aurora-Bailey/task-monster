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

function readOpenAiModel(value, fallback) {
	if (typeof value !== 'string') {
		return fallback;
	}

	const normalized = value.trim();

	if (!normalized || normalized === 'your_model_name_here') {
		return fallback;
	}

	return normalized;
}

function loadConfig() {
	return {
		host: process.env.HOST || '127.0.0.1',
		port: readPort(process.env.PORT, 3001),
		mongoUrl: process.env.MONGO_URL || 'mongodb://127.0.0.1:27017',
		mongoDbName: process.env.MONGO_DB_NAME || 'task-monster',
		openaiApiKey: process.env.OPENAI_API_KEY || '',
		openaiModel: readOpenAiModel(process.env.OPENAI_MODEL, 'gpt-5.4-mini')
	};
}

module.exports = {
	loadConfig
};
