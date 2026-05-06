const { ObjectId } = require('mongodb');

const { isValidTheme, normalizeTheme } = require('../../lib/themes');

const updateUserThemeSchema = {
	body: {
		type: 'object',
		required: ['theme'],
		additionalProperties: false,
		properties: {
			theme: {
				type: 'string',
				minLength: 1,
				maxLength: 80
			}
		}
	},
	response: {
		200: {
			type: 'object',
			required: ['user'],
			properties: {
				user: {
					type: 'object',
					required: ['id', 'username', 'theme'],
					properties: {
						id: { type: 'string' },
						username: { type: 'string' },
						theme: { type: 'string' }
					}
				}
			}
		}
	}
};

async function updateUserThemeRoute(app) {
	app.patch('/users/theme', { schema: updateUserThemeSchema }, async (request, reply) => {
		const theme = request.body.theme;

		if (!isValidTheme(theme)) {
			return reply.code(400).send({
				message: 'Unknown theme.'
			});
		}

		const user = await app.mongo.db.collection('users').findOneAndUpdate(
			{
				_id: new ObjectId(request.auth.userId)
			},
			{
				$set: {
					theme,
					updatedAt: new Date()
				}
			},
			{
				returnDocument: 'after',
				projection: {
					username: 1,
					theme: 1
				}
			}
		);

		if (!user) {
			return reply.code(404).send({
				message: 'User not found.'
			});
		}

		return {
			user: {
				id: request.auth.userId,
				username: user.username,
				theme: normalizeTheme(user.theme)
			}
		};
	});
}

module.exports = updateUserThemeRoute;
