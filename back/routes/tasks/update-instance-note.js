const { ObjectId } = require('mongodb');

const { updateOpenTaskRunInstanceNote } = require('../../lib/task-runs');
const { findOwnedTask, serializedTaskJsonSchema, serializeTask } = require('../../lib/tasks');

const updateTaskInstanceNoteSchema = {
	params: {
		type: 'object',
		required: ['taskId'],
		properties: {
			taskId: { type: 'string' }
		}
	},
	body: {
		type: 'object',
		required: ['instanceNote'],
		additionalProperties: false,
		properties: {
			instanceNote: {
				type: ['string', 'null'],
				maxLength: 4000
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

async function updateTaskInstanceNoteRoute(app) {
	app.patch(
		'/tasks/:taskId/instance-note',
		{
			schema: updateTaskInstanceNoteSchema
		},
		async (request, reply) => {
			const { taskId } = request.params;

			if (!ObjectId.isValid(taskId)) {
				return reply.code(400).send({
					message: 'Invalid task id.'
				});
			}

			const task = await findOwnedTask(app.mongo.db, {
				taskId,
				userId: request.auth.userId
			});

			if (!task || task.archived) {
				return reply.code(404).send({
					message: 'Task not found.'
				});
			}

			if (!task.activeToday) {
				return reply.code(409).send({
					message: 'Task must be active before its instance note can be updated.'
				});
			}

			const rawInstanceNote = request.body.instanceNote;
			const instanceNote = typeof rawInstanceNote === 'string' ? rawInstanceNote : null;
			const updatedAt = new Date();
			const updatedTaskRun = await updateOpenTaskRunInstanceNote(app.mongo.db, {
				userId: request.auth.userId,
				taskId,
				instanceNote,
				updatedAt
			});

			if (!updatedTaskRun) {
				return reply.code(409).send({
					message: 'Task must be active before its instance note can be updated.'
				});
			}

			return {
				task: serializeTask({
					...task,
					instanceNote: updatedTaskRun.instanceNote ?? null
				})
			};
		}
	);
}

module.exports = updateTaskInstanceNoteRoute;
