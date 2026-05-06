const { ObjectId } = require('mongodb');

const { normalizeTheme } = require('../lib/themes');

const whoamiSchema = {
	response: {
		200: {
			type: 'object',
			required: ['id', 'username', 'theme'],
			properties: {
				id: { type: 'string' },
				username: { type: 'string' },
				theme: { type: 'string' }
			}
		}
	}
};

async function whoamiRoute(app) {
	app.get('/whoami', { schema: whoamiSchema }, async (request) => {
		const user = await app.mongo.db.collection('users').findOne(
			{
				_id: new ObjectId(request.auth.userId)
			},
			{
				projection: {
					username: 1,
					theme: 1
				}
			}
		);

		return {
			id: request.auth.userId,
			username: user?.username ?? request.auth.username,
			theme: normalizeTheme(user?.theme)
		};
	});
}

module.exports = whoamiRoute;
