const { MongoServerError } = require('mongodb');

const { hashPassword } = require('../../lib/passwords');
const { normalizeUsername, validateUsername } = require('../../lib/users');

const PRERELEASE_ALPHA_CODE = 'gyarados';

const createUserSchema = {
	body: {
		type: 'object',
		required: ['username', 'password', 'alphaCode'],
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
			},
			alphaCode: {
				type: 'string',
				minLength: 1,
				maxLength: 64
			}
		}
	},
	response: {
		201: {
			type: 'object',
			properties: {
				user: {
					type: 'object',
					properties: {
						id: { type: 'string' },
						username: { type: 'string' },
						createdAt: { type: 'string' }
					},
					required: ['id', 'username', 'createdAt']
				}
			},
			required: ['user']
		}
	}
}

async function createUserRoute(app) {
	app.post(
		'/users',
		{
			schema: createUserSchema,
			config: {
				isPublic: true
			}
		},
		async (request, reply) => {
			const username = request.body.username.trim();
			const password = request.body.password;
			const alphaCode = request.body.alphaCode.trim().toLowerCase();
			const usernameLower = normalizeUsername(username);

			if (username.length < 3 || username.length > 32) {
				return reply.code(400).send({
					message: 'Username must be between 3 and 32 characters after trimming.'
				});
			}

			if (!validateUsername(username)) {
				return reply.code(400).send({
					message: 'Username can only include letters, numbers, underscores, and hyphens.'
				});
			}

			if (!alphaCode) {
				return reply.code(400).send({
					message: 'Alpha code is required to create an account.'
				});
			}

			if (alphaCode !== PRERELEASE_ALPHA_CODE) {
				return reply.code(403).send({
					message: 'Invalid alpha code.'
				});
			}

			const passwordHash = await hashPassword(password);
			const createdAt = new Date();

			try {
				const result = await app.mongo.db.collection('users').insertOne({
					username,
					usernameLower,
					passwordHash,
					createdAt,
					updatedAt: createdAt
				});

				return reply.code(201).send({
					user: {
						id: result.insertedId.toString(),
						username,
						createdAt: createdAt.toISOString()
					}
				});
			} catch (error) {
				if (error instanceof MongoServerError && error.code === 11000) {
					return reply.code(409).send({
						message: 'That username is already taken.'
					});
				}

				throw error;
			}
		}
	);
}

module.exports = createUserRoute;
