import { activeTasks, taskCatalog } from '$lib/task-catalog';

export const dailyStats = {
	dateLabel: 'Today',
	totalMinutes: 142,
	tasksAccomplished: 5,
	overlapBonus: 18,
	completionRate: 83,
	recoveries: 3,
	byTask: [
		{ name: 'Morning reset', minutes: 17, completed: true, overlap: false, color: '#3d9790' },
		{ name: 'Focus sprint', minutes: 52, completed: true, overlap: false, color: '#4f6ed6' },
		{ name: 'Walk loop', minutes: 24, completed: true, overlap: true, color: '#5f9b55' },
		{ name: 'Budget check-in', minutes: 31, completed: true, overlap: false, color: '#c74a4a' },
		{ name: 'Plant round', minutes: 18, completed: true, overlap: true, color: '#5f9b55' }
	]
};

export const dailyTimeline = [
	{
		label: 'Morning stack',
		window: '7:00 AM to 9:00 AM',
		primary: 'Morning reset',
		secondary: 'Focus sprint overlap for 6 min',
		intensity: 74
	},
	{
		label: 'Midday push',
		window: '12:10 PM to 1:00 PM',
		primary: 'Walk loop',
		secondary: 'Voice notes captured during cooldown',
		intensity: 58
	},
	{
		label: 'Afternoon admin',
		window: '3:45 PM to 4:25 PM',
		primary: 'Budget check-in',
		secondary: 'One snooze recovery',
		intensity: 66
	}
];

export const weeklyStats = {
	weekLabel: 'This week',
	totalMinutes: 612,
	tasksCompleted: 24,
	consistencyScore: 81,
	overlapBonus: 74,
	weeklyGoalProgress: 68,
	broadProgress: [
		{
			label: 'Home systems',
			progress: 72,
			note: 'Kitchen reset and laundry blocks are landing on schedule.'
		},
		{
			label: 'Deep work',
			progress: 64,
			note: 'Three focused work sessions shipped, one drifted into admin spillover.'
		},
		{
			label: 'Body maintenance',
			progress: 79,
			note: 'Walks and short resets are steady, stretching is still inconsistent.'
		},
		{
			label: 'Planning cadence',
			progress: 58,
			note: 'Weekly planning is drafted but follow-through is lagging midweek.'
		}
	],
	dailyRollup: [
		{ day: 'Mon', tasks: 4, minutes: 96 },
		{ day: 'Tue', tasks: 5, minutes: 128 },
		{ day: 'Wed', tasks: 3, minutes: 82 },
		{ day: 'Thu', tasks: 5, minutes: 134 },
		{ day: 'Fri', tasks: 4, minutes: 110 },
		{ day: 'Sat', tasks: 2, minutes: 28 },
		{ day: 'Sun', tasks: 1, minutes: 34 }
	]
};

export const statsOverview = {
	trackedTasks: taskCatalog.length,
	activeNow: activeTasks.length,
	averageTaskMinutes: Math.round(
		taskCatalog.reduce((sum, task) => sum + task.durationMinutes, 0) / taskCatalog.length
	)
};
