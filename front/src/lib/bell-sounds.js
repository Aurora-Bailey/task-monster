export const DEFAULT_BELL_SOUND_KEY = 'glass';

export const BELL_SOUND_OPTIONS = Object.freeze([
	{
		key: 'glass',
		label: 'Glass',
		tone: 'Bright',
		description: 'A crisp high chime that cuts through quietly.'
	},
	{
		key: 'temple',
		label: 'Temple',
		tone: 'Warm',
		description: 'A softer bronze bell with more body and less sting.'
	},
	{
		key: 'arcade',
		label: 'Arcade',
		tone: 'Synthetic',
		description: 'A sharper digital ping with a slightly playful edge.'
	}
]);

export function getBellSoundOption(key = DEFAULT_BELL_SOUND_KEY) {
	return (
		BELL_SOUND_OPTIONS.find((option) => option.key === key) ??
		BELL_SOUND_OPTIONS[0]
	);
}

export async function unlockBellAudio(currentAudioContext) {
	if (typeof window === 'undefined') {
		return {
			audioContext: currentAudioContext,
			audioSupported: true,
			audioReady: false
		};
	}

	const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;

	if (!AudioContextConstructor) {
		return {
			audioContext: null,
			audioSupported: false,
			audioReady: false
		};
	}

	const audioContext = currentAudioContext || new AudioContextConstructor();

	try {
		if (audioContext.state === 'suspended') {
			await audioContext.resume();
		}
	} catch (error) {
		console.error(error);
	}

	return {
		audioContext,
		audioSupported: true,
		audioReady: audioContext.state === 'running'
	};
}

export function playBellSound(audioContext, soundKey = DEFAULT_BELL_SOUND_KEY) {
	if (!audioContext || audioContext.state !== 'running') {
		return;
	}

	switch (soundKey) {
		case 'temple':
			playTempleBell(audioContext);
			return;
		case 'arcade':
			playArcadeBell(audioContext);
			return;
		case 'glass':
		default:
			playGlassBell(audioContext);
	}
}

function playGlassBell(audioContext) {
	const now = audioContext.currentTime;
	const primaryOscillator = audioContext.createOscillator();
	const accentOscillator = audioContext.createOscillator();
	const gain = audioContext.createGain();

	primaryOscillator.type = 'triangle';
	primaryOscillator.frequency.setValueAtTime(1244, now);
	accentOscillator.type = 'sine';
	accentOscillator.frequency.setValueAtTime(1661, now + 0.06);

	gain.gain.setValueAtTime(0.0001, now);
	gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
	gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);

	primaryOscillator.connect(gain);
	accentOscillator.connect(gain);
	gain.connect(audioContext.destination);

	primaryOscillator.start(now);
	accentOscillator.start(now + 0.06);
	primaryOscillator.stop(now + 0.22);
	accentOscillator.stop(now + 0.42);
}

function playTempleBell(audioContext) {
	const now = audioContext.currentTime;
	const lowOscillator = audioContext.createOscillator();
	const highOscillator = audioContext.createOscillator();
	const gain = audioContext.createGain();

	lowOscillator.type = 'sine';
	lowOscillator.frequency.setValueAtTime(698, now);
	highOscillator.type = 'triangle';
	highOscillator.frequency.setValueAtTime(1046, now + 0.03);

	gain.gain.setValueAtTime(0.0001, now);
	gain.gain.exponentialRampToValueAtTime(0.07, now + 0.03);
	gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);

	lowOscillator.connect(gain);
	highOscillator.connect(gain);
	gain.connect(audioContext.destination);

	lowOscillator.start(now);
	highOscillator.start(now + 0.03);
	lowOscillator.stop(now + 0.45);
	highOscillator.stop(now + 0.68);
}

function playArcadeBell(audioContext) {
	const now = audioContext.currentTime;
	const firstOscillator = audioContext.createOscillator();
	const secondOscillator = audioContext.createOscillator();
	const gain = audioContext.createGain();

	firstOscillator.type = 'square';
	firstOscillator.frequency.setValueAtTime(988, now);
	secondOscillator.type = 'square';
	secondOscillator.frequency.setValueAtTime(1318, now + 0.08);

	gain.gain.setValueAtTime(0.0001, now);
	gain.gain.exponentialRampToValueAtTime(0.06, now + 0.01);
	gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);

	firstOscillator.connect(gain);
	secondOscillator.connect(gain);
	gain.connect(audioContext.destination);

	firstOscillator.start(now);
	secondOscillator.start(now + 0.08);
	firstOscillator.stop(now + 0.12);
	secondOscillator.stop(now + 0.24);
}
