const { ObjectId } = require('mongodb');

const {
	getCurrentLocalDay,
	isValidDayString,
	parseTimezoneOffsetMinutes
} = require('./local-days');
const {
	TASK_COLOR_MAP,
	TASK_MODE_VALUES,
	TASK_TRACKING_TYPE_VALUES,
	toObjectId
} = require('./tasks');

const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';
const TOOL_LOOP_LIMIT = 8;
const MAX_CONVERSATION_MESSAGES = 12;
const DEFAULT_BOARD_SECTION_LIMIT = 8;
const MAX_BOARD_SECTION_LIMIT = 12;
const DEFAULT_SEARCH_LIMIT = 8;
const MAX_SEARCH_LIMIT = 12;
const DEFAULT_FILTER_LIMIT = 12;
const MAX_FILTER_LIMIT = 60;
const DEFAULT_LIST_LIMIT = 12;
const MAX_LIST_LIMIT = 20;
const DEFAULT_DAY_SUMMARY_LIMIT = 5;
const MAX_BULK_EDIT_MATCHES = 100;
const MAX_CREATE_TASKS_BATCH = 80;
const CREATE_TASKS_PREVIEW_LIMIT = 20;
const MAX_EDIT_TASKS_BATCH = 100;
const EDIT_TASKS_PREVIEW_LIMIT = 20;
const CREATE_TASK_GUARD_MIN_SCORE = 620;
const CREATE_TASK_GUARD_MAX_MATCHES = 3;

const TASK_CATEGORY_DETAILS = Object.freeze({
	red: { category: 'System' },
	orange: { category: 'World' },
	gold: { category: 'Home' },
	green: { category: 'Body' },
	teal: { category: 'Reset' },
	blue: { category: 'Craft' },
	violet: { category: 'Becoming' }
});

const TASK_COLOR_KEYS = Object.freeze(Object.keys(TASK_COLOR_MAP));
const TASK_STATUS_VALUES = Object.freeze(['all', 'active', 'daymap', 'inactive', 'archived']);
const TASK_MOVE_DESTINATION_VALUES = Object.freeze([
	'active',
	'daymap',
	'inactive',
	'done',
	'archived'
]);
const TASK_START_STATE_VALUES = Object.freeze(['inactive', 'daymap', 'active']);

const assistantChatSchema = {
	body: {
		type: 'object',
		required: ['messages'],
		additionalProperties: false,
		properties: {
			messages: {
				type: 'array',
				minItems: 1,
				maxItems: 64,
				items: {
					type: 'object',
					required: ['role', 'content'],
					additionalProperties: false,
					properties: {
						role: {
							type: 'string',
							enum: ['user', 'assistant']
						},
						content: {
							type: 'string',
							minLength: 1,
							maxLength: 8000
						}
					}
				}
			},
			timezoneOffsetMinutes: {
				type: 'integer',
				minimum: -840,
				maximum: 840
			},
			currentPath: {
				type: 'string',
				maxLength: 200
			}
		}
	},
	response: {
		200: {
			type: 'object',
			required: ['reply', 'actions', 'refresh'],
			properties: {
				reply: {
					type: 'string'
				},
				actions: {
					type: 'array',
					items: {
						type: 'object',
						required: ['type', 'label'],
						additionalProperties: false,
						properties: {
							type: { type: 'string' },
							label: { type: 'string' },
							taskId: { type: ['string', 'null'] },
							taskName: { type: ['string', 'null'] }
						}
					}
				},
				refresh: {
					type: 'object',
					required: ['tasks', 'stats', 'panic'],
					additionalProperties: false,
					properties: {
						tasks: { type: 'boolean' },
						stats: { type: 'boolean' },
						panic: { type: 'boolean' }
					}
				}
			}
		}
	}
};

