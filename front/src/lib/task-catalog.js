export const taskCatalog = [
	{
		id: 'morning-reset',
		name: 'Morning reset',
		category: 'Home',
		note: 'Clear the counters, open the blinds, and reset the kitchen before the day starts.',
		color: '#3d9790',
		mode: 'repeatable',
		bellSound: 'glass',
		pomodoro: {
			presetKey: 'short',
			label: 'Short',
			focusMinutes: 15,
			shortBreakMinutes: 5,
			longBreakMinutes: 15,
			longBreakInterval: 4
		},
		window: '7:10 AM',
		location: 'Kitchen',
		activeToday: true
	},
	{
		id: 'focus-sprint',
		name: 'Focus sprint',
		category: 'Work',
		note: 'Ship the next onboarding polish pass without context switching mid-block.',
		color: '#4f6ed6',
		mode: 'one-time',
		bellSound: 'arcade',
		pomodoro: {
			presetKey: 'long',
			label: 'Long',
			focusMinutes: 50,
			shortBreakMinutes: 10,
			longBreakMinutes: 30,
			longBreakInterval: 3
		},
		window: '9:30 AM',
		location: 'Desk',
		activeToday: true
	},
	{
		id: 'walk-loop',
		name: 'Walk loop',
		category: 'Wellness',
		note: 'Get outside for a short reset lap before the afternoon stack of work begins.',
		color: '#5f9b55',
		mode: 'repeatable',
		bellSound: 'temple',
		pomodoro: {
			presetKey: 'short',
			label: 'Short',
			focusMinutes: 15,
			shortBreakMinutes: 5,
			longBreakMinutes: 15,
			longBreakInterval: 4
		},
		window: '12:15 PM',
		location: 'Neighborhood',
		activeToday: true
	},
	{
		id: 'budget-check',
		name: 'Budget check-in',
		category: 'Admin',
		note: 'Review charges, reconcile receipts, and make sure nothing odd is drifting.',
		color: '#c74a4a',
		mode: 'repeatable',
		bellSound: 'glass',
		pomodoro: {
			presetKey: 'medium',
			label: 'Medium',
			focusMinutes: 25,
			shortBreakMinutes: 5,
			longBreakMinutes: 20,
			longBreakInterval: 4
		},
		window: '4:00 PM',
		location: 'Finance desk',
		activeToday: true
	},
	{
		id: 'plant-round',
		name: 'Plant round',
		category: 'Home',
		note: 'Water the patio herbs and rotate the planters that miss the morning light.',
		color: '#5f9b55',
		mode: 'repeatable',
		bellSound: 'temple',
		pomodoro: {
			presetKey: 'short',
			label: 'Short',
			focusMinutes: 15,
			shortBreakMinutes: 5,
			longBreakMinutes: 15,
			longBreakInterval: 4
		},
		window: '6:30 PM',
		location: 'Patio',
		activeToday: false
	},
	{
		id: 'laundry-fold',
		name: 'Laundry fold',
		category: 'Home',
		note: 'Fold the clean load and put the heavier layers away before bedtime.',
		color: '#d7b23d',
		mode: 'one-time',
		bellSound: 'glass',
		pomodoro: {
			presetKey: 'short',
			label: 'Short',
			focusMinutes: 15,
			shortBreakMinutes: 5,
			longBreakMinutes: 15,
			longBreakInterval: 4
		},
		window: '8:00 PM',
		location: 'Bedroom',
		activeToday: false
	},
	{
		id: 'weekly-plan',
		name: 'Weekly plan',
		category: 'Work',
		note: 'Shape the next batch of priorities and decide what actually deserves the table.',
		color: '#8a5bd1',
		mode: 'repeatable',
		bellSound: 'arcade',
		pomodoro: {
			presetKey: 'long',
			label: 'Long',
			focusMinutes: 50,
			shortBreakMinutes: 10,
			longBreakMinutes: 30,
			longBreakInterval: 3
		},
		window: 'Monday, 8:00 AM',
		location: 'Planning board',
		activeToday: false
	},
	{
		id: 'pharmacy-call',
		name: 'Pharmacy call',
		category: 'Admin',
		note: 'Call in the refill request and confirm the pickup window before the weekend.',
		color: '#de7d37',
		mode: 'one-time',
		bellSound: 'temple',
		pomodoro: {
			presetKey: 'short',
			label: 'Short',
			focusMinutes: 15,
			shortBreakMinutes: 5,
			longBreakMinutes: 15,
			longBreakInterval: 4
		},
		window: 'Friday, 11:00 AM',
		location: 'Phone',
		activeToday: false
	},
	{
		id: 'reading-notes',
		name: 'Reading notes',
		category: 'Learning',
		note: 'Pull the useful ideas out of the current chapter instead of just highlighting them.',
		color: '#4f6ed6',
		mode: 'repeatable',
		bellSound: 'glass',
		pomodoro: {
			presetKey: 'medium',
			label: 'Medium',
			focusMinutes: 25,
			shortBreakMinutes: 5,
			longBreakMinutes: 20,
			longBreakInterval: 4
		},
		window: '9:00 PM',
		location: 'Reading chair',
		activeToday: false
	}
];

export const activeTasks = taskCatalog.filter((task) => task.activeToday);
export const inactiveTasks = taskCatalog.filter((task) => !task.activeToday);

export function formatMinutes(minutes) {
	if (minutes % 60 === 0) {
		const hours = minutes / 60;
		return `${hours} hr${hours === 1 ? '' : 's'}`;
	}

	return `${minutes} min`;
}

export function formatTaskMode(mode) {
	return mode === 'repeatable' ? 'Repeatable' : 'One-time';
}
