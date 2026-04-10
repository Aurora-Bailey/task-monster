const Fastify = require('fastify');
const { join } = require('node:path');

const { authenticateRequest } = require('./lib/auth');
const { loadConfig } = require('./lib/config');
const { connectToMongo, ensureDatabaseIndexes } = require('./lib/mongo');
const { registerRoutes } = require('./lib/register-routes');

async function buildServer() {
	const config = loadConfig();
	const app = Fastify({
		logger: true
	});

	app.decorate('config', config);
	app.decorateRequest('auth', null);

	app.addHook('onRequest', async (request, reply) => {
		reply.header('Access-Control-Allow-Origin', '*');
		reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
		reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
		reply.header('Access-Control-Max-Age', '86400');

		if (request.method === 'OPTIONS') {
			return reply.code(204).send();
		}
	});

	const mongo = await connectToMongo({
		mongoUrl: config.mongoUrl,
		databaseName: config.mongoDbName
	});

	app.decorate('mongo', mongo);

	app.addHook('onClose', async () => {
		await mongo.client.close();
	});

	await ensureDatabaseIndexes(mongo.db);
	app.addHook('preHandler', async (request, reply) => {
		return authenticateRequest(app, request, reply);
	});
	await registerRoutes(app, join(__dirname, 'routes'));

	return app;
}

async function start() {
	const app = await buildServer();

	await app.listen({
		host: app.config.host,
		port: app.config.port
	});
}

if (require.main === module) {
	start().catch((error) => {
		console.error(error);
		process.exit(1);
	});
}

module.exports = {
	buildServer
};
