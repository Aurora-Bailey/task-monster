const { ObjectId } = require('mongodb');

const { createQuickActionToken, hashAuthToken, parseBearerToken } = require('./tokens');

const QUICK_TOKEN_SCOPES = Object.freeze(['tasks:stop', 'tasks:next', 'tasks:start']);
const QUICK_TOKEN_LEGACY_SCOPE_ALIASES = Object.freeze({
	'tasks:start': ['tasks:next']
});

function normalizeQuickTokenLabel(label) {
	if (typeof label !== 'string') {
		return 'iPhone + Watch';
	}

	const normalized = label.trim().replace(/\s+/g, ' ');

	return normalized || 'iPhone + Watch';
}

function serializeQuickToken(token) {
	return {
		id: token._id.toString(),
		label: token.label,
		scopes: Array.isArray(token.scopes) ? token.scopes : [],
		tokenPreview: token.tokenPreview,
		createdAt: token.createdAt.toISOString(),
		lastUsedAt: token.lastUsedAt ? token.lastUsedAt.toISOString() : null
	};
}

async function createQuickToken(db, { userId, label, scopes = QUICK_TOKEN_SCOPES }) {
	const rawToken = createQuickActionToken();
	const tokenHash = hashAuthToken(rawToken);
	const createdAt = new Date();
	const tokenDocument = {
		userId: new ObjectId(userId),
		tokenHash,
		tokenPreview: rawToken.slice(-8),
		label: normalizeQuickTokenLabel(label),
		scopes: scopes.filter((scope) => QUICK_TOKEN_SCOPES.includes(scope)),
		createdAt,
		lastUsedAt: null,
		revokedAt: null
	};
	const result = await db.collection('quick_action_tokens').insertOne(tokenDocument);
	const insertedToken = {
		...tokenDocument,
		_id: result.insertedId
	};

	return {
		rawToken,
		token: serializeQuickToken(insertedToken)
	};
}

async function listQuickTokens(db, { userId }) {
	const tokens = await db
		.collection('quick_action_tokens')
		.find({
			userId: new ObjectId(userId),
			revokedAt: null
		})
		.sort({
			createdAt: -1
		})
		.toArray();

	return tokens.map(serializeQuickToken);
}

async function revokeQuickToken(db, { userId, tokenId, revokedAt = new Date() }) {
	return db.collection('quick_action_tokens').findOneAndUpdate(
		{
			_id: new ObjectId(tokenId),
			userId: new ObjectId(userId),
			revokedAt: null
		},
		{
			$set: {
				revokedAt
			}
		},
		{
			returnDocument: 'after'
		}
	);
}

function requireQuickToken(requiredScopes = []) {
	return async function quickTokenPreHandler(request, reply) {
		const token = parseBearerToken(request.headers.authorization);

		if (!token) {
			return reply.code(401).send({
				ok: false,
				error: 'invalid_token'
			});
		}

		const tokenHash = hashAuthToken(token);
		const record = await request.server.mongo.db.collection('quick_action_tokens').findOne({
			tokenHash,
			revokedAt: null
		});

		if (!record) {
			return reply.code(401).send({
				ok: false,
				error: 'invalid_token'
			});
		}

		const scopes = Array.isArray(record.scopes) ? record.scopes : [];
		const missingScope = requiredScopes.find((scope) => {
			if (scopes.includes(scope)) {
				return false;
			}

			return !QUICK_TOKEN_LEGACY_SCOPE_ALIASES[scope]?.some((alias) => scopes.includes(alias));
		});

		if (missingScope) {
			return reply.code(403).send({
				ok: false,
				error: 'missing_scope'
			});
		}

		request.quick = {
			tokenId: record._id.toString(),
			userId: record.userId.toString()
		};

		await request.server.mongo.db.collection('quick_action_tokens').updateOne(
			{
				_id: record._id
			},
			{
				$set: {
					lastUsedAt: new Date()
				}
			}
		);
	};
}

module.exports = {
	QUICK_TOKEN_SCOPES,
	createQuickToken,
	listQuickTokens,
	normalizeQuickTokenLabel,
	requireQuickToken,
	revokeQuickToken,
	serializeQuickToken
};