function normalizeText(value) {
	return String(value || '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim()
		.replace(/\s+/g, ' ');
}

function tokenizeText(value) {
	const normalized = normalizeText(value);
	return normalized ? normalized.split(' ') : [];
}

function truncateText(value, maxLength) {
	if (typeof value !== 'string') {
		return null;
	}

	if (value.length <= maxLength) {
		return value;
	}

	return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function parseJsonSafely(value) {
	if (typeof value !== 'string' || !value.trim()) {
		return null;
	}

	try {
		return JSON.parse(value);
	} catch (error) {
		return null;
	}
}

function extractMessageText(content) {
	if (typeof content === 'string') {
		return content.trim();
	}

	if (!Array.isArray(content)) {
		return '';
	}

	return content
		.map((part) => {
			if (typeof part === 'string') {
				return part;
			}

			if (typeof part?.text === 'string') {
				return part.text;
			}

			if (typeof part?.content === 'string') {
				return part.content;
			}

			return '';
		})
		.filter(Boolean)
		.join('\n\n')
		.trim();
}

function buildTaskState(task) {
	if (task.archived) {
		return 'archived';
	}

	if (task.activeToday) {
		return 'active';
	}

	if (task.mappedToday) {
		return 'daymap';
	}

	return 'inactive';
}

function summarizeTask(task, openTaskRun) {
	const state = buildTaskState(task);
	const queuePosition =
		Number.isInteger(task.queuePosition) && task.queuePosition > 0 ? task.queuePosition : null;
	const note = task.note ?? null;
	const instanceNote = openTaskRun?.instanceNote ?? null;

	return {
		id: task._id.toString(),
		name: task.name,
		state,
		colorKey: task.colorKey,
		category: TASK_CATEGORY_DETAILS[task.colorKey]?.category || task.colorKey,
		mode: task.mode,
		trackingType: task.trackingType || 'time',
		tallyUnit: task.tallyUnit ?? null,
		tallyTarget: Number.isInteger(task.tallyTarget) ? task.tallyTarget : null,
		activeTallyCount: Number.isInteger(task.activeTallyCount) ? task.activeTallyCount : 0,
		daymapLocked: task.daymapLocked === true,
		queuePosition,
		notePreview: truncateText(note, 180),
		instanceNotePreview: truncateText(instanceNote, 180),
		note,
		instanceNote,
		activatedAt: task.activatedAt ? task.activatedAt.toISOString() : null,
		mappedAt: task.mappedAt ? task.mappedAt.toISOString() : null,
		nextDueAt: task.nextDueAt ? task.nextDueAt.toISOString() : null,
		lastCompletedAt: task.lastCompletedAt ? task.lastCompletedAt.toISOString() : null
	};
}

function summarizeTaskCandidate(task) {
	const state = buildTaskState(task);
	const queueLabel =
		state === 'daymap' && Number.isInteger(task.queuePosition) && task.queuePosition > 0
			? `, queued #${task.queuePosition}`
			: '';

	return `${task.name} (${state}${queueLabel})`;
}

function summarizeDuplicateGuardTask(task) {
	return {
		id: task._id.toString(),
		name: task.name,
		state: buildTaskState(task),
		category: TASK_CATEGORY_DETAILS[task.colorKey]?.category || task.colorKey,
		colorKey: task.colorKey,
		notePreview: truncateText(task.note ?? null, 180),
		queuePosition:
			Number.isInteger(task.queuePosition) && task.queuePosition > 0 ? task.queuePosition : null,
		daymapLocked: task.daymapLocked === true
	};
}

function buildCreateTaskDraftPreview(body, { startState, queued, daymapLocked }) {
	return {
		name: body.name,
		category: TASK_CATEGORY_DETAILS[body.color]?.category || body.color,
		colorKey: body.color,
		mode: body.mode,
		trackingType: body.trackingType,
		note: body.note ?? null,
		startState,
		queued,
		daymapLocked,
		nextDueAt: body.nextDueAt ?? null,
		tallyUnit: body.tallyUnit ?? null,
		tallyTarget: body.tallyTarget ?? null
	};
}

function compareCreateGuardMatches(left, right) {
	if (right.score !== left.score) {
		return right.score - left.score;
	}

	const leftState = buildTaskState(left.task);
	const rightState = buildTaskState(right.task);

	if (leftState !== rightState) {
		return leftState === 'daymap' ? -1 : 1;
	}

	const leftUpdatedAt = left.task.updatedAt instanceof Date ? left.task.updatedAt.getTime() : 0;
	const rightUpdatedAt = right.task.updatedAt instanceof Date ? right.task.updatedAt.getTime() : 0;

	if (rightUpdatedAt !== leftUpdatedAt) {
		return rightUpdatedAt - leftUpdatedAt;
	}

	return left.task.createdAt instanceof Date && right.task.createdAt instanceof Date
		? right.task.createdAt.getTime() - left.task.createdAt.getTime()
		: 0;
}

function shouldGuardCreateTaskMatch(task, queryTokens, queryNormalized) {
	const taskNormalized = normalizeText(task.name);

	if (!taskNormalized) {
		return false;
	}

	if (taskNormalized === queryNormalized || taskNormalized.startsWith(queryNormalized)) {
		return true;
	}

	const taskTokens = tokenizeText(task.name);
	const matchedTokenCount = queryTokens.filter((token) => taskTokens.includes(token)).length;

	if (queryTokens.length === 1) {
		return matchedTokenCount === 1 && taskTokens.length <= 3;
	}

	return matchedTokenCount === queryTokens.length || taskNormalized.includes(queryNormalized);
}

function findCreateTaskGuard(tasks, requestedName) {
	const queryNormalized = normalizeText(requestedName);

	if (!queryNormalized) {
		return null;
	}

	const queryTokens = tokenizeText(requestedName);
	const matches = tasks
		.filter((task) => {
			const state = buildTaskState(task);
			return state === 'inactive' || state === 'daymap';
		})
		.map((task) => ({
			task,
			score: scoreTaskMatch(task, queryTokens, queryNormalized)
		}))
		.filter(
			(entry) =>
				entry.score >= CREATE_TASK_GUARD_MIN_SCORE &&
				shouldGuardCreateTaskMatch(entry.task, queryTokens, queryNormalized)
		)
		.sort(compareCreateGuardMatches);

	if (matches.length === 0) {
		return null;
	}

	return {
		closestTask: summarizeDuplicateGuardTask(matches[0].task),
		otherCloseTasks: matches
			.slice(1, CREATE_TASK_GUARD_MAX_MATCHES)
			.map((entry) => summarizeDuplicateGuardTask(entry.task))
	};
}

async function loadOpenTaskRunMap(db, { userId, taskIds }) {
	if (taskIds.length === 0) {
		return new Map();
	}

	const openTaskRuns = await db
		.collection('task_runs')
		.find({
			userId: toObjectId(userId),
			taskId: {
				$in: taskIds
			},
			endedAt: null
		})
		.sort({
			startedAt: -1
		})
		.toArray();
	const openTaskRunMap = new Map();

	for (const taskRun of openTaskRuns) {
		const taskId = taskRun.taskId.toString();

		if (!openTaskRunMap.has(taskId)) {
			openTaskRunMap.set(taskId, taskRun);
		}
	}

	return openTaskRunMap;
}

async function loadUserTasks(db, { userId, includeArchived = false }) {
	const query = {
		userId: toObjectId(userId)
	};

	if (!includeArchived) {
		query.archived = {
			$ne: true
		};
	}

	return db
		.collection('tasks')
		.find(query)
		.sort({
			activeToday: -1,
			mappedToday: -1,
			queuePosition: 1,
			updatedAt: -1,
			createdAt: 1
		})
		.toArray();
}

function filterTasksByStatus(tasks, status) {
	if (!status || status === 'all') {
		return tasks.filter((task) => !task.archived);
	}

	return tasks.filter((task) => buildTaskState(task) === status);
}

function scoreTaskMatch(task, queryTokens, queryNormalized) {
	if (!queryNormalized) {
		return 0;
	}

	const taskNormalized = normalizeText(task.name);

	if (!taskNormalized) {
		return 0;
	}

	let score = 0;

	if (taskNormalized === queryNormalized) {
		score = 1000;
	} else if (taskNormalized.startsWith(queryNormalized)) {
		score = 880;
	} else if (taskNormalized.includes(queryNormalized)) {
		score = 760;
	}

	const taskTokens = tokenizeText(task.name);
	const matchedTokenCount = queryTokens.filter((token) => taskTokens.includes(token)).length;

	if (queryTokens.length > 0 && matchedTokenCount === queryTokens.length) {
		score = Math.max(score, 620 + queryTokens.length * 45);
	} else if (matchedTokenCount > 0) {
		score = Math.max(
			score,
			220 + Math.round((matchedTokenCount / Math.max(1, queryTokens.length)) * 200)
		);
	}

	return score;
}

function resolveTaskMatch(tasks, taskQuery) {
	if (tasks.length === 0) {
		return {
			ok: false,
			errorCode: 'no_tasks_available',
			message: 'There are no tasks available in that part of the board.'
		};
	}

	const queryNormalized = normalizeText(taskQuery);

	if (!queryNormalized) {
		if (tasks.length === 1) {
			return {
				ok: true,
				task: tasks[0]
			};
		}

		return {
			ok: false,
			errorCode: 'task_query_required',
			message: 'More than one task fits that action, so I need a task name.',
			candidates: tasks.slice(0, 5).map((task) => summarizeTaskCandidate(task))
		};
	}

	const queryTokens = tokenizeText(taskQuery);
	const scoredTasks = tasks
		.map((task) => ({
			task,
			score: scoreTaskMatch(task, queryTokens, queryNormalized)
		}))
		.filter((entry) => entry.score > 0)
		.sort((left, right) => right.score - left.score);

	if (scoredTasks.length === 0) {
		return {
			ok: false,
			errorCode: 'task_not_found',
			message: `I could not find a task matching "${taskQuery}".`
		};
	}

	const [bestMatch, secondMatch] = scoredTasks;

	if (
		secondMatch &&
		(bestMatch.score === secondMatch.score ||
			(bestMatch.score < 980 && bestMatch.score - secondMatch.score < 80))
	) {
		return {
			ok: false,
			errorCode: 'task_ambiguous',
			message: `More than one task matched "${taskQuery}".`,
			candidates: scoredTasks
				.slice(0, 5)
				.map((entry) => summarizeTaskCandidate(entry.task))
		};
	}

	if (bestMatch.score < 180) {
		return {
			ok: false,
			errorCode: 'task_not_found',
			message: `I could not confidently match "${taskQuery}" to a task.`
		};
	}

	return {
		ok: true,
		task: bestMatch.task
	};
}

async function resolveTaskForQuery(db, {
	userId,
	taskQuery,
	allowedStatuses = ['active', 'daymap', 'inactive'],
	includeArchived = false
}) {
	const tasks = await loadUserTasks(db, {
		userId,
		includeArchived
	});
	const filteredTasks = tasks.filter((task) =>
		allowedStatuses.includes(buildTaskState(task))
	);

	return resolveTaskMatch(filteredTasks, taskQuery);
}

async function injectUserRoute(app, request, { method = 'GET', url, body }) {
	const headers = {
		authorization: request.headers.authorization || ''
	};

	if (body !== undefined) {
		headers['content-type'] = 'application/json';
	}

	const response = await app.inject({
		method,
		url,
		headers,
		payload: body !== undefined ? JSON.stringify(body) : undefined
	});
	const parsedBody = parseJsonSafely(response.body);

	return {
		ok: response.statusCode >= 200 && response.statusCode < 300,
		statusCode: response.statusCode,
		body: parsedBody,
		message:
			parsedBody?.message ||
			(response.statusCode >= 200 && response.statusCode < 300
				? null
				: `Request failed with status ${response.statusCode}.`)
	};
}

function mergeRefreshFlags(target, nextRefresh) {
	target.tasks = target.tasks || nextRefresh.tasks === true;
	target.stats = target.stats || nextRefresh.stats === true;
	target.panic = target.panic || nextRefresh.panic === true;
}

function buildTaskAction(type, label, taskSummary) {
	return {
		type,
		label,
		taskId: taskSummary?.id ?? null,
		taskName: taskSummary?.name ?? null
	};
}

function buildTaskChangeAction(field, value, taskSummary) {
	return buildTaskAction('change', `Changed: ${field} - ${value}`, taskSummary);
}

function buildTaskChangeActions(changes, taskSummary) {
	return (Array.isArray(changes) ? changes : []).map((change) =>
		buildTaskChangeAction(change.field, change.value, taskSummary)
	);
}

function formatTimezoneOffsetLabel(timezoneOffsetMinutes) {
	const localOffsetMinutes = -timezoneOffsetMinutes;
	const sign = localOffsetMinutes >= 0 ? '+' : '-';
	const absoluteMinutes = Math.abs(localOffsetMinutes);
	const hours = String(Math.floor(absoluteMinutes / 60)).padStart(2, '0');
	const minutes = String(absoluteMinutes % 60).padStart(2, '0');

	return `${sign}${hours}:${minutes}`;
}

function normalizeAssistantDateTimeArgument(value, timezoneOffsetMinutes) {
	if (typeof value !== 'string') {
		return value;
	}

	const trimmed = value.trim();
	const match = trimmed.match(
		/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?$/
	);

	if (!match) {
		return trimmed;
	}

	const timezoneDesignator = match[8] || null;

	if (timezoneDesignator && timezoneDesignator !== 'Z') {
		return trimmed;
	}

	const year = Number.parseInt(match[1], 10);
	const month = Number.parseInt(match[2], 10);
	const day = Number.parseInt(match[3], 10);
	const hour = Number.parseInt(match[4], 10);
	const minute = Number.parseInt(match[5], 10);
	const second = Number.parseInt(match[6] || '0', 10);
	const millisecond = Number.parseInt((match[7] || '.0').slice(1).padEnd(3, '0').slice(0, 3), 10);
	const utcMilliseconds =
		Date.UTC(year, month - 1, day, hour, minute, second, millisecond) +
		timezoneOffsetMinutes * 60 * 1000;

	return new Date(utcMilliseconds).toISOString();
}

function buildTaskEditRequestBody(
	args,
	{
		allowName = true,
		allowStartedAt = true,
		allowActiveTallyCount = true,
		timezoneOffsetMinutes = 0
	} = {}
) {
	const body = {};

	if (allowName && typeof args.name === 'string') {
		body.name = args.name;
	}

	if (typeof args.colorKey === 'string') {
		body.color = args.colorKey;
	}

	if (typeof args.mode === 'string') {
		body.mode = args.mode;
	}

	if (typeof args.trackingType === 'string') {
		body.trackingType = args.trackingType;
	}

	if (Object.hasOwn(args, 'note')) {
		body.note = typeof args.note === 'string' ? args.note : null;
	}

	if (Object.hasOwn(args, 'nextDueAt')) {
		body.nextDueAt =
			typeof args.nextDueAt === 'string'
				? normalizeAssistantDateTimeArgument(args.nextDueAt, timezoneOffsetMinutes)
				: null;
	}

	if (Object.hasOwn(args, 'tallyUnit')) {
		body.tallyUnit = typeof args.tallyUnit === 'string' ? args.tallyUnit : null;
	}

	if (Object.hasOwn(args, 'tallyTarget')) {
		body.tallyTarget = args.tallyTarget;
	}

	if (allowActiveTallyCount && Object.hasOwn(args, 'activeTallyCount')) {
		body.activeTallyCount = args.activeTallyCount;
	}

	if (Object.hasOwn(args, 'daymapLocked')) {
		body.daymapLocked = args.daymapLocked;
	}

	if (allowStartedAt && typeof args.startedAt === 'string') {
		body.startedAt = normalizeAssistantDateTimeArgument(args.startedAt, timezoneOffsetMinutes);
	}

	return body;
}

function normalizeAssistantStatuses(statuses, { includeArchived = false } = {}) {
	const allowedStatuses = Array.isArray(statuses)
		? [...new Set(statuses.filter((status) => TASK_STATUS_VALUES.includes(status) && status !== 'all'))]
		: [];

	if (allowedStatuses.length > 0) {
		return allowedStatuses;
	}

	return includeArchived
		? ['active', 'daymap', 'inactive', 'archived']
		: ['active', 'daymap', 'inactive'];
}

function selectTasksForAssistantFilter(tasks, args = {}) {
	const includeArchived =
		args.includeArchived === true ||
		(Array.isArray(args.statuses) && args.statuses.includes('archived'));
	const allowedStatuses = normalizeAssistantStatuses(args.statuses, {
		includeArchived
	});
	const query = typeof args.query === 'string' ? args.query.trim() : '';
	const queryNormalized = normalizeText(query);
	const queryTokens = tokenizeText(query);
	const nextDueBeforeTime =
		typeof args.nextDueBefore === 'string' ? new Date(args.nextDueBefore).getTime() : null;
	const nextDueAfterTime =
		typeof args.nextDueAfter === 'string' ? new Date(args.nextDueAfter).getTime() : null;
	const filteredTasks = tasks.filter((task) => {
		const taskState = buildTaskState(task);

		if (!allowedStatuses.includes(taskState)) {
			return false;
		}

		const trackingType = task.trackingType || 'time';

		if (typeof args.trackingType === 'string' && args.trackingType !== trackingType) {
			return false;
		}

		if (typeof args.mode === 'string' && args.mode !== task.mode) {
			return false;
		}

		if (typeof args.colorKey === 'string' && args.colorKey !== task.colorKey) {
			return false;
		}

		if (
			typeof args.daymapLocked === 'boolean' &&
			args.daymapLocked !== (task.daymapLocked === true)
		) {
			return false;
		}

		const nextDueAtTime = task.nextDueAt instanceof Date ? task.nextDueAt.getTime() : null;

		if (typeof args.hasNextDue === 'boolean' && args.hasNextDue !== (nextDueAtTime !== null)) {
			return false;
		}

		if (nextDueBeforeTime !== null) {
			if (nextDueAtTime === null || nextDueAtTime > nextDueBeforeTime) {
				return false;
			}
		}

		if (nextDueAfterTime !== null) {
			if (nextDueAtTime === null || nextDueAtTime < nextDueAfterTime) {
				return false;
			}
		}

		if (!queryNormalized) {
			return true;
		}

		return scoreTaskMatch(task, queryTokens, queryNormalized) > 0;
	});

	if (!queryNormalized) {
		return {
			query: null,
			statuses: allowedStatuses,
			tasks: filteredTasks
		};
	}

	return {
		query,
		statuses: allowedStatuses,
		tasks: filteredTasks
			.map((task) => ({
				task,
				score: scoreTaskMatch(task, queryTokens, queryNormalized)
			}))
			.sort((left, right) => right.score - left.score)
			.map((entry) => entry.task)
	};
}

function collectBulkChangeSummaries(changesByTask) {
	const summaryMap = new Map();

	for (const changes of changesByTask) {
		for (const change of Array.isArray(changes) ? changes : []) {
			if (!change?.field) {
				continue;
			}

			const key = `${change.field}::${change.value ?? ''}`;

			if (!summaryMap.has(key)) {
				summaryMap.set(key, {
					field: change.field,
					value: change.value ?? ''
				});
			}
		}
	}

	return [...summaryMap.values()];
}

function clampAssistantLimit(value, { fallback, maximum }) {
	if (!Number.isInteger(value)) {
		return fallback;
	}

	return Math.min(maximum, Math.max(1, value));
}

function buildTaskSummaryOutput(taskSummary, { includeNotes = false } = {}) {
	if (!taskSummary) {
		return null;
	}

	if (includeNotes) {
		return taskSummary;
	}

	const nextSummary = {
		...taskSummary
	};

	delete nextSummary.note;
	delete nextSummary.instanceNote;

	return nextSummary;
}

function buildAssistantSystemPrompt({ username, localDay, currentPath, timezoneOffsetMinutes }) {
	return [
		'You are the in-app Task Monster assistant.',
		`You are helping the authenticated user ${username}.`,
		`The user local day is ${localDay}.`,
		`The user local timezone offset is ${formatTimezoneOffsetLabel(timezoneOffsetMinutes)}.`,
		currentPath ? `The user is currently viewing ${currentPath}.` : null,
		'',
		'Operating context:',
		'- Task Monster is a constrained task board, not a generic to-do dump.',
		'- Inactive means backlog. Daymap means on today\'s table but not currently running. Active means currently on the table. Done or archive depends on the task mode.',
		'- Time-tracked tasks record active runtime only.',
		'- Prefer reusing, moving, or updating an existing task over creating near-duplicates.',
		'- Category/color mapping: red=System, orange=World, gold=Home, green=Body, teal=Reset, blue=Craft, violet=Becoming.',
		'- Persistent task notes live on the task note. Active-run notes live on the instance note.',
		'',
		'Action policy:',
		'- Use tools for all task-specific facts and all mutations. Never guess task state, stats, or IDs.',
		'- Always call tools with a JSON object. Never omit the arguments payload. If a tool has no meaningful arguments, send {}.',
		'- For get_board_snapshot, send {"scope":"board"}. For get_day_summary, send {"scope":"day"} and add a day only when needed.',
		'- Use get_board_snapshot for broad board reads like "what can you see", "what is on my board", or "what is active right now". The snapshot task lists are previews, not exhaustive sections.',
		'- Never claim that all tasks in a status are clean, missing, or changed based only on a board snapshot preview.',
		'- Use filter_tasks for full-set checks like "show every daymap-locked task" or "which inactive tasks are due this week?".',
		'- Use bulk_edit_tasks only when every matched task gets the exact same change set. Do not use it when tasks need different colors, modes, names, notes, due dates, or other per-task values.',
		'- Use edit_tasks for targeted multi-task edits where each named task may get different metadata, especially mappings like "Task A -> blue, Task B -> red" or classification passes by task meaning.',
		'- For requests to recolor or classify all tasks by meaning, first read the full matching set with filter_tasks, then call edit_tasks with the per-task target colorKey values. Never collapse classification rules into one blanket color.',
		'- Do not loop edit_task for large set edits.',
		'- Use search_tasks for task lookup instead of trying to paginate broad task lists yourself.',
		'- Use create_tasks for pasted checklists, TODO imports, bullet lists, or requests like "turn these into individual tasks". Do not loop create_task for large lists.',
		'- For imported checklists, make one task per checklist or bullet item. Preserve quantities like "x2" in the task name unless the user explicitly asks to split quantities into separate tasks.',
		'- When an imported checklist has headings like Buy, Install, Build, Move, or Remove, fold the heading into each child task name so the tasks stay distinct and actionable.',
		'- For house, home, repair, move, remodel, or shopping TODO imports, default to colorKey=gold, mode=one-time, trackingType=time, and startState=inactive unless the user says otherwise.',
		'- Use complete_task_run when the user says a task was finished or done and especially when they mention a corrected finish time.',
		'- If a task is not active but the user gives an explicit historical start and end time, still use complete_task_run with both startedAt and completedAt.',
		'- Use control_task for activate, move to daymap, move to inactive, queue, unqueue, or archive actions.',
		'- If the user request is ambiguous, especially around task identity or whether "end" means pause vs done, ask a short clarification question instead of acting.',
		'- For single-task metadata edits like name, category, mode, tracking type, next due, tally target, task note, or active started time, prefer the edit_task tool.',
		'- If the user asks to correct when a run started or ended, pass the corrected time in the tool arguments. Do not treat a timing correction as a note.',
		'- For startedAt and completedAt tool arguments, use the user local timezone offset above. Do not send UTC Z times for ordinary local user requests.',
		'- Never change startedAt as a substitute for a requested completedAt unless the user explicitly asked to change the start time.',
		'- Interpret "pause" or "take it off active" as moving a task to daymap, not fully back to inactive, unless the user explicitly says backlog or inactive.',
		'- Interpret "inactive" or "backlog" as fully removing a task from the daymap.',
		'- If a tool result includes requiresChoice=true or errorCode=duplicate_task_guard, do not call any more mutation tools in that response. Present the choice and wait.',
		'- For duplicate-task creation guards, present exactly three numbered options:',
		'1. Use the closest existing task and say what you will do with it.',
		'2. Create an improved, more specific version and show the improved task name.',
		'3. Create the exact requested task anyway.',
		'- If the user replies with only "1", "2", or "3", treat that as the selection for the most recent duplicate-task choice and act on it.',
		'',
		'Style:',
		'- Sound calm, sharp, and slightly futuristic. More operator than cheerleader.',
		'- Format structured replies in markdown with headings, bullets, emphasis, and short sections when useful.',
		'- Convert raw milliseconds into human-readable durations unless the user explicitly asks for millisecond values.',
		'- Keep replies concise, natural, and action-oriented. Confirm what changed after successful tool use.'
	]
		.filter(Boolean)
		.join('\n');
}

function buildChoiceResolutionPrompt() {
	return [
		'The latest tool result requires user choice before any further mutation.',
		'Do not call any more tools in this response.',
		'Use the tool payload to present exactly three numbered options.',
		'Option 1 must reuse the closest existing task and describe the reuse action.',
		'Option 2 must recommend a clearer, more specific task variant and show the improved name.',
		'Option 3 must state that it will create the exact requested task anyway.',
		'If other close tasks are present, mention them after the numbered options in one short line.',
		'End by asking the user to reply with 1, 2, or 3.'
	].join('\n');
}

async function callOpenAiChatCompletion({
	apiKey,
	model,
	messages,
	tools,
	userTag
}) {
	const abortController = new AbortController();
	const timeoutId = setTimeout(() => {
		abortController.abort();
	}, 45000);

	try {
		const requestBody = {
			model,
			messages,
			user: userTag
		};

		if (Array.isArray(tools) && tools.length > 0) {
			requestBody.tools = tools;
			requestBody.tool_choice = 'auto';
			requestBody.parallel_tool_calls = false;
		}

		const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
			method: 'POST',
			headers: {
				authorization: `Bearer ${apiKey}`,
				'content-type': 'application/json'
			},
			body: JSON.stringify(requestBody),
			signal: abortController.signal
		});
		const responseBody = await response.json().catch(() => null);

		if (!response.ok) {
			throw new Error(responseBody?.error?.message || 'OpenAI request failed.');
		}

		return responseBody;
	} catch (error) {
		if (error?.name === 'AbortError') {
			throw new Error('The assistant request timed out.');
		}

		throw error;
	} finally {
		clearTimeout(timeoutId);
	}
}

