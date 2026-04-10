const whoamiSchema = {
	response: {
		200: {
			type: 'object',
			required: ['username'],
			properties: {
				username: { type: 'string' }
			}
		}
	}
};

async function whoamiRoute(app) {
	app.get('/whoami', { schema: whoamiSchema }, async (request) => ({
		username: request.auth.username
	}));
}

module.exports = whoamiRoute;
