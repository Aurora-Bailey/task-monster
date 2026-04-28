const DEFAULT_BELL_SOUND_KEY = 'glass';
const BELL_SOUND_VALUES = Object.freeze(['glass', 'temple', 'arcade']);

function isAllowedBellSound(value) {
	return BELL_SOUND_VALUES.includes(value);
}

function normalizeStoredBellSound(task) {
	if (task?.trackingType === 'tally') {
		return null;
	}

	return isAllowedBellSound(task?.bellSound) ? task.bellSound : DEFAULT_BELL_SOUND_KEY;
}

module.exports = {
	BELL_SOUND_VALUES,
	DEFAULT_BELL_SOUND_KEY,
	isAllowedBellSound,
	normalizeStoredBellSound
};