async function buildTaskSummaryFromId(db, { userId, taskId }) {
	const task = await db.collection('tasks').findOne({
		_id: new ObjectId(taskId),
		userId: toObjectId(userId)
	});

	if (!task) {
		return null;
	}

	const openTaskRunMap = await loadOpenTaskRunMap(db, {
		userId,
		taskIds: [task._id]
	});

	return summarizeTask(task, openTaskRunMap.get(task._id.toString()) || null);
}

async function executeGetBoardSnapshotTool(app, request, args = {}) {
	const includeNotes = args.includeNotes === true;
	const includeArchived = args.includeArchived === true;
	const sectionLimit = clampAssistantLimit(args.limit, {
		fallback: DEFAULT_BOARD_SECTION_LIMIT,
		maximum: MAX_BOARD_SECTION_LIMIT
	});
	const tasks = await loadUserTasks(app.mongo.db, {
		userId: request.auth.userId,
		includeArchived
	});
	const activeTasks = filterTasksByStatus(tasks, 'active');
	const daymapTasks = filterTasksByStatus(tasks, 'daymap');
	const inactiveTasks = filterTasksByStatus(tasks, 'inactive');
	const archivedTasks = includeArchived ? filterTasksByStatus(tasks, 'archived') : [];
	const previewTasks = [
		...activeTasks.slice(0, sectionLimit),
		...daymapTasks.slice(0, sectionLimit),
		...inactiveTasks.slice(0, sectionLimit),
		...archivedTasks.slice(0, sectionLimit)
	];
	const openTaskRunMap = await loadOpenTaskRunMap(app.mongo.db, {
		userId: request.auth.userId,
		taskIds: previewTasks.map((task) => task._id)
	});
	const mapTasks = (nextTasks) =>
		nextTasks.slice(0, sectionLimit).map((task) =>
			buildTaskSummaryOutput(
				summarizeTask(task, openTaskRunMap.get(task._id.toString()) || null),
				{ includeNotes }
			)
		);

	return {
		output: {
			ok: true,
			previewOnly: true,
			previewLimit: sectionLimit,
			note: 'Counts are exhaustive. Task lists here are previews only. Use filter_tasks for claims about every matching task.',
			counts: {
				active: activeTasks.length,
				daymap: daymapTasks.length,
				inactive: inactiveTasks.length,
				archived: includeArchived ? archivedTasks.length : null
			},
			activePreview: mapTasks(activeTasks),
			daymapPreview: mapTasks(daymapTasks),
			inactivePreview: mapTasks(inactiveTasks),
			archivedPreview: includeArchived ? mapTasks(archivedTasks) : [],
			hasMore: {
				active: activeTasks.length > sectionLimit,
				daymap: daymapTasks.length > sectionLimit,
				inactive: inactiveTasks.length > sectionLimit,
				archived: includeArchived ? archivedTasks.length > sectionLimit : null
			}
		},
		actions: [],
		refresh: {
			tasks: false,
			stats: false,
			panic: false
		}
	};
}

async function executeSearchTasksTool(app, request, args) {
	const query = typeof args.query === 'string' ? args.query.trim() : '';

	if (!query) {
		return {
			output: {
				ok: false,
				message: 'Task search needs a query string.'
			},
			actions: [],
			refresh: {
				tasks: false,
				stats: false,
				panic: false
			}
		};
	}

	const requestedStatuses = Array.isArray(args.statuses)
		? args.statuses.filter(
				(status) => typeof status === 'string' && TASK_STATUS_VALUES.includes(status)
			)
		: [];
	const includeArchived =
		args.includeArchived === true ||
		requestedStatuses.includes('archived') ||
		requestedStatuses.includes('all');
	const allowedStatuses =
		requestedStatuses.length === 0 || requestedStatuses.includes('all')
			? ['active', 'daymap', 'inactive', ...(includeArchived ? ['archived'] : [])]
			: requestedStatuses;
	const includeNotes = args.includeNotes === true;
	const limit = clampAssistantLimit(args.limit, {
		fallback: DEFAULT_SEARCH_LIMIT,
		maximum: MAX_SEARCH_LIMIT
	});
	const tasks = (await loadUserTasks(app.mongo.db, {
		userId: request.auth.userId,
		includeArchived
	})).filter((task) => allowedStatuses.includes(buildTaskState(task)));
	const scoredTasks = tasks
		.map((task) => ({
			task,
			score: scoreTaskMatch(task, tokenizeText(query), normalizeText(query))
		}))
		.filter((entry) => entry.score > 0)
		.sort((left, right) => right.score - left.score);
	const taskIds = scoredTasks.slice(0, limit).map((entry) => entry.task._id);
	const openTaskRunMap = await loadOpenTaskRunMap(app.mongo.db, {
		userId: request.auth.userId,
		taskIds
	});

	return {
		output: {
			ok: true,
			query,
			statuses: allowedStatuses,
			totalCount: scoredTasks.length,
			tasks: scoredTasks.slice(0, limit).map((entry) =>
				buildTaskSummaryOutput(
					summarizeTask(
						entry.task,
						openTaskRunMap.get(entry.task._id.toString()) || null
					),
					{ includeNotes }
				)
			)
		},
		actions: [],
		refresh: {
			tasks: false,
			stats: false,
			panic: false
		}
	};
}

async function executeFilterTasksTool(app, request, args = {}) {
	const includeNotes = args.includeNotes === true;
	const limit = clampAssistantLimit(args.limit, {
		fallback: DEFAULT_FILTER_LIMIT,
		maximum: MAX_FILTER_LIMIT
	});
	const includeArchived =
		args.includeArchived === true ||
		(Array.isArray(args.statuses) && args.statuses.includes('archived'));
	const selection = selectTasksForAssistantFilter(
		await loadUserTasks(app.mongo.db, {
			userId: request.auth.userId,
			includeArchived
		}),
		args
	);
	const previewTasks = selection.tasks.slice(0, limit);
	const openTaskRunMap = await loadOpenTaskRunMap(app.mongo.db, {
		userId: request.auth.userId,
		taskIds: previewTasks.map((task) => task._id)
	});

	return {
		output: {
			ok: true,
			query: selection.query,
			statuses: selection.statuses,
			totalCount: selection.tasks.length,
			previewOnly: selection.tasks.length > limit,
			previewLimit: limit,
			countsAreExhaustive: true,
			tasks: previewTasks.map((task) =>
				buildTaskSummaryOutput(
					summarizeTask(task, openTaskRunMap.get(task._id.toString()) || null),
					{ includeNotes }
				)
			)
		},
		actions: [],
		refresh: {
			tasks: false,
			stats: false,
			panic: false
		}
	};
}

async function executeListTasksTool(app, request, args) {
	const status = TASK_STATUS_VALUES.includes(args.status) ? args.status : 'all';
	const limit = Math.min(
		MAX_LIST_LIMIT,
		Math.max(1, Number.isInteger(args.limit) ? args.limit : DEFAULT_LIST_LIMIT)
	);
	const search = typeof args.search === 'string' ? args.search.trim() : '';
	const includeNotes = args.includeNotes === true;
	const tasks = filterTasksByStatus(
		await loadUserTasks(app.mongo.db, {
			userId: request.auth.userId,
			includeArchived: status === 'archived'
		}),
		status
	);
	const filteredTasks = search
		? tasks
				.map((task) => ({
					task,
					score: scoreTaskMatch(task, tokenizeText(search), normalizeText(search))
				}))
				.filter((entry) => entry.score > 0)
				.sort((left, right) => right.score - left.score)
				.map((entry) => entry.task)
		: tasks;
	const taskIds = filteredTasks.slice(0, limit).map((task) => task._id);
	const openTaskRunMap = await loadOpenTaskRunMap(app.mongo.db, {
		userId: request.auth.userId,
		taskIds
	});

	return {
		output: {
			ok: true,
			status,
			search: search || null,
			totalCount: filteredTasks.length,
			tasks: filteredTasks.slice(0, limit).map((task) => {
				const taskSummary = summarizeTask(task, openTaskRunMap.get(task._id.toString()) || null);

				if (!includeNotes) {
					delete taskSummary.note;
					delete taskSummary.instanceNote;
				}

				return taskSummary;
			})
		},
		actions: [],
		refresh: {
			tasks: false,
			stats: false,
			panic: false
		}
	};
}

async function executeDaySummaryTool(app, request, args, timezoneOffsetMinutes) {
	const day = typeof args.day === 'string' && isValidDayString(args.day)
		? args.day
		: getCurrentLocalDay(timezoneOffsetMinutes);
	const includeLogs = args.includeLogs === true;
	const limit = Math.min(
		10,
		Math.max(
			1,
			Number.isInteger(args.limit) ? args.limit : DEFAULT_DAY_SUMMARY_LIMIT
		)
	);
	const statsResponse = await injectUserRoute(app, request, {
		url: `/stats/daily?day=${encodeURIComponent(day)}&tzOffsetMinutes=${timezoneOffsetMinutes}`
	});

	if (!statsResponse.ok) {
		return {
			output: {
				ok: false,
				message: statsResponse.message || 'Unable to load day summary.'
			},
			actions: [],
			refresh: {
				tasks: false,
				stats: false,
				panic: false
			}
		};
	}

	const activeTasksResponse = await executeListTasksTool(app, request, {
		status: 'active',
		limit: 6,
		includeNotes: false
	});

	return {
		output: {
			ok: true,
			selectedDay: statsResponse.body?.selectedDay ?? day,
			summary: statsResponse.body?.summary ?? null,
			topBreakdown: (statsResponse.body?.breakdown ?? []).slice(0, limit),
			activeTasks: activeTasksResponse.output.tasks,
			doneLog: includeLogs ? (statsResponse.body?.doneLog ?? []).slice(0, limit) : [],
			panicLog: includeLogs ? (statsResponse.body?.panicLog ?? []).slice(0, limit) : []
		},
		actions: [],
		refresh: {
			tasks: false,
			stats: false,
			panic: false
		}
	};
}

