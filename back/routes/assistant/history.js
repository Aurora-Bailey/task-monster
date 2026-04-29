const {
	assistantHistoryMessageJsonSchema,
	clampAssistantHistoryLimit,
	listAssistantHistoryMessages
} = require('../../lib/assistant-history');

const assistantHistorySchema = {
	querystring: {
		type: 'object',
		additionalProperties: false,
		properties: {
			limit: {
				type: 'integer',
				minimum: 1,
				maximum: 60
			}
		}
	},
	response: {
		200: {
			type: 'object',
			required: ['messages'],
			additionalProperties: false,
			properties: {
				messages: {
					type: 'array',
					items: assistantHistoryMessageJsonSchema
				}
			}
		}
	}
};

async function assistantHistoryRoute(app) {
	app.get(
		'/assistant/history',
		{
			schema: assistantHistorySchema
		},
		async (request) => {
			const messages = await listAssistantHistoryMessages(app.mongo.db, {
				userId: request.auth.userId,
				limit: clampAssistantHistoryLimit(request.query.limit)
			});

			return {
				messages
			};
		}
	);
}

module.exports = assistantHistoryRoute;
