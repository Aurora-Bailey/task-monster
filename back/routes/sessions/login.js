const { createSession } = require('../../lib/sessions');
const { verifyPassword } = require('../../lib/passwords');
const { normalizeUsername } = require('../../lib/users');

const loginSchema = {
	body: {
		type: 'object',
		required: ['username', 'password'],
		additionalProperties: false,
		properties: {
			username: {
				type: 'string',
				minLength: 3,
				maxLength: 32
			},
			password: {
				type: 'string',
				minLength: 8,
				maxLength: 128
			}
		}
	},
	response: {
		200: {
			type: 'object',
			required: ['token', 'user', 'session'],
			properties: {
				token: { type: 'string' },
				user: {
					type: 'object',
					required: ['id', 'username'],
					properties: {
						id: { type: 'string' },
						username: { type: 'string' }
					}
				},
				session: {
					type: 'object',
					required: ['id', 'createdAt', 'lastUsedAt', 'tokenPreview'],
					properties: {
						id: { type: 'string' },
						createdAt: { type: 'string' },
						lastUsedAt: { type: 'string' },
						tokenPreview: { type: 'string' }
					}
				}
			}
		}
	}
};

async function loginRoute(app) {
	app.post(
		'/sessions/login',
		{
			schema: loginSchema,
			config: {
				isPublic: true
			}
		},
		async (request, reply) => {
			const usernameLower = normalizeUsername(request.body.username);
			const password = request.body.password;

			const user = await app.mongo.db.collection('users').findOne({ usernameLower });

			if (!user) {
				return reply.code(403).send({
					message: 'Invalid username or password.'
				});
			}

			const passwordMatches = await verifyPassword(password, user.passwordHash);

			if (!passwordMatches) {
				return reply.code(403).send({
					message: 'Invalid username or password.'
				});
			}

			const { token, session } = await createSession(app.mongo.db, {
				userId: user._id,
				username: user.username,
				ipAddress: request.ip,
				userAgent: request.headers['user-agent'] || null
			});

			return reply.code(200).send({
				token,
				user: {
					id: user._id.toString(),
					username: user.username
				},
				session
			});
		}
	);
}

module.exports = loginRoute;