async function executeCreateTaskTool(app, request, args, timezoneOffsetMinutes) {
	const trackingType = args.trackingType || 'time';
	const mode = args.mode || 'repeatable';
	const colorKey = args.colorKey;
	const startState = args.startState || 'inactive';
	const queued = args.queued === true;
	const daymapLocked = args.daymapLocked === true;
	const allowDuplicate = args.allowDuplicate === true;

	if (!TASK_COLOR_KEYS.includes(colorKey)) {
		return {
			output: {
				ok: false,
				message: 'Task color must be one of the supported Task Monster colors.'
			},
			actions: [],
			refresh: {
				tasks: false,
				stats: false,
				panic: false
			}
		};
	}

	if (!TASK_MODE_VALUES.includes(mode)) {
		return {
			output: {
				ok: false,
				message: 'Task mode is not supported.'
			},
			actions: [],
			refresh: {
				tasks: false,
				stats: false,
				panic: false
			}
		};
	}

	if (!TASK_TRACKING_TYPE_VALUES.includes(trackingType)) {
		return {
			output: {
				ok: false,
				message: 'Task tracking type is not supported.'
			},
			actions: [],
			refresh: {
				tasks: false,
				stats: false,
				panic: false
			}
		};
	}

	if (!TASK_START_STATE_VALUES.includes(startState)) {
		return {
			output: {
				ok: false,
				message: 'Task start state is not supported.'
			},
			actions: [],
			refresh: {
				tasks: false,
				stats: false,
				panic: false
			}
		};
	}

	const body = {
		name: args.name,
		color: colorKey,
		mode,
		trackingType,
		note: typeof args.note === 'string' ? args.note : null,
		nextDueAt:
			typeof args.nextDueAt === 'string'
				? normalizeAssistantDateTimeArgument(args.nextDueAt, timezoneOffsetMinutes)
				: null,
		tallyUnit: null,
		tallyTarget: null
	};

	if (trackingType === 'tally') {
		if (typeof args.tallyUnit !== 'string' || !args.tallyUnit.trim()) {
			return {
				output: {
					ok: false,
					message: 'Tally tasks need a unit label.'
				},
				actions: [],
				refresh: {
					tasks: false,
					stats: false,
					panic: false
				}
			};
		}

		if (!Number.isInteger(args.tallyTarget) || args.tallyTarget < 1) {
			return {
				output: {
					ok: false,
					message: 'Tally tasks need a valid target.'
				},
				actions: [],
				refresh: {
					tasks: false,
					stats: false,
					panic: false
				}
			};
		}

		body.tallyUnit = args.tallyUnit.trim();
		body.tallyTarget = args.tallyTarget;
	}

	if (!allowDuplicate) {
		const duplicateGuard = findCreateTaskGuard(
			await loadUserTasks(app.mongo.db, {
				userId: request.auth.userId
			}),
			body.name
		);

		if (duplicateGuard) {
			return {
				output: {
					ok: false,
					errorCode: 'duplicate_task_guard',
					requiresChoice: true,
					message: `A close task match already exists for "${body.name}".`,
					closestTask: duplicateGuard.closestTask,
					otherCloseTasks: duplicateGuard.otherCloseTasks,
					requestedTask: buildCreateTaskDraftPreview(body, {
						startState,
						queued,
						daymapLocked
					}),
					optionOnePlan: {
						useExistingTaskId: duplicateGuard.closestTask.id,
						useExistingTaskName: duplicateGuard.closestTask.name,
						moveTo: startState,
						queued,
						daymapLocked,
						note: body.note ?? null
					}
				},
				actions: [],
				refresh: {
					tasks: false,
					stats: false,
					panic: false
				}
			};
		}
	}

	const createResponse = await injectUserRoute(app, request, {
		method: 'POST',
		url: '/tasks',
		body
	});

	if (!createResponse.ok) {
		return {
			output: {
				ok: false,
				message: createResponse.message || 'Unable to create the task.'
			},
			actions: [],
			refresh: {
				tasks: false,
				stats: false,
				panic: false
			}
		};
	}

	const taskId = createResponse.body?.task?.id;

	if (!taskId) {
		return {
			output: {
				ok: false,
				message: 'The task was created but the response was incomplete.'
			},
			actions: [],
			refresh: {
				tasks: true,
				stats: true,
				panic: false
			}
		};
	}

	if (daymapLocked) {
		await injectUserRoute(app, request, {
			method: 'PATCH',
			url: `/tasks/${taskId}/daymap-lock`,
			body: {
				daymapLocked: true
			}
		});
	}

	if (startState === 'daymap' || startState === 'active') {
		const daymapResponse = await injectUserRoute(app, request, {
			method: 'POST',
			url: `/tasks/${taskId}/daymap`
		});

		if (!daymapResponse.ok) {
			return {
				output: {
					ok: false,
					message: daymapResponse.message || 'Task was created but could not be moved to the daymap.'
				},
				actions: [],
				refresh: {
					tasks: true,
					stats: true,
					panic: false
				}
			};
		}
	}

	if (queued && startState === 'daymap') {
		await injectUserRoute(app, request, {
			method: 'POST',
			url: `/tasks/${taskId}/queue`
		});
	}

	if (startState === 'active') {
		const activateResponse = await injectUserRoute(app, request, {
			method: 'POST',
			url: `/tasks/${taskId}/activate`
		});

		if (!activateResponse.ok) {
			return {
				output: {
					ok: false,
					message: activateResponse.message || 'Task was created but could not be activated.'
				},
				actions: [],
				refresh: {
					tasks: true,
					stats: true,
					panic: false
				}
			};
		}
	}

	const taskSummary = await buildTaskSummaryFromId(app.mongo.db, {
		userId: request.auth.userId,
		taskId
	});

	return {
		output: {
			ok: true,
			task: taskSummary
		},
		actions: [buildTaskAction('create_task', `Created ${taskSummary?.name || 'task'}.`, taskSummary)],
		refresh: {
			tasks: true,
			stats: true,
			panic: false
		}
	};
}

async function executeCreateTasksTool(app, request, args, timezoneOffsetMinutes) {
	const tasks = Array.isArray(args.tasks) ? args.tasks.slice(0, MAX_CREATE_TASKS_BATCH) : [];
	const requestedDefaults =
		args.defaults && typeof args.defaults === 'object' && !Array.isArray(args.defaults)
			? args.defaults
			: {};
	const defaults = {
		colorKey: 'gold',
		mode: 'one-time',
		trackingType: 'time',
		startState: 'inactive',
		...requestedDefaults
	};
	const allowDuplicates = args.allowDuplicates === true;
	const createdTasks = [];
	const skippedDuplicates = [];
	const failedTasks = [];

	if (tasks.length === 0) {
		return {
			output: {
				ok: false,
				message: 'create_tasks needs at least one task.'
			},
			actions: [],
			refresh: {
				tasks: false,
				stats: false,
				panic: false
			}
		};
	}

	for (const taskArgs of tasks) {
		if (!taskArgs || typeof taskArgs !== 'object' || Array.isArray(taskArgs)) {
			failedTasks.push({
				name: 'Unknown task',
				message: 'Task entry must be an object.'
			});
			continue;
		}

		const name = typeof taskArgs.name === 'string' ? taskArgs.name.trim() : '';

		if (!name) {
			failedTasks.push({
				name: 'Untitled task',
				message: 'Task name is required.'
			});
			continue;
		}

		const createResult = await executeCreateTaskTool(
			app,
			request,
			{
				...defaults,
				...taskArgs,
				name,
				allowDuplicate: allowDuplicates || taskArgs.allowDuplicate === true
			},
			timezoneOffsetMinutes
		);

		if (createResult.output?.requiresChoice === true) {
			skippedDuplicates.push({
				name,
				message: createResult.output.message || 'A close existing task was found.',
				closestTask: createResult.output.closestTask ?? null,
				otherCloseTasks: createResult.output.otherCloseTasks ?? []
			});
			continue;
		}

		if (createResult.output?.ok === true && createResult.output.task) {
			createdTasks.push(createResult.output.task);
			continue;
		}

		failedTasks.push({
			name,
			message: createResult.output?.message || 'Unable to create the task.'
		});
	}

	const createdCount = createdTasks.length;
	const skippedDuplicateCount = skippedDuplicates.length;
	const failedCount = failedTasks.length;
	const summaryParts = [];

	if (createdCount > 0) {
		summaryParts.push(`Created ${createdCount} task${createdCount === 1 ? '' : 's'}`);
	}

	if (skippedDuplicateCount > 0) {
		summaryParts.push(
			`skipped ${skippedDuplicateCount} close duplicate${skippedDuplicateCount === 1 ? '' : 's'}`
		);
	}

	if (failedCount > 0) {
		summaryParts.push(`failed ${failedCount}`);
	}

	return {
		output: {
			ok: failedCount === 0,
			message: summaryParts.length > 0 ? `${summaryParts.join(', ')}.` : 'No tasks were created.',
			createdCount,
			skippedDuplicateCount,
			failedCount,
			createdTasks: createdTasks
				.slice(0, CREATE_TASKS_PREVIEW_LIMIT)
				.map((taskSummary) => buildTaskSummaryOutput(taskSummary)),
			createdPreviewOnly: createdTasks.length > CREATE_TASKS_PREVIEW_LIMIT,
			skippedDuplicates: skippedDuplicates.slice(0, CREATE_TASKS_PREVIEW_LIMIT),
			failedTasks: failedTasks.slice(0, CREATE_TASKS_PREVIEW_LIMIT)
		},
		actions:
			createdCount > 0
				? [
						{
							type: 'create_tasks',
							label: `Created ${createdCount} task${createdCount === 1 ? '' : 's'}.`,
							taskId: null,
							taskName: null
						}
					]
				: [],
		refresh: {
			tasks: createdCount > 0,
			stats: createdCount > 0,
			panic: false
		}
	};
}

async function executeEditTaskTool(app, request, args, timezoneOffsetMinutes) {
	const resolvedTask = await resolveTaskForQuery(app.mongo.db, {
		userId: request.auth.userId,
		taskQuery: args.taskQuery,
		allowedStatuses: ['active', 'daymap', 'inactive', 'archived'],
		includeArchived: true
	});

	if (!resolvedTask.ok) {
		return {
			output: resolvedTask,
			actions: [],
			refresh: {
				tasks: false,
				stats: false,
				panic: false
			}
		};
	}

	const body = buildTaskEditRequestBody(args, {
		timezoneOffsetMinutes
	});

	if (Object.keys(body).length === 0) {
		return {
			output: {
				ok: false,
				message: 'No task edits were provided.'
			},
			actions: [],
			refresh: {
				tasks: false,
				stats: false,
				panic: false
			}
		};
	}

	const editResponse = await injectUserRoute(app, request, {
		method: 'PATCH',
		url: `/tasks/${resolvedTask.task._id.toString()}`,
		body
	});

	if (!editResponse.ok) {
		return {
			output: {
				ok: false,
				message: editResponse.message || 'Unable to edit the task.'
			},
			actions: [],
			refresh: {
				tasks: false,
				stats: false,
				panic: false
			}
		};
	}

	const taskSummary = await buildTaskSummaryFromId(app.mongo.db, {
		userId: request.auth.userId,
		taskId: resolvedTask.task._id.toString()
	});
	const changes = editResponse.body?.changes ?? [];

	return {
		output: {
			ok: true,
			task: taskSummary,
			changes
		},
		actions: buildTaskChangeActions(changes, taskSummary),
		refresh: {
			tasks: true,
			stats: true,
			panic: false
		}
	};
}

