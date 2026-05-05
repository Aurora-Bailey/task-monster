const { ObjectId } = require("mongodb");

const {
  getCurrentLocalDay,
  getUtcRangeForLocalDay,
  isValidDayString,
  parseTimezoneOffsetMinutes,
} = require("../../lib/local-days");
const {
  buildPanicLogItemsForWindow,
  loadPanicRunsOverlappingWindow,
} = require("../../lib/panic");

const DEFAULT_DAY_COUNT = 10;
const MAX_DAY_COUNT = 31;

function shiftDay(day, deltaDays) {
  const [year, month, date] = day
    .split("-")
    .map((part) => Number.parseInt(part, 10));
  const shifted = new Date(
    Date.UTC(year, month - 1, date + deltaDays, 0, 0, 0, 0),
  );

  return shifted.toISOString().slice(0, 10);
}

function parseDayCount(value) {
  if (value === undefined || value === null) {
    return DEFAULT_DAY_COUNT;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_DAY_COUNT) {
    throw new Error(`Invalid count. Use 1-${MAX_DAY_COUNT}.`);
  }

  return parsed;
}

function getFallbackTask(taskId) {
  return {
    id: taskId,
    name: "Unknown task",
    color: "#6f7d8b",
    colorKey: "unknown",
  };
}

const heatmapStatsSchema = {
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {
      startDay: {
        type: "string",
      },
      count: {
        type: "string",
      },
      tzOffsetMinutes: {
        type: "string",
      },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["startDay", "count", "days"],
      properties: {
        startDay: { type: "string" },
        count: { type: "integer" },
        days: {
          type: "array",
          items: {
            type: "object",
            required: ["day", "sessions", "panicSessions"],
            properties: {
              day: { type: "string" },
              sessions: {
                type: "array",
                items: {
                  type: "object",
                  required: [
                    "id",
                    "taskId",
                    "name",
                    "color",
                    "colorKey",
                    "startedAt",
                    "endedAt",
                  ],
                  properties: {
                    id: { type: "string" },
                    taskId: { type: "string" },
                    name: { type: "string" },
                    color: { type: "string" },
                    colorKey: { type: "string" },
                    startedAt: { type: "string" },
                    endedAt: { type: "string" },
                  },
                },
              },
              panicSessions: {
                type: "array",
                items: {
                  type: "object",
                  required: [
                    "id",
                    "startedAt",
                    "endedAt",
                    "milliseconds",
                    "note",
                    "emotionalCharge",
                  ],
                  properties: {
                    id: { type: "string" },
                    startedAt: { type: "string" },
                    endedAt: { type: "string" },
                    milliseconds: { type: "integer" },
                    note: { type: ["string", "null"] },
                    emotionalCharge: { type: ["integer", "null"] },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

async function heatmapStatsRoute(app) {
  app.get(
    "/stats/heatmap",
    {
      schema: heatmapStatsSchema,
    },
    async (request, reply) => {
      let timezoneOffsetMinutes;
      let count;

      try {
        timezoneOffsetMinutes = parseTimezoneOffsetMinutes(
          request.query.tzOffsetMinutes,
        );
        count = parseDayCount(request.query.count);
      } catch (error) {
        return reply.code(400).send({
          message: error.message,
        });
      }

      if (
        request.query.startDay !== undefined &&
        !isValidDayString(request.query.startDay)
      ) {
        return reply.code(400).send({
          message: "Invalid start day.",
        });
      }

      const startDay =
        request.query.startDay || getCurrentLocalDay(timezoneOffsetMinutes);
      const days = Array.from({ length: count }, (_, index) => {
        const day = shiftDay(startDay, -index);
        const range = getUtcRangeForLocalDay(day, timezoneOffsetMinutes);

        return {
          day,
          ...range,
          sessions: [],
          panicSessions: [],
        };
      });
      const newestEndedBefore = days[0].endedBefore;
      const oldestStartedAt = days[days.length - 1].startedAt;
      const now = new Date();
      const userId = new ObjectId(request.auth.userId);

      const taskRuns = await app.mongo.db
        .collection("task_runs")
        .find({
          userId,
          startedAt: {
            $lt: newestEndedBefore,
          },
          $or: [
            {
              endedAt: null,
            },
            {
              endedAt: {
                $gt: oldestStartedAt,
              },
            },
          ],
        })
        .sort({
          startedAt: 1,
        })
        .toArray();
      const panicRuns = await loadPanicRunsOverlappingWindow(app.mongo.db, {
        userId,
        startedAt: oldestStartedAt,
        endedAt: newestEndedBefore,
      });

      const taskIds = [
        ...new Set(taskRuns.map((taskRun) => taskRun.taskId.toString())),
      ];
      const tasks = taskIds.length
        ? await app.mongo.db
            .collection("tasks")
            .find({
              _id: {
                $in: taskIds.map((taskId) => new ObjectId(taskId)),
              },
            })
            .toArray()
        : [];
      const tasksById = new Map(
        tasks.map((task) => [
          task._id.toString(),
          {
            id: task._id.toString(),
            name:
              typeof task.name === "string" && task.name
                ? task.name
                : "Unknown task",
            color:
              typeof task.colorHex === "string" && task.colorHex
                ? task.colorHex
                : "#6f7d8b",
            colorKey:
              typeof task.colorKey === "string" && task.colorKey
                ? task.colorKey
                : "unknown",
          },
        ]),
      );

      for (const taskRun of taskRuns) {
        const taskId = taskRun.taskId.toString();
        const task = tasksById.get(taskId) || getFallbackTask(taskId);
        const rawEndedAt = taskRun.endedAt || now;

        for (const dayItem of days) {
          if (
            taskRun.startedAt.getTime() >= dayItem.endedBefore.getTime() ||
            rawEndedAt.getTime() <= dayItem.startedAt.getTime()
          ) {
            continue;
          }

          const effectiveStartedAt = new Date(
            Math.max(taskRun.startedAt.getTime(), dayItem.startedAt.getTime()),
          );
          const effectiveEndedAt = new Date(
            Math.min(rawEndedAt.getTime(), dayItem.endedBefore.getTime()),
          );

          if (effectiveEndedAt <= effectiveStartedAt) {
            continue;
          }

          dayItem.sessions.push({
            id: taskRun._id.toString(),
            taskId,
            name: task.name,
            color: task.color,
            colorKey: task.colorKey,
            startedAt: effectiveStartedAt.toISOString(),
            endedAt: effectiveEndedAt.toISOString(),
          });
        }
      }

      for (const dayItem of days) {
        dayItem.panicSessions = buildPanicLogItemsForWindow({
          panicRuns,
          startedAt: dayItem.startedAt,
          endedAt: dayItem.endedBefore,
          now,
        });
      }

      return {
        startDay,
        count,
        days: days.map((dayItem) => ({
          day: dayItem.day,
          sessions: dayItem.sessions,
          panicSessions: dayItem.panicSessions,
        })),
      };
    },
  );
}

module.exports = heatmapStatsRoute;
