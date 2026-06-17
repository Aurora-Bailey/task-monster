const { createQuickToken } = require('../../lib/quick-tokens');
const { quickTokenJsonSchema } = require('./list');

async function createQuickTokenRoute(app) {
	app.post(
		'/quick-tokens',
		{
			schema: {
				body: {
					type: 'object',
					additionalProperties: false,
					properties: {
						label: {
							type: 'string',
							maxLength: 80
						}
					}
				},
				response: {
					201: {
						type: 'object',
						required: ['token', 'rawToken'],
						properties: {
							token: quickTokenJsonSchema,
							rawToken: { type: 'string' }
						}
					}
				}
			}
		},
		async (request, reply) => {
			const result = await createQuickToken(app.mongo.db, {
				userId: request.auth.userId,
				label: request.body?.label
			});

			return reply.code(201).send(result);
		}
	);
}

module.exports = createQuickTokenRoute;
