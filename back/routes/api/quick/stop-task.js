const { ObjectId } = require('mongodb');

const { runQuickStopTask, validateQuickActionNotes } = require('../../../lib/quick-actions');
const { requireQuickToken } = require('../../../lib/quick-tokens');

async function quickStopTaskRoute(app) {
	app.post(
		'/api/quick/stop-task',
		{
			config: {
				isPublic: true
			},
			preHandler: requireQuickToken(['tasks:stop']),
			schema: {
				body: {
					type: 'object',
					additionalProperties: false,
					properties: {
						source: { type: 'string' },
						action: { type: 'string' },
						notes: { type: ['string', 'null'] },
						taskId: {}
					}
				},
				response: {
					200: {
						type: 'object',
						required: [
							'ok',
							'action',
							'message',
							'stoppedCount',
							'taskId',
							'taskTitle',
							'at'
						],
						properties: {
							ok: { type: 'boolean' },
							action: { type: 'string' },
							message: { type: 'string' },
							stoppedCount: { type: 'integer' },
							taskId: { type: 'string' },
							taskTitle: { type: 'string' },
							at: { type: 'string' }
						}
					}
				}
			}
		},
		async (request, reply) => {
			const taskId = request.body?.taskId;
			const notesValidation = validateQuickActionNotes(request.body?.notes);

			if (typeof taskId !== 'string' || !ObjectId.isValid(taskId)) {
				return reply.code(400).send({
					ok: false,
					error: 'invalid_task_id',
					message: 'Invalid task id'
				});
			}

			if (!notesValidation.ok) {
				return reply.code(400).send({
					ok: false,
					error: notesValidation.error,
					message: notesValidation.message
				});
			}

			const at = new Date();
			const result = await runQuickStopTask(app.mongo.db, {
				userId: request.quick.userId,
				taskId,
				quickTokenId: request.quick.tokenId,
				notes: notesValidation.notes,
				at
			});

			if (!result) {
				return reply.code(404).send({
					ok: false,
					error: 'task_not_found',
					message: 'Task not found'
				});
			}

			return {
				ok: true,
				action: 'stop-task',
				message:
					result.stoppedCount === 1
						? `${result.taskTitle} marked done`
						: result.notStoppedReason === 'not_owned'
							? `${result.taskTitle} cannot be stopped by this token`
							: `${result.taskTitle} already stopped`,
				stoppedCount: result.stoppedCount,
				taskId: result.taskId,
				taskTitle: result.taskTitle,
				at: at.toISOString()
			};
		}
	);
}

module.exports = quickStopTaskRoute;