async function executeEditTasksTool(app, request, args, timezoneOffsetMinutes) {
	const edits = Array.isArray(args.edits) ? args.edits.slice(0, MAX_EDIT_TASKS_BATCH) : [];
	const changedTasks = [];
	const unchangedTasks = [];
	const failedTasks = [];
	const changesByTask = [];

	if (edits.length === 0) {
		return {
			output: {
				ok: false,
				message: 'edit_tasks needs at least one edit.'
			},
			actions: [],
			refresh: {
				tasks: false,
				stats: false,
				panic: false
			}
		};
	}

	for (const editArgs of edits) {
		const taskQuery = typeof editArgs?.taskQuery === 'string' ? editArgs.taskQuery.trim() : '';

		if (!taskQuery) {
			failedTasks.push({
				taskQuery: 'Unknown task',
				message: 'Each edit needs a taskQuery.'
			});
			continue;
		}

		const editResult = await executeEditTaskTool(
			app,
			request,
			{
				...editArgs,
				taskQuery
			},
			timezoneOffsetMinutes
		);

		if (editResult.output?.ok !== true) {
			failedTasks.push({
				taskQuery,
				message: editResult.output?.message || 'Unable to edit the task.',
				candidates: editResult.output?.candidates ?? []
			});
			continue;
		}

		const taskSummary = editResult.output.task;
		const changes = Array.isArray(editResult.output.changes) ? editResult.output.changes : [];
		changesByTask.push(changes);

		if (changes.length > 0) {
			changedTasks.push({
				task: taskSummary?.name || taskQuery,
				taskId: taskSummary?.id ?? null,
				changes
			});
		} else {
			unchangedTasks.push({
				task: taskSummary?.name || taskQuery,
				taskId: taskSummary?.id ?? null
			});
		}
	}

	const changedCount = changedTasks.length;
	const unchangedCount = unchangedTasks.length;
	const failedCount = failedTasks.length;
	const actions = [];

	if (changedCount > 0) {
		actions.push(
			buildTaskAction(
				'edit_tasks',
				`Changed ${changedCount} ${changedCount === 1 ? 'task' : 'tasks'}.`,
				null
			)
		);
	}

	for (const change of collectBulkChangeSummaries(changesByTask).slice(0, 5)) {
		actions.push(buildTaskAction('change', `Changed: ${change.field} - ${change.value}`, null));
	}

	if (unchangedCount > 0) {
		actions.push(
			buildTaskAction(
				'edit_tasks',
				`${unchangedCount} ${unchangedCount === 1 ? 'task was' : 'tasks were'} already in that state.`,
				null
			)
		);
	}

	if (failedCount > 0) {
		actions.push(
			buildTaskAction(
				'edit_tasks',
				`${failedCount} ${failedCount === 1 ? 'task failed' : 'tasks failed'}.`,
				null
			)
		);
	}

	return {
		output: {
			ok: failedCount === 0,
			changedCount,
			unchangedCount,
			failedCount,
			changedTasks: changedTasks.slice(0, EDIT_TASKS_PREVIEW_LIMIT),
			changedPreviewOnly: changedTasks.length > EDIT_TASKS_PREVIEW_LIMIT,
			unchangedTasks: unchangedTasks.slice(0, EDIT_TASKS_PREVIEW_LIMIT),
			unchangedPreviewOnly: unchangedTasks.length > EDIT_TASKS_PREVIEW_LIMIT,
			failedTasks: failedTasks.slice(0, EDIT_TASKS_PREVIEW_LIMIT),
			failedPreviewOnly: failedTasks.length > EDIT_TASKS_PREVIEW_LIMIT
		},
		actions,
		refresh: {
			tasks: changedCount > 0 || failedCount > 0,
			stats: changedCount > 0,
			panic: false
		}
	};
}

async function executeBulkEditTasksTool(app, request, args, timezoneOffsetMinutes) {
	const filter = !Array.isArray(args.filter) && typeof args.filter === 'object' && args.filter
		? args.filter
		: null;
	const changes = !Array.isArray(args.changes) && typeof args.changes === 'object' && args.changes
		? args.changes
		: null;

	if (!filter || !changes) {
		return {
			output: {
				ok: false,
				message: 'bulk_edit_tasks needs both a filter object and a changes object.'
			},
			actions: [],
			refresh: {
				tasks: false,
				stats: false,
				panic: false
			}
		};
	}

	const body = buildTaskEditRequestBody(changes, {
		allowName: false,
		allowStartedAt: false,
		allowActiveTallyCount: false,
		timezoneOffsetMinutes
	});

	if (Object.keys(body).length === 0) {
		return {
			output: {
				ok: false,
				message: 'bulk_edit_tasks needs at least one supported shared change.'
			},
			actions: [],
			refresh: {
				tasks: false,
				stats: false,
				panic: false
			}
		};
	}

	const includeArchived =
		filter.includeArchived === true ||
		(Array.isArray(filter.statuses) && filter.statuses.includes('archived'));
	const selection = selectTasksForAssistantFilter(
		await loadUserTasks(app.mongo.db, {
			userId: request.auth.userId,
			includeArchived
		}),
		filter
	);
	const matchedTasks = selection.tasks;

	if (matchedTasks.length === 0) {
		return {
			output: {
				ok: true,
				statuses: selection.statuses,
				matchedCount: 0,
				changedCount: 0,
				unchangedCount: 0,
				failedCount: 0,
				message: 'No tasks matched that filter.'
			},
			actions: [buildTaskAction('bulk_edit_tasks', 'No tasks matched that filter.', null)],
			refresh: {
				tasks: false,
				stats: false,
				panic: false
			}
		};
	}

	if (matchedTasks.length > MAX_BULK_EDIT_MATCHES) {
		return {
			output: {
				ok: false,
				statuses: selection.statuses,
				matchedCount: matchedTasks.length,
				message: `That filter matched ${matchedTasks.length} tasks. Narrow it down before bulk editing more than ${MAX_BULK_EDIT_MATCHES} tasks at once.`
			},
			actions: [],
			refresh: {
				tasks: false,
				stats: false,
				panic: false
			}
		};
	}

	const changedTaskNames = [];
	const failedTasks = [];
	const changesByTask = [];
	let changedCount = 0;
	let unchangedCount = 0;

	for (const task of matchedTasks) {
		const editResponse = await injectUserRoute(app, request, {
			method: 'PATCH',
			url: `/tasks/${task._id.toString()}`,
			body
		});

		if (!editResponse.ok) {
			failedTasks.push({
				task: task.name,
				message: editResponse.message || 'Unable to edit task.'
			});
			continue;
		}

		const taskChanges = Array.isArray(editResponse.body?.changes) ? editResponse.body.changes : [];
		changesByTask.push(taskChanges);

		if (taskChanges.length > 0) {
			changedCount += 1;

			if (changedTaskNames.length < 8) {
				changedTaskNames.push(task.name);
			}
		} else {
			unchangedCount += 1;
		}
	}

	const changeSummaries = collectBulkChangeSummaries(changesByTask);
	const actions = [];

	if (changedCount > 0) {
		actions.push(
			buildTaskAction(
				'bulk_edit_tasks',
				`Changed ${changedCount} ${changedCount === 1 ? 'task' : 'tasks'}.`,
				null
			)
		);
	}

	for (const change of changeSummaries.slice(0, 5)) {
		actions.push(buildTaskAction('change', `Changed: ${change.field} - ${change.value}`, null));
	}

	if (unchangedCount > 0) {
		actions.push(
			buildTaskAction(
				'bulk_edit_tasks',
				`${unchangedCount} ${unchangedCount === 1 ? 'task was' : 'tasks were'} already in that state.`,
				null
			)
		);
	}

	if (failedTasks.length > 0) {
		actions.push(
			buildTaskAction(
				'bulk_edit_tasks',
				`${failedTasks.length} ${failedTasks.length === 1 ? 'task failed' : 'tasks failed'}.`,
				null
			)
		);
	}

	return {
		output: {
			ok: true,
			statuses: selection.statuses,
			matchedCount: matchedTasks.length,
			changedCount,
			unchangedCount,
			failedCount: failedTasks.length,
			changedTasks: changedTaskNames,
			changeSummaries,
			failedTasks: failedTasks.slice(0, 8)
		},
		actions,
		refresh: {
			tasks: changedCount > 0 || failedTasks.length > 0,
			stats: changedCount > 0,
			panic: false
		}
	};
}

async function executeCompleteTaskRunTool(app, request, args, timezoneOffsetMinutes) {
	const allowsHistoricalCompletion =
		typeof args.startedAt === 'string' && typeof args.completedAt === 'string';
	const resolvedTask = await resolveTaskForQuery(app.mongo.db, {
		userId: request.auth.userId,
		taskQuery: args.taskQuery,
		allowedStatuses: allowsHistoricalCompletion ? ['active', 'daymap', 'inactive'] : ['active']
	});

	if (!resolvedTask.ok) {
		return {
			output: resolvedTask,
			actions: [],
			refresh: {
				tasks: false,
				stats: false,
				panic: false
			}
		};
	}

	const body = {};

	if (typeof args.startedAt === 'string') {
		body.startedAt = normalizeAssistantDateTimeArgument(args.startedAt, timezoneOffsetMinutes);
	}

	if (typeof args.completedAt === 'string') {
		body.completedAt = normalizeAssistantDateTimeArgument(args.completedAt, timezoneOffsetMinutes);
	}

	if (Object.hasOwn(args, 'instanceNote')) {
		body.instanceNote =
			typeof args.instanceNote === 'string' && args.instanceNote.length > 0
				? args.instanceNote
				: null;
	}

	const doneResponse = await injectUserRoute(app, request, {
		method: 'POST',
		url: `/tasks/${resolvedTask.task._id.toString()}/done`,
		body: Object.keys(body).length > 0 ? body : undefined
	});

	if (!doneResponse.ok) {
		return {
			output: {
				ok: false,
				message: doneResponse.message || 'Unable to complete the task run.'
			},
			actions: [],
			refresh: {
				tasks: false,
				stats: false,
				panic: false
			}
		};
	}

	const taskSummary = await buildTaskSummaryFromId(app.mongo.db, {
		userId: request.auth.userId,
		taskId: resolvedTask.task._id.toString()
	});
	const changes = doneResponse.body?.changes ?? [];

	return {
		output: {
			ok: true,
			task: taskSummary,
			changes
		},
		actions: [
			...buildTaskChangeActions(changes, taskSummary),
			buildTaskAction(
				'complete_task_run',
				`Marked ${taskSummary?.name || resolvedTask.task.name} done.`,
				taskSummary
			)
		],
		refresh: {
			tasks: true,
			stats: true,
			panic: false
		}
	};
}

async function executeRenameTaskTool(app, request, args) {
	const resolvedTask = await resolveTaskForQuery(app.mongo.db, {
		userId: request.auth.userId,
		taskQuery: args.taskQuery,
		allowedStatuses: ['active', 'daymap', 'inactive']
	});

	if (!resolvedTask.ok) {
		return {
			output: resolvedTask,
			actions: [],
			refresh: {
				tasks: false,
				stats: false,
				panic: false
			}
		};
	}

	const nextName = typeof args.name === 'string' ? args.name.trim() : '';

	if (!nextName) {
		return {
			output: {
				ok: false,
				message: 'Task name cannot be empty.'
			},
			actions: [],
			refresh: {
				tasks: false,
				stats: false,
				panic: false
			}
		};
	}

	if (nextName.length > 120) {
		return {
			output: {
				ok: false,
				message: 'Task name is too long.'
			},
			actions: [],
			refresh: {
				tasks: false,
				stats: false,
				panic: false
			}
		};
	}

	const updatedAt = new Date();
	const updatedTask = await app.mongo.db.collection('tasks').findOneAndUpdate(
		{
			_id: resolvedTask.task._id,
			userId: toObjectId(request.auth.userId),
			archived: {
				$ne: true
			}
		},
		{
			$set: {
				name: nextName,
				updatedAt
			}
		},
		{
			returnDocument: 'after'
		}
	);

	if (!updatedTask) {
		return {
			output: {
				ok: false,
				message: 'Task could not be renamed.'
			},
			actions: [],
			refresh: {
				tasks: false,
				stats: false,
				panic: false
			}
		};
	}

	const taskSummary = await buildTaskSummaryFromId(app.mongo.db, {
		userId: request.auth.userId,
		taskId: updatedTask._id.toString()
	});

	return {
		output: {
			ok: true,
			task: taskSummary
		},
		actions: [buildTaskChangeAction('task name', `"${taskSummary?.name || nextName}"`, taskSummary)],
		refresh: {
			tasks: true,
			stats: true,
			panic: false
		}
	};
}

async function executeSetTaskNoteTool(app, request, args) {
	const resolvedTask = await resolveTaskForQuery(app.mongo.db, {
		userId: request.auth.userId,
		taskQuery: args.taskQuery,
		allowedStatuses: ['active', 'daymap', 'inactive']
	});

	if (!resolvedTask.ok) {
		return {
			output: resolvedTask,
			actions: [],
			refresh: {
				tasks: false,
				stats: false,
				panic: false
			}
		};
	}

	const noteResponse = await injectUserRoute(app, request, {
		method: 'PATCH',
		url: `/tasks/${resolvedTask.task._id.toString()}/note`,
		body: {
			note: typeof args.note === 'string' && args.note.length > 0 ? args.note : null
		}
	});

	if (!noteResponse.ok) {
		return {
			output: {
				ok: false,
				message: noteResponse.message || 'Unable to update the task note.'
			},
			actions: [],
			refresh: {
				tasks: false,
				stats: false,
				panic: false
			}
		};
	}

	const taskSummary = await buildTaskSummaryFromId(app.mongo.db, {
		userId: request.auth.userId,
		taskId: resolvedTask.task._id.toString()
	});

	return {
		output: {
			ok: true,
			task: taskSummary
		},
		actions: [buildTaskChangeAction('task note', taskSummary?.note ? `"${taskSummary.note}"` : 'cleared', taskSummary)],
		refresh: {
			tasks: true,
			stats: true,
			panic: false
		}
	};
}

