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

export function loadActiveTasks() {
	return loadTaskList('/tasks/active');
}

export function loadInactiveTasks() {
	return loadTaskList('/tasks/inactive');
}

export function activateTask(taskId) {
	return runTaskAction(taskId, 'activate');
}

export function inactivateTask(taskId) {
	return runTaskAction(taskId, 'inactivate');
}

export function doneTask(taskId) {
	return runTaskAction(taskId, 'done');
}

export function snoozeTask(taskId) {
	return runTaskAction(taskId, 'snooze');
}
