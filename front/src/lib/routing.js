import { base, resolve } from '$app/paths';

export function normalizeAppPathname(pathname) {
	if (!base) {
		return pathname || '/';
	}

	if (pathname === base) {
		return '/';
	}

	if (pathname.startsWith(`${base}/`)) {
		return pathname.slice(base.length) || '/';
	}

	return pathname || '/';
}

export function buildTasksHref({ taskId, search } = {}) {
	const params = new URLSearchParams();
	const normalizedTaskId = typeof taskId === 'string' ? taskId.trim() : '';
	const normalizedSearch = typeof search === 'string' ? search : '';

	if (normalizedTaskId) {
		params.set('task', normalizedTaskId);
	} else if (normalizedSearch.trim()) {
		params.set('search', normalizedSearch);
	}

	const query = params.toString();
	const tasksPath = resolve('/tasks');

	return query ? `${tasksPath}?${query}` : tasksPath;
}