async function executeSetTaskInstanceNoteTool(app, request, args) {
	const resolvedTask = await resolveTaskForQuery(app.mongo.db, {
		userId: request.auth.userId,
		taskQuery: args.taskQuery,
		allowedStatuses: ['active']
	});

	if (!resolvedTask.ok) {
		return {
			output: resolvedTask,
			actions: [],
			refresh: {
				tasks: false,
				stats: false,
				panic: false
			}
		};
	}

	const noteResponse = await injectUserRoute(app, request, {
		method: 'PATCH',
		url: `/tasks/${resolvedTask.task._id.toString()}/instance-note`,
		body: {
			instanceNote:
				typeof args.instanceNote === 'string' && args.instanceNote.length > 0
					? args.instanceNote
					: null
		}
	});

	if (!noteResponse.ok) {
		return {
			output: {
				ok: false,
				message: noteResponse.message || 'Unable to update the active run note.'
			},
			actions: [],
			refresh: {
				tasks: false,
				stats: false,
				panic: false
			}
		};
	}

	const taskSummary = await buildTaskSummaryFromId(app.mongo.db, {
		userId: request.auth.userId,
		taskId: resolvedTask.task._id.toString()
	});

	return {
		output: {
			ok: true,
			task: taskSummary
		},
		actions: [
			buildTaskChangeAction(
				'instance note',
				taskSummary?.instanceNote ? `"${taskSummary.instanceNote}"` : 'cleared',
				taskSummary
			)
		],
		refresh: {
			tasks: true,
			stats: true,
			panic: false
		}
	};
}

async function executeMoveTaskTool(app, request, args) {
	const destination = args.destination;

	if (!TASK_MOVE_DESTINATION_VALUES.includes(destination)) {
		return {
			output: {
				ok: false,
				message: 'Task destination is not supported.'
			},
			actions: [],
			refresh: {
				tasks: false,
				stats: false,
				panic: false
			}
		};
	}

	const resolvedTask = await resolveTaskForQuery(app.mongo.db, {
		userId: request.auth.userId,
		taskQuery: args.taskQuery,
		allowedStatuses: ['active', 'daymap', 'inactive']
	});

	if (!resolvedTask.ok) {
		return {
			output: resolvedTask,
			actions: [],
			refresh: {
				tasks: false,
				stats: false,
				panic: false
			}
		};
	}

	const taskId = resolvedTask.task._id.toString();
	const currentState = buildTaskState(resolvedTask.task);

	if (destination === currentState) {
		const taskSummary = await buildTaskSummaryFromId(app.mongo.db, {
			userId: request.auth.userId,
			taskId
		});

		return {
			output: {
				ok: true,
				task: taskSummary,
				message: `${taskSummary?.name || 'Task'} is already ${destination}.`
			},
			actions: [],
			refresh: {
				tasks: false,
				stats: false,
				panic: false
			}
		};
	}

	const stepResults = [];

	const runStep = async ({ method = 'POST', url, body }) => {
		const response = await injectUserRoute(app, request, {
			method,
			url,
			body
		});

		stepResults.push(response);
		return response;
	};

	if (destination === 'active') {
		const activateResponse = await runStep({
			url: `/tasks/${taskId}/activate`
		});

		if (!activateResponse.ok) {
			return {
				output: {
					ok: false,
					message: activateResponse.message || 'Unable to activate the task.'
				},
				actions: [],
				refresh: {
					tasks: false,
					stats: false,
					panic: false
				}
			};
		}
	}

	if (destination === 'daymap') {
		if (currentState === 'inactive') {
			const daymapResponse = await runStep({
				url: `/tasks/${taskId}/daymap`
			});

			if (!daymapResponse.ok) {
				return {
					output: {
						ok: false,
						message: daymapResponse.message || 'Unable to move the task to the daymap.'
					},
					actions: [],
					refresh: {
						tasks: false,
						stats: false,
						panic: false
					}
				};
			}
		}

		if (currentState === 'active') {
			const inactivateResponse = await runStep({
				url: `/tasks/${taskId}/inactivate`
			});

			if (!inactivateResponse.ok) {
				return {
					output: {
						ok: false,
						message: inactivateResponse.message || 'Unable to pause the task back to the daymap.'
					},
					actions: [],
					refresh: {
						tasks: false,
						stats: false,
						panic: false
					}
				};
			}
		}
	}

	if (destination === 'inactive') {
		if (currentState === 'active') {
			const inactivateResponse = await runStep({
				url: `/tasks/${taskId}/inactivate`
			});

			if (!inactivateResponse.ok) {
				return {
					output: {
						ok: false,
						message: inactivateResponse.message || 'Unable to take the task off active.'
					},
					actions: [],
					refresh: {
						tasks: false,
						stats: false,
						panic: false
					}
				};
			}
		}

		const unmapResponse = await runStep({
			url: `/tasks/${taskId}/unmap`
		});

		if (!unmapResponse.ok) {
			return {
				output: {
					ok: false,
					message: unmapResponse.message || 'Unable to move the task back to inactive.'
				},
				actions: [],
				refresh: {
					tasks: false,
					stats: false,
					panic: false
				}
			};
		}
	}

	if (destination === 'done') {
		const doneResponse = await runStep({
			url: `/tasks/${taskId}/done`,
			body:
				typeof args.instanceNote === 'string'
					? {
							instanceNote: args.instanceNote
						}
					: undefined
		});

		if (!doneResponse.ok) {
			return {
				output: {
					ok: false,
					message: doneResponse.message || 'Unable to mark the task done.'
				},
				actions: [],
				refresh: {
					tasks: false,
					stats: false,
					panic: false
				}
			};
		}
	}

	if (destination === 'archived') {
		if (currentState === 'active') {
			const inactivateResponse = await runStep({
				url: `/tasks/${taskId}/inactivate`
			});

			if (!inactivateResponse.ok) {
				return {
					output: {
						ok: false,
						message: inactivateResponse.message || 'Unable to remove the task from active before archiving.'
					},
					actions: [],
					refresh: {
						tasks: false,
						stats: false,
						panic: false
					}
				};
			}
		}

		if (currentState === 'active' || currentState === 'daymap') {
			const unmapResponse = await runStep({
				url: `/tasks/${taskId}/unmap`
			});

			if (!unmapResponse.ok) {
				return {
					output: {
						ok: false,
						message: unmapResponse.message || 'Unable to remove the task from the daymap before archiving.'
					},
					actions: [],
					refresh: {
						tasks: false,
						stats: false,
						panic: false
					}
				};
			}
		}

		const archiveResponse = await runStep({
			url: `/tasks/${taskId}/archive`
		});

		if (!archiveResponse.ok) {
			return {
				output: {
					ok: false,
					message: archiveResponse.message || 'Unable to archive the task.'
				},
				actions: [],
				refresh: {
					tasks: false,
					stats: false,
					panic: false
				}
			};
		}
	}

	const taskSummary =
		destination === 'done'
			? {
					id: taskId,
					name: resolvedTask.task.name
				}
			: await buildTaskSummaryFromId(app.mongo.db, {
					userId: request.auth.userId,
					taskId
				});
	const actionLabels = {
		active: `Activated ${taskSummary?.name || resolvedTask.task.name}.`,
		daymap: `Moved ${taskSummary?.name || resolvedTask.task.name} to the daymap.`,
		inactive: `Moved ${taskSummary?.name || resolvedTask.task.name} back to inactive.`,
		done: `Marked ${taskSummary?.name || resolvedTask.task.name} done.`,
		archived: `Archived ${taskSummary?.name || resolvedTask.task.name}.`
	};

	return {
		output: {
			ok: true,
			task: taskSummary,
			destination
		},
		actions: [buildTaskAction('move_task', actionLabels[destination], taskSummary)],
		refresh: {
			tasks: true,
			stats: true,
			panic: false
		}
	};
}

async function executeSetQueueStateTool(app, request, args) {
	const resolvedTask = await resolveTaskForQuery(app.mongo.db, {
		userId: request.auth.userId,
		taskQuery: args.taskQuery,
		allowedStatuses: ['daymap']
	});

	if (!resolvedTask.ok) {
		return {
			output: resolvedTask,
			actions: [],
			refresh: {
				tasks: false,
				stats: false,
				panic: false
			}
		};
	}

	const isQueued =
		Number.isInteger(resolvedTask.task.queuePosition) && resolvedTask.task.queuePosition > 0;

	if (isQueued === args.queued) {
		const taskSummary = await buildTaskSummaryFromId(app.mongo.db, {
			userId: request.auth.userId,
			taskId: resolvedTask.task._id.toString()
		});

		return {
			output: {
				ok: true,
				task: taskSummary,
				message: `${taskSummary?.name || 'Task'} is already ${args.queued ? 'queued' : 'not queued'}.`
			},
			actions: [],
			refresh: {
				tasks: false,
				stats: false,
				panic: false
			}
		};
	}

	const route = args.queued ? 'queue' : 'unqueue';
	const queueResponse = await injectUserRoute(app, request, {
		method: 'POST',
		url: `/tasks/${resolvedTask.task._id.toString()}/${route}`
	});

	if (!queueResponse.ok) {
		return {
			output: {
				ok: false,
				message:
					queueResponse.message ||
					`Unable to ${args.queued ? 'queue' : 'unqueue'} the task.`
			},
			actions: [],
			refresh: {
				tasks: false,
				stats: false,
				panic: false
			}
		};
	}

	const taskSummary = await buildTaskSummaryFromId(app.mongo.db, {
		userId: request.auth.userId,
		taskId: resolvedTask.task._id.toString()
	});

	return {
		output: {
			ok: true,
			task: taskSummary
		},
		actions: [
			buildTaskAction(
				'set_task_queue_state',
				`${args.queued ? 'Queued' : 'Removed'} ${taskSummary?.name || 'task'} ${args.queued ? 'for automatic activation' : 'from the queue'}.`,
				taskSummary
			)
		],
		refresh: {
			tasks: true,
			stats: true,
			panic: false
		}
	};
}

async function executeSetDaymapLockTool(app, request, args) {
	const resolvedTask = await resolveTaskForQuery(app.mongo.db, {
		userId: request.auth.userId,
		taskQuery: args.taskQuery,
		allowedStatuses: ['active', 'daymap', 'inactive']
	});

	if (!resolvedTask.ok) {
		return {
			output: resolvedTask,
			actions: [],
			refresh: {
				tasks: false,
				stats: false,
				panic: false
			}
		};
	}

	if (resolvedTask.task.daymapLocked === args.daymapLocked) {
		const taskSummary = await buildTaskSummaryFromId(app.mongo.db, {
			userId: request.auth.userId,
			taskId: resolvedTask.task._id.toString()
		});

		return {
			output: {
				ok: true,
				task: taskSummary,
				message: `${taskSummary?.name || 'Task'} is already ${args.daymapLocked ? 'locked' : 'unlocked'} for the daymap loop.`
			},
			actions: [],
			refresh: {
				tasks: false,
				stats: false,
				panic: false
			}
		};
	}

	const lockResponse = await injectUserRoute(app, request, {
		method: 'PATCH',
		url: `/tasks/${resolvedTask.task._id.toString()}/daymap-lock`,
		body: {
			daymapLocked: args.daymapLocked
		}
	});

	if (!lockResponse.ok) {
		return {
			output: {
				ok: false,
				message: lockResponse.message || 'Unable to update the daymap lock.'
			},
			actions: [],
			refresh: {
				tasks: false,
				stats: false,
				panic: false
			}
		};
	}

	const taskSummary = await buildTaskSummaryFromId(app.mongo.db, {
		userId: request.auth.userId,
		taskId: resolvedTask.task._id.toString()
	});

	return {
		output: {
			ok: true,
			task: taskSummary
		},
		actions: [buildTaskChangeAction('daymap lock', args.daymapLocked ? 'locked' : 'unlocked', taskSummary)],
		refresh: {
			tasks: true,
			stats: true,
			panic: false
		}
	};
}

async function executeUpdateTaskTallyTool(app, request, args) {
	const resolvedTask = await resolveTaskForQuery(app.mongo.db, {
		userId: request.auth.userId,
		taskQuery: args.taskQuery,
		allowedStatuses: ['active']
	});

	if (!resolvedTask.ok) {
		return {
			output: resolvedTask,
			actions: [],
			refresh: {
				tasks: false,
				stats: false,
				panic: false
			}
		};
	}

	const tallyResponse = await injectUserRoute(app, request, {
		method: 'POST',
		url: `/tasks/${resolvedTask.task._id.toString()}/tally`,
		body: {
			delta: args.delta
		}
	});

	if (!tallyResponse.ok) {
		return {
			output: {
				ok: false,
				message: tallyResponse.message || 'Unable to update the tally count.'
			},
			actions: [],
			refresh: {
				tasks: false,
				stats: false,
				panic: false
			}
		};
	}

	const taskSummary = await buildTaskSummaryFromId(app.mongo.db, {
		userId: request.auth.userId,
		taskId: resolvedTask.task._id.toString()
	});

	return {
		output: {
			ok: true,
			task: taskSummary
		},
		actions: [buildTaskChangeAction('active tally', String(taskSummary?.activeTallyCount ?? 0), taskSummary)],
		refresh: {
			tasks: true,
			stats: true,
			panic: false
		}
	};
}

