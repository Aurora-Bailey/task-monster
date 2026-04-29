const { appendAssistantHistoryMessages } = require('../../lib/assistant-history');
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
				const latestUserMessage = request.body.messages.at(-1);

				try {
					await appendAssistantHistoryMessages(app.mongo.db, {
						userId: request.auth.userId,
						messages: [
							{
								role: 'user',
								content: typeof latestUserMessage?.content === 'string' ? latestUserMessage.content : '',
								createdAt: new Date()
							},
							{
								role: 'assistant',
								content: result.reply || '',
								actions: Array.isArray(result.actions) ? result.actions : [],
								createdAt: new Date()
							}
						]
					});
				} catch (historyError) {
					app.log.error(
						{
							err: historyError,
							userId: request.auth.userId
						},
						'Failed to persist assistant chat history.'
					);
				}

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
