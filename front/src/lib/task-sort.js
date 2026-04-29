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
	{ value: 'alpha', label: 'A-Z' }
];
export const DAYMAP_TASK_SORT_OPTIONS = [...TASK_SORT_OPTIONS, { value: 'queue', label: 'Queue' }];

function getTaskSortModes(options = TASK_SORT_OPTIONS) {
	return new Set(options.map((option) => option.value));
}

function isValidTaskSortMode(mode, options = TASK_SORT_OPTIONS) {
	return getTaskSortModes(options).has(mode);
}

export function loadStoredTaskSort(pageKey, options = TASK_SORT_OPTIONS) {
	if (typeof localStorage === 'undefined') {
		return DEFAULT_TASK_SORT_MODE;
	}

	const storedMode = localStorage.getItem(`${TASK_SORT_STORAGE_PREFIX}${pageKey}`);

	return isValidTaskSortMode(storedMode, options) ? storedMode : DEFAULT_TASK_SORT_MODE;
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
			return new Date(task.completedAt || task.endedAt || task.lastCompletedAt || task.updatedAt).getTime();
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

		return (
			compareByDate(left, right, variant) ||
			compareByColor(left, right) ||
			compareByAlpha(left, right)
		);
	});
}