async function executeControlTaskTool(app, request, args) {
	switch (args.action) {
		case 'activate':
			return executeMoveTaskTool(app, request, {
				taskQuery: args.taskQuery,
				destination: 'active'
			});
		case 'move_to_daymap':
			return executeMoveTaskTool(app, request, {
				taskQuery: args.taskQuery,
				destination: 'daymap'
			});
		case 'move_to_inactive':
			return executeMoveTaskTool(app, request, {
				taskQuery: args.taskQuery,
				destination: 'inactive'
			});
		case 'archive':
			return executeMoveTaskTool(app, request, {
				taskQuery: args.taskQuery,
				destination: 'archived'
			});
		case 'queue':
			return executeSetQueueStateTool(app, request, {
				taskQuery: args.taskQuery,
				queued: true
			});
		case 'unqueue':
			return executeSetQueueStateTool(app, request, {
				taskQuery: args.taskQuery,
				queued: false
			});
		default:
			return {
				output: {
					ok: false,
					message: 'Task control action is not supported.'
				},
				actions: [],
				refresh: {
					tasks: false,
					stats: false,
					panic: false
				}
			};
	}
}

async function executeAdjustActiveTallyTool(app, request, args) {
	return executeUpdateTaskTallyTool(app, request, args);
}

async function executeSetPanicModeTool(app, request, args, timezoneOffsetMinutes) {
	if (args.active === true) {
		return executeStartPanicTool(app, request, timezoneOffsetMinutes);
	}

	if (args.active === false) {
		return executeStopPanicTool(app, request, args, timezoneOffsetMinutes);
	}

	return {
		output: {
			ok: false,
			message: 'Panic mode changes require active=true or active=false.'
		},
		actions: [],
		refresh: {
			tasks: false,
			stats: false,
			panic: false
		}
	};
}

async function loadPanicStatus(app, request, timezoneOffsetMinutes) {
	const day = getCurrentLocalDay(timezoneOffsetMinutes);

	return injectUserRoute(app, request, {
		url: `/panic/status?day=${encodeURIComponent(day)}&tzOffsetMinutes=${timezoneOffsetMinutes}`
	});
}

async function executeStartPanicTool(app, request, timezoneOffsetMinutes) {
	const statusResponse = await loadPanicStatus(app, request, timezoneOffsetMinutes);

	if (!statusResponse.ok) {
		return {
			output: {
				ok: false,
				message: statusResponse.message || 'Unable to check panic status.'
			},
			actions: [],
			refresh: {
				tasks: false,
				stats: false,
				panic: false
			}
		};
	}

	if (statusResponse.body?.panic?.active) {
		return {
			output: {
				ok: true,
				panic: statusResponse.body.panic,
				message: 'Panic mode is already active.'
			},
			actions: [],
			refresh: {
				tasks: false,
				stats: false,
				panic: false
			}
		};
	}

	const startResponse = await injectUserRoute(app, request, {
		method: 'POST',
		url: '/panic/start',
		body: {
			day: getCurrentLocalDay(timezoneOffsetMinutes),
			tzOffsetMinutes: timezoneOffsetMinutes
		}
	});

	if (!startResponse.ok) {
		return {
			output: {
				ok: false,
				message: startResponse.message || 'Unable to start panic mode.'
			},
			actions: [],
			refresh: {
				tasks: false,
				stats: false,
				panic: false
			}
		};
	}

	return {
		output: {
			ok: true,
			panic: startResponse.body?.panic ?? null
		},
		actions: [
			{
				type: 'start_panic',
				label: 'Started panic mode.',
				taskId: null,
				taskName: null
			}
		],
		refresh: {
			tasks: true,
			stats: true,
			panic: true
		}
	};
}

async function executeStopPanicTool(app, request, args, timezoneOffsetMinutes) {
	const statusResponse = await loadPanicStatus(app, request, timezoneOffsetMinutes);

	if (!statusResponse.ok) {
		return {
			output: {
				ok: false,
				message: statusResponse.message || 'Unable to check panic status.'
			},
			actions: [],
			refresh: {
				tasks: false,
				stats: false,
				panic: false
			}
		};
	}

	if (!statusResponse.body?.panic?.active) {
		return {
			output: {
				ok: true,
				panic: statusResponse.body?.panic ?? null,
				message: 'Panic mode is already off.'
			},
			actions: [],
			refresh: {
				tasks: false,
				stats: false,
				panic: false
			}
		};
	}

	const stopResponse = await injectUserRoute(app, request, {
		method: 'POST',
		url: '/panic/stop',
		body: {
			day: getCurrentLocalDay(timezoneOffsetMinutes),
			tzOffsetMinutes: timezoneOffsetMinutes,
			note: typeof args.note === 'string' ? args.note : '',
			...(Number.isInteger(args.emotionalCharge)
				? {
						emotionalCharge: args.emotionalCharge
					}
				: {})
		}
	});

	if (!stopResponse.ok) {
		return {
			output: {
				ok: false,
				message: stopResponse.message || 'Unable to stop panic mode.'
			},
			actions: [],
			refresh: {
				tasks: false,
				stats: false,
				panic: false
			}
		};
	}

	return {
		output: {
			ok: true,
			panic: stopResponse.body?.panic ?? null
		},
		actions: [
			{
				type: 'stop_panic',
				label: 'Stopped panic mode.',
				taskId: null,
				taskName: null
			}
		],
		refresh: {
			tasks: true,
			stats: true,
			panic: true
		}
	};
}

