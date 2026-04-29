const { ObjectId } = require('mongodb');

const DEFAULT_ASSISTANT_HISTORY_LIMIT = 12;
const MAX_ASSISTANT_HISTORY_LIMIT = 60;

const assistantHistoryActionJsonSchema = {
	type: 'object',
	required: ['type', 'label'],
	additionalProperties: false,
	properties: {
		type: { type: 'string' },
		label: { type: 'string' },
		taskId: { type: ['string', 'null'] },
		taskName: { type: ['string', 'null'] }
	}
};

const assistantHistoryMessageJsonSchema = {
	type: 'object',
	required: ['id', 'role', 'content', 'actions', 'createdAt'],
	additionalProperties: false,
	properties: {
		id: { type: 'string' },
		role: {
			type: 'string',
			enum: ['user', 'assistant']
		},
		content: {
			type: 'string'
		},
		actions: {
			type: 'array',
			items: assistantHistoryActionJsonSchema
		},
		createdAt: {
			type: 'string',
			format: 'date-time'
		}
	}
};

function clampAssistantHistoryLimit(value) {
	if (!Number.isInteger(value)) {
		return DEFAULT_ASSISTANT_HISTORY_LIMIT;
	}

	return Math.min(MAX_ASSISTANT_HISTORY_LIMIT, Math.max(1, value));
}

function sanitizeAssistantHistoryActions(actions) {
	if (!Array.isArray(actions)) {
		return [];
	}

	return actions
		.map((action) => ({
			type: typeof action?.type === 'string' ? action.type : 'change',
			label: typeof action?.label === 'string' ? action.label : '',
			taskId: typeof action?.taskId === 'string' ? action.taskId : null,
			taskName: typeof action?.taskName === 'string' ? action.taskName : null
		}))
		.filter((action) => action.label.length > 0);
}

function sanitizeAssistantHistoryMessage(message) {
	if (!message || (message.role !== 'user' && message.role !== 'assistant')) {
		return null;
	}

	const content = String(message.content || '').trim();

	if (!content) {
		return null;
	}

	return {
		role: message.role,
		content,
		actions: message.role === 'assistant' ? sanitizeAssistantHistoryActions(message.actions) : [],
		createdAt: message.createdAt instanceof Date ? message.createdAt : new Date()
	};
}

function serializeAssistantHistoryMessage(message) {
	return {
		id: message._id.toString(),
		role: message.role,
		content: message.content,
		actions: sanitizeAssistantHistoryActions(message.actions),
		createdAt: message.createdAt.toISOString()
	};
}

async function appendAssistantHistoryMessages(db, { userId, messages }) {
	const nextMessages = Array.isArray(messages)
		? messages
				.map((message) => sanitizeAssistantHistoryMessage(message))
				.filter(Boolean)
				.map((message) => ({
					userId: new ObjectId(userId),
					...message
				}))
		: [];

	if (nextMessages.length === 0) {
		return [];
	}

	await db.collection('assistant_messages').insertMany(nextMessages, {
		ordered: true
	});

	return nextMessages;
}

async function listAssistantHistoryMessages(db, { userId, limit = DEFAULT_ASSISTANT_HISTORY_LIMIT } = {}) {
	const documents = await db
		.collection('assistant_messages')
		.find({
			userId: new ObjectId(userId)
		})
		.sort({
			createdAt: -1,
			_id: -1
		})
		.limit(clampAssistantHistoryLimit(limit))
		.toArray();

	return documents.reverse().map(serializeAssistantHistoryMessage);
}

module.exports = {
	assistantHistoryActionJsonSchema,
	assistantHistoryMessageJsonSchema,
	appendAssistantHistoryMessages,
	clampAssistantHistoryLimit,
	listAssistantHistoryMessages
};
