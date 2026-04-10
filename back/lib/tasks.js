const TASK_COLOR_MAP = Object.freeze({
	red: '#c74a4a',
	orange: '#de7d37',
	gold: '#d7b23d',
	green: '#5f9b55',
	teal: '#3d9790',
	blue: '#4f6ed6',
	violet: '#8a5bd1'
});

const TASK_MODE_VALUES = Object.freeze(['one-time', 'repeatable']);
const TASK_DURATION_VALUES = Object.freeze([5, 10, 15, 20, 30, 45, 60, 90, 120, 180]);
const TASK_SNOOZE_VALUES = Object.freeze([5, 10, 15, 20, 30]);

function isAllowedTaskColor(color) {
	return Object.hasOwn(TASK_COLOR_MAP, color);
}

function isAllowedTaskMode(mode) {
	return TASK_MODE_VALUES.includes(mode);
}

function isAllowedTaskDuration(durationMinutes) {
	return TASK_DURATION_VALUES.includes(durationMinutes);
}

function isAllowedTaskSnooze(snoozeMinutes) {
	return TASK_SNOOZE_VALUES.includes(snoozeMinutes);
}

function serializeTask(task) {
	return {
		id: task._id.toString(),
		name: task.name,
		color: task.colorHex,
		colorKey: task.colorKey,
		mode: task.mode,
		alarmEnabled: task.alarmEnabled,
		durationMinutes: task.durationMinutes ?? null,
		snoozeMinutes: task.snoozeMinutes ?? null,
		note: task.note ?? null,
		activeToday: task.activeToday,
		createdAt: task.createdAt.toISOString(),
		updatedAt: task.updatedAt.toISOString()
	};
}

module.exports = {
	TASK_COLOR_MAP,
	TASK_DURATION_VALUES,
	TASK_MODE_VALUES,
	TASK_SNOOZE_VALUES,
	isAllowedTaskColor,
	isAllowedTaskDuration,
	isAllowedTaskMode,
	isAllowedTaskSnooze,
	serializeTask
};
