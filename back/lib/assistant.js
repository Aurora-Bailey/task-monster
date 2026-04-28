const { ObjectId } = require('mongodb');

const {
	getCurrentLocalDay,
	isValidDayString,
	parseTimezoneOffsetMinutes
} = require('./local-days');
const {
	TASK_COLOR_MAP,
	TASK_DURATION_VALUES,
	TASK_MODE_VALUES,
	TASK_SNOOZE_VALUES,
	TASK_TRACKING_TYPE_VALUES,
	toObjectId
} = require('./tasks');

const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';
const TOOL_LOOP_LIMIT = 8;
const DEFAULT_LIST_LIMIT = 12;
const MAX_LIST_LIMIT = 20;
const DEFAULT_DAY_SUMMARY_LIMIT = 5;

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
				maxItems: 16,
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
		alarmEnabled: task.alarmEnabled === true,
		durationMinutes: task.durationMinutes ?? null,
		snoozeMinutes: task.snoozeMinutes ?? null,
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
		lastCompletedAt: task.lastCompletedAt ? task.lastCompletedAt.toISOString() : null,
		alarmDueAt: task.alarmDueAt ? task.alarmDueAt.toISOString() : null
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

function buildAssistantSystemPrompt({ username, localDay, currentPath }) {
	return [
		'You are the in-app Task Monster assistant.',
		`You are helping the authenticated user ${username}.`,
		`The user local day is ${localDay}.`,
		currentPath ? `The user is currently viewing ${currentPath}.` : null,
		'Task Monster has four relevant task states: inactive, daymap, active, and done/archive outcomes.',
		'Use tools for all task-specific facts and all mutations. Never guess task state or stats.',
		'If the user request is ambiguous, especially around task identity or whether "end" means pause vs done, ask a short clarification question instead of acting.',
		'Interpret "pause" or "take it off active" as moving a task to daymap, not fully back to inactive, unless the user explicitly says backlog or inactive.',
		'Interpret "inactive" or "backlog" as fully removing a task from the daymap.',
		'Category/color mapping: red=System, orange=World, gold=Home, green=Body, teal=Reset, blue=Craft, violet=Becoming.',
		'Persistent task notes live on the task note. Active-run notes live on the instance note.',
		'Format structured replies in markdown with headings, bullets, emphasis, and short sections when useful.',
		'Convert raw milliseconds into human-readable durations unless the user explicitly asks for millisecond values.',
		'Keep replies concise, natural, and action-oriented. Confirm what changed after successful tool use.'
	]
		.filter(Boolean)
		.join('\n');
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
		const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
			method: 'POST',
			headers: {
				authorization: `Bearer ${apiKey}`,
				'content-type': 'application/json'
			},
			body: JSON.stringify({
				model,
				messages,
				tools,
				tool_choice: 'auto',
				parallel_tool_calls: false,
				user: userTag
			}),
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

async function executeCreateTaskTool(app, request, args) {
	const trackingType = args.trackingType || 'time';
	const mode = args.mode || 'repeatable';
	const colorKey = args.colorKey;
	const startState = args.startState || 'inactive';
	const queued = args.queued === true;
	const daymapLocked = args.daymapLocked === true;

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

	const alarmEnabled = args.alarmEnabled === true;
	const body = {
		name: args.name,
		color: colorKey,
		mode,
		trackingType,
		alarmEnabled,
		note: typeof args.note === 'string' ? args.note : null,
		durationMinutes: null,
		snoozeMinutes: null,
		tallyUnit: null,
		tallyTarget: null
	};

	if (trackingType === 'time' && alarmEnabled) {
		if (!TASK_DURATION_VALUES.includes(args.durationMinutes)) {
			return {
				output: {
					ok: false,
					message: 'Alarmed time tasks need a supported duration.'
				},
				actions: [],
				refresh: {
					tasks: false,
					stats: false,
					panic: false
				}
			};
		}

		if (!TASK_SNOOZE_VALUES.includes(args.snoozeMinutes)) {
			return {
				output: {
					ok: false,
					message: 'Alarmed time tasks need a supported snooze length.'
				},
				actions: [],
				refresh: {
					tasks: false,
					stats: false,
					panic: false
				}
			};
		}

		body.durationMinutes = args.durationMinutes;
		body.snoozeMinutes = args.snoozeMinutes;
	}

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

		body.alarmEnabled = false;
		body.tallyUnit = args.tallyUnit.trim();
		body.tallyTarget = args.tallyTarget;
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
				stats: false,
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
					stats: false,
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
					stats: false,
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
			stats: false,
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
		actions: [buildTaskAction('rename_task', `Renamed task to ${taskSummary?.name || nextName}.`, taskSummary)],
		refresh: {
			tasks: true,
			stats: false,
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
		actions: [
			buildTaskAction(
				'set_task_note',
				`${taskSummary?.note ? 'Updated' : 'Cleared'} note for ${taskSummary?.name || 'task'}.`,
				taskSummary
			)
		],
		refresh: {
			tasks: true,
			stats: false,
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
			buildTaskAction(
				'set_task_instance_note',
				`${taskSummary?.instanceNote ? 'Updated' : 'Cleared'} active note for ${taskSummary?.name || 'task'}.`,
				taskSummary
			)
		],
		refresh: {
			tasks: true,
			stats: false,
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
			stats: destination === 'done',
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
			stats: false,
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
		actions: [
			buildTaskAction(
				'set_task_daymap_lock',
				`${args.daymapLocked ? 'Locked' : 'Unlocked'} ${taskSummary?.name || 'task'} for the daymap loop.`,
				taskSummary
			)
		],
		refresh: {
			tasks: true,
			stats: false,
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
		actions: [
			buildTaskAction(
				'update_task_tally',
				`Updated ${taskSummary?.name || 'task'} tally by ${args.delta > 0 ? '+' : ''}${args.delta}.`,
				taskSummary
			)
		],
		refresh: {
			tasks: true,
			stats: false,
			panic: false
		}
	};
}

async function executeSnoozeTaskTool(app, request, args) {
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

	const snoozeResponse = await injectUserRoute(app, request, {
		method: 'POST',
		url: `/tasks/${resolvedTask.task._id.toString()}/snooze`
	});

	if (!snoozeResponse.ok) {
		return {
			output: {
				ok: false,
				message: snoozeResponse.message || 'Unable to snooze the task alarm.'
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
			buildTaskAction('snooze_task', `Snoozed ${taskSummary?.name || 'task'}.`, taskSummary)
		],
		refresh: {
			tasks: true,
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
			name: 'list_tasks',
			description:
				'List tasks from the user board, optionally filtered by state or searched by name.',
			parameters: {
				type: 'object',
				additionalProperties: false,
				properties: {
					status: {
						type: 'string',
						enum: [...TASK_STATUS_VALUES]
					},
					search: {
						type: 'string'
					},
					limit: {
						type: 'integer',
						minimum: 1,
						maximum: MAX_LIST_LIMIT
					},
					includeNotes: {
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
				'Load real day stats, top task breakdown, and recent done/panic items for a specific local day.',
			parameters: {
				type: 'object',
				additionalProperties: false,
				properties: {
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
					alarmEnabled: {
						type: 'boolean'
					},
					durationMinutes: {
						type: 'integer',
						enum: [...TASK_DURATION_VALUES]
					},
					snoozeMinutes: {
						type: 'integer',
						enum: [...TASK_SNOOZE_VALUES]
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
					startState: {
						type: 'string',
						enum: [...TASK_START_STATE_VALUES]
					},
					queued: {
						type: 'boolean'
					},
					daymapLocked: {
						type: 'boolean'
					}
				}
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'rename_task',
			description: 'Rename an existing task.',
			parameters: {
				type: 'object',
				required: ['taskQuery', 'name'],
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
					}
				}
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'set_task_note',
			description:
				'Update or clear the persistent task note. Use this for notes that belong to the task itself.',
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
					note: {
						type: ['string', 'null'],
						maxLength: 2000
					}
				}
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'set_task_instance_note',
			description:
				'Update or clear the active-run note on an active task. Use this only for the current run.',
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
			name: 'move_task',
			description:
				'Move a task between active, daymap, inactive, done, or archived states using Task Monster semantics.',
			parameters: {
				type: 'object',
				required: ['taskQuery', 'destination'],
				additionalProperties: false,
				properties: {
					taskQuery: {
						type: 'string',
						minLength: 1,
						maxLength: 120
					},
					destination: {
						type: 'string',
						enum: [...TASK_MOVE_DESTINATION_VALUES]
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
			name: 'set_task_queue_state',
			description: 'Queue or unqueue a daymap task.',
			parameters: {
				type: 'object',
				required: ['taskQuery', 'queued'],
				additionalProperties: false,
				properties: {
					taskQuery: {
						type: 'string',
						minLength: 1,
						maxLength: 120
					},
					queued: {
						type: 'boolean'
					}
				}
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'set_task_daymap_lock',
			description:
				'Turn the daymap lock on or off. Locked repeatable tasks loop back to daymap after done.',
			parameters: {
				type: 'object',
				required: ['taskQuery', 'daymapLocked'],
				additionalProperties: false,
				properties: {
					taskQuery: {
						type: 'string',
						minLength: 1,
						maxLength: 120
					},
					daymapLocked: {
						type: 'boolean'
					}
				}
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'update_task_tally',
			description: 'Increment or decrement the tally count of an active tally task.',
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
			name: 'snooze_task',
			description: 'Snooze the alarm of an active timed task.',
			parameters: {
				type: 'object',
				required: ['taskQuery'],
				additionalProperties: false,
				properties: {
					taskQuery: {
						type: 'string',
						minLength: 1,
						maxLength: 120
					}
				}
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'start_panic',
			description: 'Start panic mode.',
			parameters: {
				type: 'object',
				additionalProperties: false,
				properties: {}
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'stop_panic',
			description: 'Stop panic mode and optionally record a note and emotional pull score.',
			parameters: {
				type: 'object',
				additionalProperties: false,
				properties: {
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
	const parsedArguments = parseJsonSafely(toolCall.function?.arguments);

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

	switch (toolCall.function.name) {
		case 'list_tasks':
			return executeListTasksTool(app, request, parsedArguments);
		case 'get_day_summary':
			return executeDaySummaryTool(app, request, parsedArguments, timezoneOffsetMinutes);
		case 'create_task':
			return executeCreateTaskTool(app, request, parsedArguments);
		case 'rename_task':
			return executeRenameTaskTool(app, request, parsedArguments);
		case 'set_task_note':
			return executeSetTaskNoteTool(app, request, parsedArguments);
		case 'set_task_instance_note':
			return executeSetTaskInstanceNoteTool(app, request, parsedArguments);
		case 'move_task':
			return executeMoveTaskTool(app, request, parsedArguments);
		case 'set_task_queue_state':
			return executeSetQueueStateTool(app, request, parsedArguments);
		case 'set_task_daymap_lock':
			return executeSetDaymapLockTool(app, request, parsedArguments);
		case 'update_task_tally':
			return executeUpdateTaskTallyTool(app, request, parsedArguments);
		case 'snooze_task':
			return executeSnoozeTaskTool(app, request, parsedArguments);
		case 'start_panic':
			return executeStartPanicTool(app, request, timezoneOffsetMinutes);
		case 'stop_panic':
			return executeStopPanicTool(app, request, parsedArguments, timezoneOffsetMinutes);
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
		.slice(-12);
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
			currentPath: typeof body.currentPath === 'string' ? body.currentPath : ''
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
		}
	}

	throw new Error('The assistant hit its tool-use limit before finishing the reply.');
}

module.exports = {
	assistantChatSchema,
	runAssistantChat
};
