const { ObjectId } = require('mongodb');

async function listLoginAttemptsRoute(app) {
	app.get(
		'/login-attempts',
		{
			schema: {
				response: {
					200: {
						type: 'object',
						required: ['attempts'],
						properties: {
							attempts: {
								type: 'array',
								items: {
									type: 'object',
									required: ['id', 'createdAt', 'ipAddress', 'userAgent', 'outcome'],
									properties: {
										id: { type: 'string' },
										createdAt: { type: 'string' },
										ipAddress: { type: ['string', 'null'] },
										userAgent: { type: ['string', 'null'] },
										outcome: {
											type: 'string',
											enum: ['success', 'invalid_credentials', 'rate_limited']
										}
									}
								}
							}
						}
					}
				}
			}
		},
		async (request) => {
			const attempts = await app.mongo.db
				.collection('login_events')
				.find({
					userId: new ObjectId(request.auth.userId)
				})
				.sort({ createdAt: -1 })
				.limit(40)
				.toArray();

			return {
				attempts: attempts.map((attempt) => ({
					id: attempt._id.toString(),
					createdAt: attempt.createdAt.toISOString(),
					ipAddress: attempt.ipAddress ?? null,
					userAgent: attempt.userAgent ?? null,
					outcome: attempt.outcome
				}))
			};
		}
	);
}

module.exports = listLoginAttemptsRoute;
