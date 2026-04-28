export const NO_POMODORO_PRESET_KEY = 'none';

export const POMODORO_PRESET_OPTIONS = Object.freeze([
	{
		presetKey: NO_POMODORO_PRESET_KEY,
		label: 'No pomodoro',
		focusMinutes: null,
		shortBreakMinutes: null,
		longBreakMinutes: null,
		longBreakInterval: null,
		tagline: 'Manual run',
		description: 'Track active time without focus or break bells.'
	},
	{
		presetKey: 'short',
		label: 'Short',
		focusMinutes: 15,
		shortBreakMinutes: 5,
		longBreakMinutes: 15,
		longBreakInterval: 4,
		tagline: 'Gentle start',
		description: 'Low gate for tired, anxious, or shutdown days.'
	},
	{
		presetKey: 'medium',
		label: 'Medium',
		focusMinutes: 25,
		shortBreakMinutes: 5,
		longBreakMinutes: 20,
		longBreakInterval: 4,
		tagline: 'Classic flow',
		description: 'Normal work rhythm for study, chores, and admin.'
	},
	{
		presetKey: 'long',
		label: 'Long',
		focusMinutes: 50,
		shortBreakMinutes: 10,
		longBreakMinutes: 30,
		longBreakInterval: 3,
		tagline: 'Deep lock-in',
		description: 'Longer focus windows when context switching hurts.'
	}
]);

export function getPomodoroPresetOption(presetKey = 'medium') {
	return (
		POMODORO_PRESET_OPTIONS.find((option) => option.presetKey === presetKey) ??
		POMODORO_PRESET_OPTIONS[2]
	);
}

export function formatPomodoroCadence(pomodoro) {
	if (!pomodoro || pomodoro.presetKey === NO_POMODORO_PRESET_KEY) {
		return 'No pomodoro cadence';
	}

	return `${pomodoro.focusMinutes}/${pomodoro.shortBreakMinutes}`;
}

export function formatPomodoroLongBreak(pomodoro) {
	if (!pomodoro || pomodoro.presetKey === NO_POMODORO_PRESET_KEY) {
		return 'No automatic break bells';
	}

	return `${pomodoro.longBreakMinutes}m long break every ${pomodoro.longBreakInterval} focus blocks`;
}

export function getPomodoroState(task, nowMs = Date.now()) {
	if (
		!task?.activeToday ||
		task.trackingType === 'tally' ||
		!task?.pomodoro ||
		!task?.activatedAt
	) {
		return null;
	}

	const activatedAtMs = new Date(task.activatedAt).getTime();

	if (!Number.isFinite(activatedAtMs)) {
		return null;
	}

	const focusMs = task.pomodoro.focusMinutes * 60 * 1000;
	const shortBreakMs = task.pomodoro.shortBreakMinutes * 60 * 1000;
	const longBreakMs = task.pomodoro.longBreakMinutes * 60 * 1000;
	const longBreakInterval = task.pomodoro.longBreakInterval;

	if (
		!Number.isFinite(focusMs) ||
		!Number.isFinite(shortBreakMs) ||
		!Number.isFinite(longBreakMs) ||
		!Number.isInteger(longBreakInterval) ||
		longBreakInterval < 1
	) {
		return null;
	}

	let elapsedMs = Math.max(0, nowMs - activatedAtMs);
	let completedFocusBlocks = 0;

	for (;;) {
		if (elapsedMs < focusMs) {
			return {
				phase: 'focus',
				phaseLabel: 'Focus',
				isBreak: false,
				remainingMs: focusMs - elapsedMs,
				elapsedMsInPhase: elapsedMs,
				focusBlockIndex: (completedFocusBlocks % longBreakInterval) + 1,
				completedFocusBlocks,
				longBreakInterval,
				bellKey: null
			};
		}

		elapsedMs -= focusMs;
		completedFocusBlocks += 1;

		const isLongBreak = completedFocusBlocks % longBreakInterval === 0;
		const breakMs = isLongBreak ? longBreakMs : shortBreakMs;

		if (elapsedMs < breakMs) {
			const elapsedMsInPhase = elapsedMs;

			return {
				phase: isLongBreak ? 'long-break' : 'short-break',
				phaseLabel: isLongBreak ? 'Long break' : 'Break',
				isBreak: true,
				remainingMs: breakMs - elapsedMsInPhase,
				elapsedMsInPhase,
				focusBlockIndex: completedFocusBlocks % longBreakInterval || longBreakInterval,
				completedFocusBlocks,
				longBreakInterval,
				bellKey: `${task.id}:${completedFocusBlocks}:${Math.floor(elapsedMsInPhase / 60000)}`
			};
		}

		elapsedMs -= breakMs;
	}
}
