const POMODORO_PRESETS = Object.freeze({
	short: Object.freeze({
		presetKey: 'short',
		label: 'Short',
		focusMinutes: 15,
		shortBreakMinutes: 5,
		longBreakMinutes: 15,
		longBreakInterval: 4
	}),
	medium: Object.freeze({
		presetKey: 'medium',
		label: 'Medium',
		focusMinutes: 25,
		shortBreakMinutes: 5,
		longBreakMinutes: 20,
		longBreakInterval: 4
	}),
	long: Object.freeze({
		presetKey: 'long',
		label: 'Long',
		focusMinutes: 50,
		shortBreakMinutes: 10,
		longBreakMinutes: 30,
		longBreakInterval: 3
	})
});

const POMODORO_PRESET_KEYS = Object.freeze(Object.keys(POMODORO_PRESETS));

function isValidPomodoroPresetKey(value) {
	return POMODORO_PRESET_KEYS.includes(value);
}

function getPomodoroPreset(presetKey = 'medium') {
	return POMODORO_PRESETS[presetKey] || POMODORO_PRESETS.medium;
}

function inferPomodoroPresetKeyFromLegacyTask(task) {
	const durationMinutes = Number.isInteger(task?.durationMinutes) ? task.durationMinutes : null;

	if (durationMinutes === null) {
		return 'medium';
	}

	if (durationMinutes <= 20) {
		return 'short';
	}

	if (durationMinutes >= 45) {
		return 'long';
	}

	return 'medium';
}

function isStoredPomodoroShapeValid(pomodoro) {
	return (
		pomodoro &&
		typeof pomodoro === 'object' &&
		isValidPomodoroPresetKey(pomodoro.presetKey) &&
		Number.isInteger(pomodoro.focusMinutes) &&
		pomodoro.focusMinutes > 0 &&
		Number.isInteger(pomodoro.shortBreakMinutes) &&
		pomodoro.shortBreakMinutes > 0 &&
		Number.isInteger(pomodoro.longBreakMinutes) &&
		pomodoro.longBreakMinutes > 0 &&
		Number.isInteger(pomodoro.longBreakInterval) &&
		pomodoro.longBreakInterval > 0
	);
}

function normalizeStoredPomodoro(task) {
	if (task?.trackingType === 'tally') {
		return null;
	}

	if (Object.hasOwn(task || {}, 'pomodoro') && task.pomodoro === null) {
		return null;
	}

	if (isStoredPomodoroShapeValid(task?.pomodoro)) {
		return {
			presetKey: task.pomodoro.presetKey,
			label: getPomodoroPreset(task.pomodoro.presetKey).label,
			focusMinutes: task.pomodoro.focusMinutes,
			shortBreakMinutes: task.pomodoro.shortBreakMinutes,
			longBreakMinutes: task.pomodoro.longBreakMinutes,
			longBreakInterval: task.pomodoro.longBreakInterval
		};
	}

	return getPomodoroPreset(inferPomodoroPresetKeyFromLegacyTask(task));
}

module.exports = {
	POMODORO_PRESETS,
	POMODORO_PRESET_KEYS,
	getPomodoroPreset,
	inferPomodoroPresetKeyFromLegacyTask,
	isValidPomodoroPresetKey,
	normalizeStoredPomodoro
};
