const { listQuickTokens } = require('../../lib/quick-tokens');

const quickTokenJsonSchema = {
	type: 'object',
	required: ['id', 'label', 'scopes', 'tokenPreview', 'createdAt', 'lastUsedAt'],
	properties: {
		id: { type: 'string' },
		label: { type: 'string' },
		scopes: {
			type: 'array',
			items: { type: 'string' }
		},
		tokenPreview: { type: 'string' },
		createdAt: { type: 'string' },
		lastUsedAt: { type: ['string', 'null'] }
	}
};

async function listQuickTokensRoute(app) {
	app.get(
		'/quick-tokens',
		{
			schema: {
				response: {
					200: {
						type: 'object',
						required: ['tokens'],
						properties: {
							tokens: {
								type: 'array',
								items: quickTokenJsonSchema
							}
						}
					}
				}
			}
		},
		async (request) => {
			const tokens = await listQuickTokens(app.mongo.db, {
				userId: request.auth.userId
			});

			return {
				tokens
			};
		}
	);
}

module.exports = listQuickTokensRoute;
module.exports.quickTokenJsonSchema = quickTokenJsonSchema;
