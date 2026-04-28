const { assistantChatSchema, runAssistantChat } = require('../../lib/assistant');

async function assistantChatRoute(app) {
	app.post(
		'/assistant/chat',
		{
			schema: assistantChatSchema
		},
		async (request, reply) => {
			try {
				const result = await runAssistantChat(app, request, request.body);
				return result;
			} catch (error) {
				const statusCode =
					error.message === 'OPENAI_API_KEY is not configured on the backend.' ? 503 : 400;

				return reply.code(statusCode).send({
					message: error.message || 'Assistant request failed.'
				});
			}
		}
	);
}

module.exports = assistantChatRoute;