const ASSISTANT_TOOLS = [
	{
		type: 'function',
		function: {
			name: 'get_board_snapshot',
			description:
				'Get a backend-owned snapshot of the board with exhaustive counts plus preview lists for active, daymap, inactive, and optionally archived tasks. Use this for broad reads like "what can you see?" or "what is on my board?". Never treat the returned task lists as the full section. Always send {"scope":"board"} as the base object.',
			parameters: {
				type: 'object',
				additionalProperties: false,
				required: ['scope'],
				properties: {
					scope: {
						type: 'string',
						enum: ['board']
					},
					limit: {
						type: 'integer',
						minimum: 1,
						maximum: MAX_BOARD_SECTION_LIMIT
						},
					includeNotes: {
						type: 'boolean'
					},
					includeArchived: {
						type: 'boolean'
					}
				}
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'filter_tasks',
			description:
				'Inspect the full board with backend-owned filters and exhaustive matching counts. Use this when the user asks about every task matching a condition, especially across a whole status like inactive or daymap.',
			parameters: {
				type: 'object',
				additionalProperties: false,
				properties: {
					query: {
						type: 'string',
						maxLength: 120
					},
					statuses: {
						type: 'array',
						maxItems: 4,
						items: {
							type: 'string',
							enum: [...TASK_STATUS_VALUES]
						}
					},
					trackingType: {
						type: 'string',
						enum: [...TASK_TRACKING_TYPE_VALUES]
					},
					mode: {
						type: 'string',
						enum: [...TASK_MODE_VALUES]
					},
					colorKey: {
						type: 'string',
						enum: [...TASK_COLOR_KEYS]
					},
					daymapLocked: {
						type: 'boolean'
					},
					hasNextDue: {
						type: 'boolean'
					},
					nextDueBefore: {
						type: 'string',
						format: 'date-time'
					},
					nextDueAfter: {
						type: 'string',
						format: 'date-time'
					},
					includeNotes: {
						type: 'boolean'
					},
					includeArchived: {
						type: 'boolean'
					},
					limit: {
						type: 'integer',
						minimum: 1,
						maximum: MAX_FILTER_LIMIT
					}
				}
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'search_tasks',
			description:
				'Search the entire board with backend-side ranking so the model does not have to paginate or manually sift large task lists.',
			parameters: {
				type: 'object',
				additionalProperties: false,
				required: ['query'],
				properties: {
					query: {
						type: 'string',
						minLength: 1,
						maxLength: 120
					},
					statuses: {
						type: 'array',
						maxItems: 4,
						items: {
							type: 'string',
							enum: [...TASK_STATUS_VALUES]
						}
					},
					limit: {
						type: 'integer',
						minimum: 1,
						maximum: MAX_SEARCH_LIMIT
					},
					includeNotes: {
						type: 'boolean'
					},
					includeArchived: {
						type: 'boolean'
					}
				}
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'get_day_summary',
			description:
				'Load real day stats, top task breakdown, and recent done or panic items for a specific local day. Always send {"scope":"day"} as the base object.',
			parameters: {
				type: 'object',
				additionalProperties: false,
				required: ['scope'],
				properties: {
					scope: {
						type: 'string',
						enum: ['day']
					},
					day: {
						type: 'string',
						pattern: '^\\d{4}-\\d{2}-\\d{2}$'
					},
					includeLogs: {
						type: 'boolean'
					},
					limit: {
						type: 'integer',
						minimum: 1,
						maximum: 10
					}
				}
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'create_task',
			description:
				'Create a new task on the user account. Choose the colorKey that matches the Task Monster category.',
			parameters: {
				type: 'object',
				additionalProperties: false,
				required: ['name', 'colorKey'],
				properties: {
					name: {
						type: 'string',
						minLength: 1,
						maxLength: 120
					},
					colorKey: {
						type: 'string',
						enum: [...TASK_COLOR_KEYS]
					},
					mode: {
						type: 'string',
						enum: [...TASK_MODE_VALUES]
					},
					trackingType: {
						type: 'string',
						enum: [...TASK_TRACKING_TYPE_VALUES]
					},
					tallyUnit: {
						type: 'string',
						maxLength: 60
					},
					tallyTarget: {
						type: 'integer',
						minimum: 1,
						maximum: 100000
					},
					note: {
						type: 'string',
						maxLength: 2000
					},
					nextDueAt: {
						type: ['string', 'null'],
						format: 'date-time'
					},
					startState: {
						type: 'string',
						enum: [...TASK_START_STATE_VALUES]
					},
					queued: {
						type: 'boolean'
					},
					daymapLocked: {
						type: 'boolean'
					},
					allowDuplicate: {
						type: 'boolean',
						description:
							'Only set this true if the user explicitly chose to create the exact requested task after a duplicate-task warning.'
					}
				}
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'create_tasks',
			description:
				'Create many tasks in one tool call. Use this for pasted checklists, TODO imports, markdown checkbox lists, bullet lists, or any request to turn a list into individual tasks. Prefer defaults so each item only needs a name unless it needs different metadata.',
			parameters: {
				type: 'object',
				additionalProperties: false,
				required: ['tasks'],
				properties: {
					defaults: {
						type: 'object',
						additionalProperties: false,
						properties: {
							colorKey: {
								type: 'string',
								enum: [...TASK_COLOR_KEYS]
							},
							mode: {
								type: 'string',
								enum: [...TASK_MODE_VALUES]
							},
							trackingType: {
								type: 'string',
								enum: [...TASK_TRACKING_TYPE_VALUES]
							},
							startState: {
								type: 'string',
								enum: [...TASK_START_STATE_VALUES]
							},
							queued: {
								type: 'boolean'
							},
							daymapLocked: {
								type: 'boolean'
							},
							note: {
								type: 'string',
								maxLength: 2000
							}
						}
					},
					tasks: {
						type: 'array',
						minItems: 1,
						maxItems: MAX_CREATE_TASKS_BATCH,
						items: {
							type: 'object',
							additionalProperties: false,
							required: ['name'],
							properties: {
								name: {
									type: 'string',
									minLength: 1,
									maxLength: 120
								},
								colorKey: {
									type: 'string',
									enum: [...TASK_COLOR_KEYS]
								},
								mode: {
									type: 'string',
									enum: [...TASK_MODE_VALUES]
								},
								trackingType: {
									type: 'string',
									enum: [...TASK_TRACKING_TYPE_VALUES]
								},
								tallyUnit: {
									type: 'string',
									maxLength: 60
								},
								tallyTarget: {
									type: 'integer',
									minimum: 1,
									maximum: 100000
								},
								note: {
									type: 'string',
									maxLength: 2000
								},
								nextDueAt: {
									type: ['string', 'null'],
									format: 'date-time'
								},
								startState: {
									type: 'string',
									enum: [...TASK_START_STATE_VALUES]
								},
								queued: {
									type: 'boolean'
								},
								daymapLocked: {
									type: 'boolean'
								},
								allowDuplicate: {
									type: 'boolean',
									description:
										'Only set this true for a single item if the user explicitly chose to create it despite a duplicate warning.'
								}
							}
						}
					},
					allowDuplicates: {
						type: 'boolean',
						description:
							'Only set this true if the user explicitly says to create duplicate-looking tasks anyway for the whole batch.'
					}
				}
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'edit_task',
			description:
				'Edit task metadata or active runtime details. Use this for name, category, mode, tracking type, next due, tally settings, daymap lock, task note, or active started time changes.',
			parameters: {
				type: 'object',
				required: ['taskQuery'],
				additionalProperties: false,
				properties: {
					taskQuery: {
						type: 'string',
						minLength: 1,
						maxLength: 120
					},
					name: {
						type: 'string',
						minLength: 1,
						maxLength: 120
					},
					colorKey: {
						type: 'string',
						enum: [...TASK_COLOR_KEYS]
					},
					mode: {
						type: 'string',
						enum: [...TASK_MODE_VALUES]
					},
					trackingType: {
						type: 'string',
						enum: [...TASK_TRACKING_TYPE_VALUES]
					},
					note: {
						type: ['string', 'null'],
						maxLength: 2000
					},
					nextDueAt: {
						type: ['string', 'null'],
						format: 'date-time'
					},
					tallyUnit: {
						type: ['string', 'null'],
						maxLength: 60
					},
					tallyTarget: {
						type: ['integer', 'null'],
						minimum: 1,
						maximum: 100000
					},
					activeTallyCount: {
						type: 'integer',
						minimum: 0,
						maximum: 1000000
					},
					daymapLocked: {
						type: 'boolean'
					},
					startedAt: {
						type: 'string',
						format: 'date-time'
					}
				}
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'edit_tasks',
			description:
				'Apply targeted edits to many named tasks in one tool call. Use this when each task may need a different color, mode, name, note, due date, daymap lock, or other metadata. This is the right tool for "Task A -> blue, Task B -> red" mappings and meaning-based classification passes.',
			parameters: {
				type: 'object',
				required: ['edits'],
				additionalProperties: false,
				properties: {
					edits: {
						type: 'array',
						minItems: 1,
						maxItems: MAX_EDIT_TASKS_BATCH,
						items: {
							type: 'object',
							required: ['taskQuery'],
							additionalProperties: false,
							properties: {
								taskQuery: {
									type: 'string',
									minLength: 1,
									maxLength: 120
								},
								name: {
									type: 'string',
									minLength: 1,
									maxLength: 120
								},
								colorKey: {
									type: 'string',
									enum: [...TASK_COLOR_KEYS]
								},
								mode: {
									type: 'string',
									enum: [...TASK_MODE_VALUES]
								},
								trackingType: {
									type: 'string',
									enum: [...TASK_TRACKING_TYPE_VALUES]
								},
								note: {
									type: ['string', 'null'],
									maxLength: 2000
								},
								nextDueAt: {
									type: ['string', 'null'],
									format: 'date-time'
								},
								tallyUnit: {
									type: ['string', 'null'],
									maxLength: 60
								},
								tallyTarget: {
									type: ['integer', 'null'],
									minimum: 1,
									maximum: 100000
								},
								activeTallyCount: {
									type: 'integer',
									minimum: 0,
									maximum: 1000000
								},
								daymapLocked: {
									type: 'boolean'
								},
								startedAt: {
									type: 'string',
									format: 'date-time'
								}
							}
						}
					}
				}
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'bulk_edit_tasks',
			description:
				'Apply one shared metadata change set to every task matching a backend-owned filter. Use this for status-wide cleanup requests.',
			parameters: {
				type: 'object',
				required: ['filter', 'changes'],
				additionalProperties: false,
				properties: {
					filter: {
						type: 'object',
						additionalProperties: false,
						properties: {
							query: {
								type: 'string',
								maxLength: 120
							},
							statuses: {
								type: 'array',
								maxItems: 4,
								items: {
									type: 'string',
									enum: [...TASK_STATUS_VALUES]
								}
							},
							trackingType: {
								type: 'string',
								enum: [...TASK_TRACKING_TYPE_VALUES]
							},
							mode: {
								type: 'string',
								enum: [...TASK_MODE_VALUES]
							},
							colorKey: {
								type: 'string',
								enum: [...TASK_COLOR_KEYS]
							},
							daymapLocked: {
								type: 'boolean'
							},
							hasNextDue: {
								type: 'boolean'
							},
							nextDueBefore: {
								type: 'string',
								format: 'date-time'
							},
							nextDueAfter: {
								type: 'string',
								format: 'date-time'
							},
							includeArchived: {
								type: 'boolean'
							}
						}
					},
					changes: {
						type: 'object',
						additionalProperties: false,
						properties: {
							colorKey: {
								type: 'string',
								enum: [...TASK_COLOR_KEYS]
							},
							mode: {
								type: 'string',
								enum: [...TASK_MODE_VALUES]
							},
							trackingType: {
								type: 'string',
								enum: [...TASK_TRACKING_TYPE_VALUES]
							},
							note: {
								type: ['string', 'null'],
								maxLength: 2000
							},
							nextDueAt: {
								type: ['string', 'null'],
								format: 'date-time'
							},
							tallyUnit: {
								type: ['string', 'null'],
								maxLength: 60
							},
							tallyTarget: {
								type: ['integer', 'null'],
								minimum: 1,
								maximum: 100000
							},
							daymapLocked: {
								type: 'boolean'
							}
						}
					}
				}
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'complete_task_run',
			description:
				'Mark a task run done. Use this for active tasks, or for historical completion of daymap/inactive tasks when you have both startedAt and completedAt. You can also attach an optional instance note.',
			parameters: {
				type: 'object',
				required: ['taskQuery'],
				additionalProperties: false,
				properties: {
					taskQuery: {
						type: 'string',
						minLength: 1,
						maxLength: 120
					},
					startedAt: {
						type: 'string',
						format: 'date-time'
					},
					completedAt: {
						type: 'string',
						format: 'date-time'
					},
					instanceNote: {
						type: ['string', 'null'],
						maxLength: 4000
					}
				}
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'control_task',
			description:
				'Control task state transitions other than done. Use this for activate, move to daymap, move to inactive, queue, unqueue, or archive actions.',
			parameters: {
				type: 'object',
				required: ['taskQuery', 'action'],
				additionalProperties: false,
				properties: {
					taskQuery: {
						type: 'string',
						minLength: 1,
						maxLength: 120
					},
					action: {
						type: 'string',
						enum: [
							'activate',
							'move_to_daymap',
							'move_to_inactive',
							'archive',
							'queue',
							'unqueue'
						]
					}
				}
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'adjust_active_tally',
			description:
				'Increment or decrement the tally count of an active tally task.',
			parameters: {
				type: 'object',
				required: ['taskQuery', 'delta'],
				additionalProperties: false,
				properties: {
					taskQuery: {
						type: 'string',
						minLength: 1,
						maxLength: 120
					},
					delta: {
						type: 'integer',
						minimum: -1000,
						maximum: 1000
					}
				}
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'set_panic_mode',
			description:
				'Start or stop panic mode. When stopping panic, you can optionally include a note and emotional pull score.',
			parameters: {
				type: 'object',
				required: ['active'],
				additionalProperties: false,
				properties: {
					active: {
						type: 'boolean'
					},
					note: {
						type: ['string', 'null'],
						maxLength: 4000
					},
					emotionalCharge: {
						type: 'integer',
						minimum: 1,
						maximum: 10
					}
				}
			}
		}
	}
];

async function executeAssistantTool(app, request, toolCall, timezoneOffsetMinutes) {
	const rawArguments = toolCall.function?.arguments;
	const parsedArguments =
		typeof rawArguments === 'string' && rawArguments.trim().length > 0
			? parseJsonSafely(rawArguments)
			: {};

	if (!parsedArguments) {
		return {
			output: {
				ok: false,
				message: `Tool arguments for ${toolCall.function?.name || 'unknown'} were not valid JSON.`
			},
			actions: [],
			refresh: {
				tasks: false,
				stats: false,
				panic: false
			}
		};
	}

	if (Array.isArray(parsedArguments) || typeof parsedArguments !== 'object') {
		return {
			output: {
				ok: false,
				message: `Tool arguments for ${toolCall.function?.name || 'unknown'} must be a JSON object.`
			},
			actions: [],
			refresh: {
				tasks: false,
				stats: false,
				panic: false
			}
		};
	}

	switch (toolCall.function.name) {
		case 'get_board_snapshot':
			return executeGetBoardSnapshotTool(app, request, parsedArguments);
		case 'filter_tasks':
			return executeFilterTasksTool(app, request, parsedArguments);
		case 'search_tasks':
			return executeSearchTasksTool(app, request, parsedArguments);
		case 'get_day_summary':
			return executeDaySummaryTool(app, request, parsedArguments, timezoneOffsetMinutes);
		case 'create_task':
			return executeCreateTaskTool(app, request, parsedArguments, timezoneOffsetMinutes);
		case 'create_tasks':
			return executeCreateTasksTool(app, request, parsedArguments, timezoneOffsetMinutes);
		case 'edit_task':
			return executeEditTaskTool(app, request, parsedArguments, timezoneOffsetMinutes);
		case 'edit_tasks':
			return executeEditTasksTool(app, request, parsedArguments, timezoneOffsetMinutes);
		case 'bulk_edit_tasks':
			return executeBulkEditTasksTool(app, request, parsedArguments, timezoneOffsetMinutes);
		case 'complete_task_run':
			return executeCompleteTaskRunTool(app, request, parsedArguments, timezoneOffsetMinutes);
		case 'control_task':
			return executeControlTaskTool(app, request, parsedArguments);
		case 'adjust_active_tally':
			return executeAdjustActiveTallyTool(app, request, parsedArguments);
		case 'set_panic_mode':
			return executeSetPanicModeTool(app, request, parsedArguments, timezoneOffsetMinutes);
		default:
			return {
				output: {
					ok: false,
					message: `Unknown tool: ${toolCall.function?.name || 'unknown'}.`
				},
				actions: [],
				refresh: {
					tasks: false,
					stats: false,
					panic: false
				}
			};
	}
}

function sanitizeConversation(messages) {
	return messages
		.filter((message) => message && (message.role === 'user' || message.role === 'assistant'))
		.map((message) => ({
			role: message.role,
			content: String(message.content || '').trim()
		}))
		.filter((message) => message.content.length > 0)
		.slice(-MAX_CONVERSATION_MESSAGES);
}

async function runAssistantChat(app, request, body) {
	if (!app.config.openaiApiKey) {
		throw new Error('OPENAI_API_KEY is not configured on the backend.');
	}

	const conversation = sanitizeConversation(body.messages);

	if (conversation.length === 0 || conversation.at(-1)?.role !== 'user') {
		throw new Error('Assistant requests must end with a user message.');
	}

	let timezoneOffsetMinutes;

	try {
		timezoneOffsetMinutes = parseTimezoneOffsetMinutes(body.timezoneOffsetMinutes ?? 0);
	} catch (error) {
		throw new Error(error.message);
	}

	const systemMessage = {
		role: 'system',
		content: buildAssistantSystemPrompt({
			username: request.auth.username,
			localDay: getCurrentLocalDay(timezoneOffsetMinutes),
			currentPath: typeof body.currentPath === 'string' ? body.currentPath : '',
			timezoneOffsetMinutes
		})
	};
	const openAiMessages = [
		systemMessage,
		...conversation.map((message) => ({
			role: message.role,
			content: message.content
		}))
	];
	const actions = [];
	const refresh = {
		tasks: false,
		stats: false,
		panic: false
	};

	for (let iteration = 0; iteration < TOOL_LOOP_LIMIT; iteration += 1) {
		const completion = await callOpenAiChatCompletion({
			apiKey: app.config.openaiApiKey,
			model: app.config.openaiModel,
			messages: openAiMessages,
			tools: ASSISTANT_TOOLS,
			userTag: `taskmonster:${request.auth.userId}`
		});
		const choice = completion?.choices?.[0];
		const assistantMessage = choice?.message;

		if (!assistantMessage) {
			throw new Error('The assistant returned an empty response.');
		}

		const toolCalls = Array.isArray(assistantMessage.tool_calls)
			? assistantMessage.tool_calls
			: [];

		if (toolCalls.length === 0) {
			return {
				reply:
					extractMessageText(assistantMessage.content) ||
					'I ran into an empty assistant response.',
				actions,
				refresh
			};
		}

		openAiMessages.push({
			role: 'assistant',
			content: extractMessageText(assistantMessage.content) || '',
			tool_calls: assistantMessage.tool_calls
		});

		for (const toolCall of toolCalls) {
			const toolResult = await executeAssistantTool(
				app,
				request,
				toolCall,
				timezoneOffsetMinutes
			);

			actions.push(...toolResult.actions);
			mergeRefreshFlags(refresh, toolResult.refresh);
			openAiMessages.push({
				role: 'tool',
				tool_call_id: toolCall.id,
				content: JSON.stringify(toolResult.output)
			});

			if (toolResult.output?.requiresChoice === true) {
				const followupCompletion = await callOpenAiChatCompletion({
					apiKey: app.config.openaiApiKey,
					model: app.config.openaiModel,
					messages: [
						...openAiMessages,
						{
							role: 'system',
							content: buildChoiceResolutionPrompt()
						}
					],
					tools: [],
					userTag: `taskmonster:${request.auth.userId}`
				});
				const followupAssistantMessage = followupCompletion?.choices?.[0]?.message;

				return {
					reply:
						extractMessageText(followupAssistantMessage?.content) ||
						'I found a close existing task, so I need you to choose 1, 2, or 3 before I create anything.',
					actions,
					refresh
				};
			}
		}
	}

	throw new Error('The assistant hit its tool-use limit before finishing the reply.');
}

module.exports = {
	assistantChatSchema,
	runAssistantChat
};
