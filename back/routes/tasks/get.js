const { ObjectId } = require("mongodb");

const {
  findOwnedTask,
  serializedTaskJsonSchema,
  serializeTask,
} = require("../../lib/tasks");

const getTaskSchema = {
  params: {
    type: "object",
    required: ["taskId"],
    properties: {
      taskId: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["task"],
      properties: {
        task: serializedTaskJsonSchema,
      },
    },
  },
};

async function getTaskRoute(app) {
  app.get(
    "/tasks/:taskId",
    {
      schema: getTaskSchema,
    },
    async (request, reply) => {
      const { taskId } = request.params;

      if (!ObjectId.isValid(taskId)) {
        return reply.code(400).send({
          message: "Invalid task id.",
        });
      }

      const task = await findOwnedTask(app.mongo.db, {
        taskId,
        userId: request.auth.userId,
      });

      if (!task) {
        return reply.code(404).send({
          message: "Task not found.",
        });
      }

      return {
        task: serializeTask(task),
      };
    },
  );
}

module.exports = getTaskRoute;
