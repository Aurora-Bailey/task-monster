import { readApiBody, readApiError } from './api';
import { authorizedRequest } from './session';

async function loadTaskList(path) {
	const response = await authorizedRequest(path);

	if (!response.ok) {
		throw new Error(await readApiError(response, 'Unable to load tasks.'));
	}

	const body = await readApiBody(response);
	return body?.tasks ?? [];
}

async function runTaskAction(taskId, action) {
	const response = await authorizedRequest(`/tasks/${taskId}/${action}`, {
		method: 'POST'
	});

	if (!response.ok) {
		throw new Error(await readApiError(response, 'Unable to update the task.'));
	}

	const body = await readApiBody(response);
	return body?.task ?? null;
}

export async function updateTaskNote(taskId, note) {
	const response = await authorizedRequest(`/tasks/${taskId}/note`, {
		method: 'PATCH',
		body: {
			note
		}
	});

	if (!response.ok) {
		throw new Error(await readApiError(response, 'Unable to update the note.'));
	}

	const body = await readApiBody(response);
	return body?.task ?? null;
}

export async function updateTaskInstanceNote(taskId, instanceNote) {
	const response = await authorizedRequest(`/tasks/${taskId}/instance-note`, {
		method: 'PATCH',
		body: {
			instanceNote
		}
	});

	if (!response.ok) {
		throw new Error(await readApiError(response, 'Unable to update the instance note.'));
	}

	const body = await readApiBody(response);
	return body?.task ?? null;
}

export async function updateTaskTally(taskId, delta) {
	const response = await authorizedRequest(`/tasks/${taskId}/tally`, {
		method: 'POST',
		body: {
			delta
		}
	});

	if (!response.ok) {
		throw new Error(await readApiError(response, 'Unable to update the tally.'));
	}

	const body = await readApiBody(response);
	return body?.task ?? null;
}

export function loadActiveTasks() {
	return loadTaskList('/tasks/active');
}

export function loadDaymapTasks() {
	return loadTaskList('/tasks/daymap');
}

export function loadInactiveTasks() {
	return loadTaskList('/tasks/inactive');
}

export function loadDoneTasks() {
	return loadTaskList('/tasks/done');
}

export async function loadDoneHistory({ day, tzOffsetMinutes } = {}) {
	const params = new URLSearchParams();

	if (day) {
		params.set('day', day);
	}

	if (tzOffsetMinutes !== undefined && tzOffsetMinutes !== null) {
		params.set('tzOffsetMinutes', String(tzOffsetMinutes));
	}

	const queryString = params.toString();
	const query = queryString ? `?${queryString}` : '';
	const response = await authorizedRequest(`/tasks/done${query}`);

	if (!response.ok) {
		throw new Error(await readApiError(response, 'Unable to load completed tasks.'));
	}

	const body = await readApiBody(response);

	return {
		tasks: body?.tasks ?? [],
		days: body?.days ?? [],
		selectedDay: body?.selectedDay ?? null
	};
}

export async function activateTask(taskId) {
	const response = await authorizedRequest(`/tasks/${taskId}/activate`, {
		method: 'POST'
	});

	if (!response.ok) {
		throw new Error(await readApiError(response, 'Unable to update the task.'));
	}

	const body = await readApiBody(response);
	return body?.task ?? null;
}

export function archiveTask(taskId) {
	return runTaskAction(taskId, 'archive');
}

export function moveTaskToDaymap(taskId) {
	return runTaskAction(taskId, 'daymap');
}

export function inactivateTask(taskId) {
	return runTaskAction(taskId, 'inactivate');
}

export function queueTask(taskId) {
	return runTaskAction(taskId, 'queue');
}

export function unmapTask(taskId) {
	return runTaskAction(taskId, 'unmap');
}

export function unqueueTask(taskId) {
	return runTaskAction(taskId, 'unqueue');
}

export function doneTask(taskId) {
	return runTaskAction(taskId, 'done');
}

export function snoozeTask(taskId) {
	return runTaskAction(taskId, 'snooze');
}
