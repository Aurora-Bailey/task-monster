const TASK_COLOR_ORDER = ['red', 'orange', 'gold', 'green', 'teal', 'blue', 'violet'];
const TASK_SORT_STORAGE_PREFIX = 'task-monster.sort.';

const TASK_COLOR_RANKS = TASK_COLOR_ORDER.reduce((ranks, color, index) => {
	ranks[color] = index;
	return ranks;
}, {});

export const DEFAULT_TASK_SORT_MODE = 'color';
export const TASK_SORT_OPTIONS = [
	{ value: 'date', label: 'Date' },
	{ value: 'color', label: 'Color' },
	{ value: 'alpha', label: 'A-Z' },
	{ value: 'next', label: 'Next' },
	{ value: 'last', label: 'Last' }
];
export const DAYMAP_TASK_SORT_OPTIONS = [...TASK_SORT_OPTIONS, { value: 'queue', label: 'Queue' }];

function getTaskSortModes(options = TASK_SORT_OPTIONS) {
	return new Set(options.map((option) => option.value));
}

function isValidTaskSortMode(mode, options = TASK_SORT_OPTIONS) {
	return getTaskSortModes(options).has(mode);
}

export function loadStoredTaskSort(
	pageKey,
	options = TASK_SORT_OPTIONS,
	defaultMode = DEFAULT_TASK_SORT_MODE
) {
	if (typeof localStorage === 'undefined') {
		return defaultMode;
	}

	const storedMode = localStorage.getItem(`${TASK_SORT_STORAGE_PREFIX}${pageKey}`);

	return isValidTaskSortMode(storedMode, options) ? storedMode : defaultMode;
}

export function storeTaskSort(pageKey, mode, options = TASK_SORT_OPTIONS) {
	if (typeof localStorage === 'undefined' || !isValidTaskSortMode(mode, options)) {
		return;
	}

	localStorage.setItem(`${TASK_SORT_STORAGE_PREFIX}${pageKey}`, mode);
}

function getTaskTime(task, variant) {
	switch (variant) {
		case 'active':
			return new Date(task.activatedAt || task.createdAt || task.updatedAt).getTime();
		case 'daymap':
			return new Date(task.mappedAt || task.updatedAt || task.createdAt).getTime();
		case 'done':
			return new Date(
				task.completedAt || task.endedAt || task.lastCompletedAt || task.updatedAt
			).getTime();
		default:
			return new Date(
				task.updatedAt || task.lastInactivatedAt || task.lastCompletedAt || task.createdAt
			).getTime();
	}
}

function compareByDate(left, right, variant) {
	const leftTime = getTaskTime(left, variant);
	const rightTime = getTaskTime(right, variant);

	if (variant === 'active') {
		return leftTime - rightTime;
	}

	return rightTime - leftTime;
}

function compareByColor(left, right) {
	const leftRank = TASK_COLOR_RANKS[left.colorKey] ?? Number.MAX_SAFE_INTEGER;
	const rightRank = TASK_COLOR_RANKS[right.colorKey] ?? Number.MAX_SAFE_INTEGER;

	return leftRank - rightRank;
}

function compareByAlpha(left, right) {
	return left.name.localeCompare(right.name, undefined, {
		numeric: true,
		sensitivity: 'base'
	});
}

function compareByQueue(left, right) {
	const leftQueuePosition =
		Number.isInteger(left.queuePosition) && left.queuePosition > 0 ? left.queuePosition : null;
	const rightQueuePosition =
		Number.isInteger(right.queuePosition) && right.queuePosition > 0 ? right.queuePosition : null;

	if (leftQueuePosition !== null && rightQueuePosition !== null) {
		return leftQueuePosition - rightQueuePosition;
	}

	if (leftQueuePosition !== null) {
		return -1;
	}

	if (rightQueuePosition !== null) {
		return 1;
	}

	return 0;
}

function getTaskNextDueTime(task) {
	if (!task.nextDueAt) {
		return null;
	}

	const nextDueTime = new Date(task.nextDueAt).getTime();

	return Number.isNaN(nextDueTime) ? null : nextDueTime;
}

function getTaskLastDoneTime(task, variant) {
	const lastDoneSource =
		variant === 'done'
			? task.completedAt || task.endedAt || task.lastCompletedAt
			: task.lastCompletedAt;

	if (!lastDoneSource) {
		return null;
	}

	const lastDoneTime = new Date(lastDoneSource).getTime();

	return Number.isNaN(lastDoneTime) ? null : lastDoneTime;
}

function compareByNextDue(left, right) {
	const leftTime = getTaskNextDueTime(left);
	const rightTime = getTaskNextDueTime(right);

	if (leftTime !== null && rightTime !== null) {
		return leftTime - rightTime;
	}

	if (leftTime !== null) {
		return -1;
	}

	if (rightTime !== null) {
		return 1;
	}

	return 0;
}

function compareByLastDone(left, right, variant) {
	const leftTime = getTaskLastDoneTime(left, variant);
	const rightTime = getTaskLastDoneTime(right, variant);

	if (leftTime !== null && rightTime !== null) {
		return rightTime - leftTime;
	}

	if (leftTime !== null) {
		return -1;
	}

	if (rightTime !== null) {
		return 1;
	}

	return 0;
}

export function sortTasks(items, { mode = DEFAULT_TASK_SORT_MODE, variant = 'inactive' } = {}) {
	return [...items].sort((left, right) => {
		if (mode === 'queue') {
			return (
				compareByQueue(left, right) ||
				compareByColor(left, right) ||
				compareByAlpha(left, right) ||
				compareByDate(left, right, variant)
			);
		}

		if (mode === 'color') {
			return (
				compareByColor(left, right) ||
				compareByAlpha(left, right) ||
				compareByDate(left, right, variant)
			);
		}

		if (mode === 'alpha') {
			return (
				compareByAlpha(left, right) ||
				compareByColor(left, right) ||
				compareByDate(left, right, variant)
			);
		}

		if (mode === 'next') {
			return (
				compareByNextDue(left, right) ||
				compareByColor(left, right) ||
				compareByAlpha(left, right) ||
				compareByDate(left, right, variant)
			);
		}

		if (mode === 'last') {
			return (
				compareByLastDone(left, right, variant) ||
				compareByColor(left, right) ||
				compareByAlpha(left, right) ||
				compareByDate(left, right, variant)
			);
		}

		return (
			compareByDate(left, right, variant) ||
			compareByColor(left, right) ||
			compareByAlpha(left, right)
		);
	});
}

function normalizeSearchValue(value) {
	return String(value ?? '')
		.trim()
		.toLowerCase();
}

function getSearchableTaskText(task) {
	return [
		task.name,
		task.note,
		task.instanceNote,
		task.colorKey,
		task.mode,
		task.trackingType,
		task.tallyUnit
	]
		.filter(Boolean)
		.join(' ')
		.toLowerCase();
}

export function filterTasks(items, query) {
	const normalizedQuery = normalizeSearchValue(query);

	if (!normalizedQuery) {
		return items;
	}

	const queryParts = normalizedQuery.split(/\s+/).filter(Boolean);

	return items.filter((task) => {
		const searchableText = getSearchableTaskText(task);

		return queryParts.every((part) => searchableText.includes(part));
	});
}
