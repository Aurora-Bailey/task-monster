const { ObjectId } = require('mongodb');

const { hashPassword, verifyPassword } = require('../../lib/passwords');
const { revokeOtherSessions } = require('../../lib/sessions');

const updateUserPasswordSchema = {
	body: {
		type: 'object',
		required: ['currentPassword', 'newPassword'],
		additionalProperties: false,
		properties: {
			currentPassword: {
				type: 'string',
				minLength: 1,
				maxLength: 128
			},
			newPassword: {
				type: 'string',
				minLength: 8,
				maxLength: 128
			}
		}
	},
	response: {
		200: {
			type: 'object',
			required: ['passwordChangedAt', 'revokedSessionCount'],
			properties: {
				passwordChangedAt: { type: 'string' },
				revokedSessionCount: { type: 'integer' }
			}
		}
	}
};

async function updateUserPasswordRoute(app) {
	app.patch('/users/password', { schema: updateUserPasswordSchema }, async (request, reply) => {
		const { currentPassword, newPassword } = request.body;
		const userId = new ObjectId(request.auth.userId);
		const user = await app.mongo.db.collection('users').findOne(
			{
				_id: userId
			},
			{
				projection: {
					passwordHash: 1
				}
			}
		);

		if (!user) {
			return reply.code(404).send({
				message: 'User not found.'
			});
		}

		const currentPasswordMatches = await verifyPassword(currentPassword, user.passwordHash);

		if (!currentPasswordMatches) {
			return reply.code(400).send({
				message: 'Current password is incorrect.'
			});
		}

		const reusesCurrentPassword = await verifyPassword(newPassword, user.passwordHash);

		if (reusesCurrentPassword) {
			return reply.code(400).send({
				message: 'New password must be different from the current password.'
			});
		}

		const passwordHash = await hashPassword(newPassword);
		const passwordChangedAt = new Date();
		const updateResult = await app.mongo.db.collection('users').updateOne(
			{
				_id: userId,
				passwordHash: user.passwordHash
			},
			{
				$set: {
					passwordHash,
					updatedAt: passwordChangedAt
				}
			}
		);

		if (updateResult.matchedCount === 0) {
			return reply.code(409).send({
				message: 'Password changed while this request was running. Reload and try again.'
			});
		}

		const revokeResult = await revokeOtherSessions(app.mongo.db, {
			userId: request.auth.userId,
			currentSessionId: request.auth.sessionId,
			revokedAt: passwordChangedAt
		});

		return {
			passwordChangedAt: passwordChangedAt.toISOString(),
			revokedSessionCount: revokeResult.modifiedCount
		};
	});
}

module.exports = updateUserPasswordRoute;
