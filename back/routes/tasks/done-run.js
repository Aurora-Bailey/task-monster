const { ObjectId } = require('mongodb');

const {
	loadPanicRunsForTaskRuns,
	serializeCompletedTaskRun
} = require('../../lib/completed-task-runs');
const { syncTaskRunHistoryFields } = require('../../lib/task-runs');
const { serializedCompletedTaskJsonSchema } = require('../../lib/tasks');

const doneRunParamsSchema = {
	type: 'object',
	required: ['runId'],
	properties: {
		runId: { type: 'string' }
	}
};

const updateDoneRunSchema = {
	params: doneRunParamsSchema,
	body: {
		type: 'object',
		additionalProperties: false,
		properties: {
			startedAt: {
				type: 'string',
				format: 'date-time'
			},
			endedAt: {
				type: 'string',
				format: 'date-time'
			}
		}
	},
	response: {
		200: {
			type: 'object',
			required: ['task'],
			properties: {
				task: serializedCompletedTaskJsonSchema
			}
		}
	}
};

const eraseDoneRunSchema = {
	params: doneRunParamsSchema,
	response: {
		200: {
			type: 'object',
			required: ['runId', 'taskId'],
			properties: {
				runId: { type: 'string' },
				taskId: { type: 'string' }
			}
		}
	}
};

function parseDoneRunTime(value, label) {
	const parsedTime = new Date(value);

	if (Number.isNaN(parsedTime.getTime())) {
		throw new Error(`${label} time is not valid.`);
	}

	return parsedTime;
}

async function findOwnedDoneRun(db, { userId, runId }) {
	return db.collection('task_runs').findOne({
		_id: new ObjectId(runId),
		userId: new ObjectId(userId),
		endingReason: 'done',
		endedAt: {
			$ne: null
		}
	});
}

async function loadCompletedRunTask(db, { userId, taskRun }) {
	const task = await db.collection('tasks').findOne({
		_id: taskRun.taskId,
		userId: new ObjectId(userId)
	});

	return task ? { ...taskRun, task } : null;
}

async function doneRunRoute(app) {
	app.patch(
		'/tasks/done-runs/:runId',
		{
			schema: updateDoneRunSchema
		},
		async (request, reply) => {
			const { runId } = request.params;

			if (!ObjectId.isValid(runId)) {
				return reply.code(400).send({
					message: 'Invalid done run id.'
				});
			}

			if (Object.keys(request.body || {}).length === 0) {
				return reply.code(400).send({
					message: 'No done run time changes were provided.'
				});
			}

			const taskRun = await findOwnedDoneRun(app.mongo.db, {
				userId: request.auth.userId,
				runId
			});

			if (!taskRun) {
				return reply.code(404).send({
					message: 'Completed task run not found.'
				});
			}

			let startedAt = taskRun.startedAt;
			let endedAt = taskRun.endedAt;

			try {
				if (typeof request.body.startedAt === 'string') {
					startedAt = parseDoneRunTime(request.body.startedAt, 'Start');
				}

				if (typeof request.body.endedAt === 'string') {
					endedAt = parseDoneRunTime(request.body.endedAt, 'End');
				}
			} catch (error) {
				return reply.code(400).send({
					message: error.message
				});
			}

			if (endedAt.getTime() < startedAt.getTime()) {
				return reply.code(400).send({
					message: 'End time cannot be earlier than start time.'
				});
			}

			const updatedAt = new Date();
			const updatedTaskRun = await app.mongo.db.collection('task_runs').findOneAndUpdate(
				{
					_id: taskRun._id,
					userId: taskRun.userId,
					endingReason: 'done',
					endedAt: {
						$ne: null
					}
				},
				{
					$set: {
						startedAt,
						endedAt,
						updatedAt
					}
				},
				{
					returnDocument: 'after'
				}
			);

			if (!updatedTaskRun) {
				return reply.code(409).send({
					message: 'Completed task run could not be updated.'
				});
			}

			await syncTaskRunHistoryFields(app.mongo.db, {
				userId: request.auth.userId,
				taskId: updatedTaskRun.taskId,
				updatedAt
			});

			const completedTaskRun = await loadCompletedRunTask(app.mongo.db, {
				userId: request.auth.userId,
				taskRun: updatedTaskRun
			});

			if (!completedTaskRun) {
				return reply.code(404).send({
					message: 'Task not found.'
				});
			}

			const panicRuns = await loadPanicRunsForTaskRuns(app.mongo.db, {
				userId: request.auth.userId,
				taskRuns: [completedTaskRun]
			});

			return {
				task: serializeCompletedTaskRun(completedTaskRun, {
					measuredAt: updatedAt,
					panicRuns
				})
			};
		}
	);

	app.delete(
		'/tasks/done-runs/:runId',
		{
			schema: eraseDoneRunSchema
		},
		async (request, reply) => {
			const { runId } = request.params;

			if (!ObjectId.isValid(runId)) {
				return reply.code(400).send({
					message: 'Invalid done run id.'
				});
			}

			const taskRun = await findOwnedDoneRun(app.mongo.db, {
				userId: request.auth.userId,
				runId
			});

			if (!taskRun) {
				return reply.code(404).send({
					message: 'Completed task run not found.'
				});
			}

			const task = await app.mongo.db.collection('tasks').findOne({
				_id: taskRun.taskId,
				userId: taskRun.userId
			});
			const deleted = await app.mongo.db.collection('task_runs').deleteOne({
				_id: taskRun._id,
				userId: taskRun.userId,
				endingReason: 'done'
			});

			if (deleted.deletedCount !== 1) {
				return reply.code(409).send({
					message: 'Completed task run could not be erased.'
				});
			}

			await syncTaskRunHistoryFields(app.mongo.db, {
				userId: request.auth.userId,
				taskId: taskRun.taskId,
				updatedAt: new Date(),
				restoreOneTimeWithoutDoneRuns: task?.mode === 'one-time' && task.archived === true
			});

			return {
				runId,
				taskId: taskRun.taskId.toString()
			};
		}
	);
}

module.exports = doneRunRoute;
