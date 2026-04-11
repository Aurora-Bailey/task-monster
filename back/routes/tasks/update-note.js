const { ObjectId } = require('mongodb');

const { serializedTaskJsonSchema, serializeTask } = require('../../lib/tasks');

const updateTaskNoteSchema = {
	params: {
		type: 'object',
		required: ['taskId'],
		properties: {
			taskId: { type: 'string' }
		}
	},
	body: {
		type: 'object',
		required: ['note'],
		additionalProperties: false,
		properties: {
			note: {
				type: ['string', 'null'],
				maxLength: 2000
			}
		}
	},
	response: {
		200: {
			type: 'object',
			required: ['task'],
			properties: {
				task: serializedTaskJsonSchema
			}
		}
	}
};

async function updateTaskNoteRoute(app) {
	app.patch(
		'/tasks/:taskId/note',
		{
			schema: updateTaskNoteSchema
		},
		async (request, reply) => {
			const { taskId } = request.params;

			if (!ObjectId.isValid(taskId)) {
				return reply.code(400).send({
					message: 'Invalid task id.'
				});
			}

			const rawNote = request.body.note;
			const note = typeof rawNote === 'string' ? rawNote.trim() : null;
			const updatedAt = new Date();

			const result = await app.mongo.db.collection('tasks').findOneAndUpdate(
				{
					_id: new ObjectId(taskId),
					userId: new ObjectId(request.auth.userId)
				},
				{
					$set: {
						note: note || null,
						updatedAt
					}
				},
				{
					returnDocument: 'after'
				}
			);

			if (!result) {
				return reply.code(404).send({
					message: 'Task not found.'
				});
			}

			return {
				task: serializeTask(result)
			};
		}
	);
}

module.exports = updateTaskNoteRoute;
