const { createSession } = require('../../lib/sessions');
const { recordLoginEvent } = require('../../lib/login-events');
const {
	clearFailedLoginAttempts,
	getLoginRateLimitState,
	recordFailedLoginAttempt
} = require('../../lib/login-rate-limit');
const { verifyPassword } = require('../../lib/passwords');
const { normalizeTheme } = require('../../lib/themes');
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
					required: ['id', 'username', 'theme'],
					properties: {
						id: { type: 'string' },
						username: { type: 'string' },
						theme: { type: 'string' }
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
		},
		403: {
			type: 'object',
			required: ['message'],
			properties: {
				message: { type: 'string' }
			}
		},
		429: {
			type: 'object',
			required: ['message', 'retryAfterSeconds'],
			properties: {
				message: { type: 'string' },
				retryAfterSeconds: { type: 'integer' }
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
			const username = request.body.username.trim();
			const usernameLower = normalizeUsername(request.body.username);
			const password = request.body.password;
			const ipAddress = request.ip;
			const userAgent = request.headers['user-agent'] || null;
			const user = await app.mongo.db.collection('users').findOne({ usernameLower });
			const rateLimit = await getLoginRateLimitState(app.mongo.db, {
				ipAddress,
				usernameLower
			});

			if (rateLimit.isLimited) {
				await recordLoginEvent(app.mongo.db, {
					userId: user?._id ?? null,
					username: user?.username ?? username,
					usernameLower,
					ipAddress,
					userAgent,
					outcome: 'rate_limited'
				});

				reply.header('Retry-After', String(rateLimit.retryAfterSeconds));

				return reply.code(429).send({
					message: 'Too many login attempts. Try again later.',
					retryAfterSeconds: rateLimit.retryAfterSeconds
				});
			}

			if (!user) {
				await recordFailedLoginAttempt(app.mongo.db, {
					ipAddress,
					usernameLower,
					userAgent
				});
				await recordLoginEvent(app.mongo.db, {
					username,
					usernameLower,
					ipAddress,
					userAgent,
					outcome: 'invalid_credentials'
				});

				return reply.code(403).send({
					message: 'Invalid username or password.'
				});
			}

			const passwordMatches = await verifyPassword(password, user.passwordHash);

			if (!passwordMatches) {
				await recordFailedLoginAttempt(app.mongo.db, {
					ipAddress,
					usernameLower,
					userAgent
				});
				await recordLoginEvent(app.mongo.db, {
					userId: user._id,
					username: user.username,
					usernameLower,
					ipAddress,
					userAgent,
					outcome: 'invalid_credentials'
				});

				return reply.code(403).send({
					message: 'Invalid username or password.'
				});
			}

			await clearFailedLoginAttempts(app.mongo.db, {
				ipAddress,
				usernameLower
			});

			const { token, session } = await createSession(app.mongo.db, {
				userId: user._id,
				username: user.username,
				ipAddress,
				userAgent
			});
			await recordLoginEvent(app.mongo.db, {
				userId: user._id,
				username: user.username,
				usernameLower,
				ipAddress,
				userAgent,
				outcome: 'success'
			});

			return reply.code(200).send({
				token,
				user: {
					id: user._id.toString(),
					username: user.username,
					theme: normalizeTheme(user.theme)
				},
				session
			});
		}
	);
}

module.exports = loginRoute;
