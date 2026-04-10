import { activeTasks, taskCatalog } from '$lib/task-catalog';

const repeatableCount = taskCatalog.filter((task) => task.mode === 'repeatable').length;
const oneTimeCount = taskCatalog.filter((task) => task.mode === 'one-time').length;
const alarmedTaskCount = taskCatalog.filter(
	(task) => Number.isFinite(task.durationMinutes) && Number.isFinite(task.snoozeMinutes)
).length;
const averageTaskMinutes = Math.round(
	taskCatalog.reduce((sum, task) => sum + task.durationMinutes, 0) / taskCatalog.length
);

export const reportOptions = [
	{ id: 'today', label: 'Current day', caption: 'Live readout' },
	{ id: 'yesterday', label: 'Yesterday', caption: 'Previous cycle' },
	{ id: 'week', label: 'Weekly', caption: 'Seven day drift' },
	{ id: 'month', label: 'Monthly', caption: 'Broad arc' }
];

export const statsOverview = [
	{
		label: 'Tracked tasks',
		value: `${taskCatalog.length}`,
		note: 'Current tasks wired into the app, regardless of status.'
	},
	{
		label: 'Active on table',
		value: `${activeTasks.length}`,
		note: 'Tasks that would be showing on the active page right now.'
	},
	{
		label: 'Repeatable',
		value: `${repeatableCount}`,
		note: 'Tasks that recycle back into the inactive pool after completion.'
	},
	{
		label: 'One-time',
		value: `${oneTimeCount}`,
		note: 'Tasks that disappear after they are marked done.'
	},
	{
		label: 'Alarm-ready',
		value: `${alarmedTaskCount}`,
		note: 'Tasks carrying duration and snooze settings for timers.'
	},
	{
		label: 'Average block',
		value: `${averageTaskMinutes} min`,
		note: 'Baseline planned duration across the current filler catalog.'
	}
];

export const statsReports = {
	today: {
		eyebrow: 'Stats',
		title: 'Current day report',
		subtitle:
			'Live filler data showing what landed today, where overlap produced bonus minutes, and which runs are pulling the most weight.',
		windowLabel: 'Thursday, April 9',
		status: 'Live through 7:15 PM',
		heroScore: {
			label: 'Rhythm score',
			value: 88,
			note: 'Strong pacing. The day stayed dense without turning into total chaos.'
		},
		metricCards: [
			{
				label: 'Tracked minutes',
				value: '3h 46m',
				note: 'Closed runs plus what is still sitting active on the table.',
				tone: 'ink'
			},
			{ label: 'Done items', value: '7', note: 'Five repeatable tasks and two one-time clears.', tone: 'teal' },
			{ label: 'Double time', value: '38 min', note: 'Clean two-task overlap windows.', tone: 'gold' },
			{ label: 'Triple time', value: '12 min', note: 'Small stacked bursts, mostly while moving.', tone: 'rose' },
			{ label: 'Quad minutes', value: '4 min', note: 'A tiny but real four-way overlap pocket.', tone: 'night' },
			{ label: 'Snooze saves', value: '3', note: 'Alarm recovered without the task drifting away.', tone: 'blue' }
		],
		scoreCards: [
			{ label: 'Completion', value: 82, note: 'Most planned items either closed or are already active.' },
			{ label: 'Consistency', value: 76, note: 'Starts landed near plan, with a few late slips after lunch.' },
			{ label: 'Alarm discipline', value: 91, note: 'Timers were handled quickly instead of ignored.' }
		],
		counters: [
			{ label: 'Done items', value: '7', note: 'Everything explicitly closed today.' },
			{ label: 'One-time cleared', value: '2', note: 'Tasks removed from future rotation.' },
			{ label: 'Repeatable recycled', value: '5', note: 'Closed and sent back to inactive.' },
			{ label: 'Longest stack', value: '27 min', note: 'Audiobook, dishes, wipe-down, and drying rack pass.' }
		],
		overlapBands: [
			{ label: 'Solo minutes', minutes: 172, note: 'Single-task focus blocks.', color: '#6f7d8b' },
			{ label: 'Double time', minutes: 38, note: 'The main bonus lane.', color: '#3d9790' },
			{ label: 'Triple time', minutes: 12, note: 'Mostly errands stacked with audio.', color: '#d7b23d' },
			{ label: 'Quad minutes', minutes: 4, note: 'Short, messy, but productive.', color: '#c74a4a' }
		],
		breakdown: {
			title: 'Time by task',
			caption: 'Where today actually went once every run was counted.',
			items: [
				{ label: 'Focus sprint', minutes: 68, note: 'Two work blocks, both closed cleanly.', color: '#4f6ed6' },
				{ label: 'Budget check-in', minutes: 31, note: 'One admin block, one follow-up pass.', color: '#c74a4a' },
				{ label: 'Laundry fold', minutes: 29, note: 'Closed as a one-time task.', color: '#d7b23d' },
				{ label: 'Walk loop', minutes: 26, note: 'Voice notes overlapped for half the loop.', color: '#5f9b55' },
				{ label: 'Reading notes', minutes: 21, note: 'One late-evening capture block.', color: '#4f6ed6' },
				{ label: 'Morning reset', minutes: 17, note: 'Quick kitchen reset on wake-up.', color: '#3d9790' },
				{ label: 'Plant round', minutes: 14, note: 'Watering plus a short stretch stack.', color: '#5f9b55' }
			]
		},
		cadence: {
			title: 'Day pulse',
			caption: 'Not every hour mattered equally. These are the densest zones.',
			items: [
				{ label: '7a', minutes: 17, note: 'Reset', color: '#3d9790' },
				{ label: '8a', minutes: 12, note: 'Prep', color: '#80b1de' },
				{ label: '9a', minutes: 46, note: 'Work', color: '#4f6ed6' },
				{ label: '10a', minutes: 22, note: 'Admin', color: '#6f88e8' },
				{ label: '12p', minutes: 24, note: 'Walk', color: '#5f9b55' },
				{ label: '2p', minutes: 18, note: 'Catch-up', color: '#de7d37' },
				{ label: '4p', minutes: 31, note: 'Budget', color: '#c74a4a' },
				{ label: '6p', minutes: 29, note: 'Home', color: '#d7b23d' },
				{ label: '8p', minutes: 21, note: 'Learning', color: '#8a5bd1' },
				{ label: '9p', minutes: 6, note: 'Wrap', color: '#5c6470' }
			]
		},
		combos: [
			{
				title: 'Audiobook + dishes',
				minutes: 18,
				multiplier: '2x',
				note: 'The cleanest low-friction pairing of the day.'
			},
			{
				title: 'Walk loop + voice notes',
				minutes: 12,
				multiplier: '2x',
				note: 'Captured ideas while moving instead of later.'
			},
			{
				title: 'Laundry + call-back queue',
				minutes: 7,
				multiplier: '3x',
				note: 'Fold, voicemail clearing, and calendar glance all landed together.'
			},
			{
				title: 'Plant round + stretch + podcast',
				minutes: 5,
				multiplier: '3x',
				note: 'Tiny stack, but it stole no extra time from the evening.'
			}
		],
		progress: [
			{
				label: 'Home systems',
				progress: 84,
				note: 'Kitchen, laundry, and plant upkeep all landed before the day drifted.'
			},
			{
				label: 'Deep work',
				progress: 71,
				note: 'The main sprint landed, but the second block stayed shorter than planned.'
			},
			{
				label: 'Body maintenance',
				progress: 66,
				note: 'Walk happened, stretching was light, hydration was fine.'
			},
			{
				label: 'Admin stability',
				progress: 78,
				note: 'Budget maintenance and inbox cleanup both got real time.'
			}
		],
		doneLog: [
			{ time: '7:22 AM', title: 'Morning reset', note: 'Counters cleared, blinds open, sink reset.' },
			{ time: '10:18 AM', title: 'Focus sprint', note: 'Shipped the onboarding polish pass.' },
			{ time: '12:42 PM', title: 'Walk loop', note: 'Closed with voice note capture attached.' },
			{ time: '4:26 PM', title: 'Budget check-in', note: 'Receipts reconciled and weird charge reviewed.' },
			{ time: '6:41 PM', title: 'Laundry fold', note: 'One-time task cleared completely.' },
			{ time: '9:18 PM', title: 'Reading notes', note: 'Pulled three usable ideas out of the chapter.' }
		],
		sessionLog: [
			{ window: '7:05-7:22', stack: 'Morning reset + audiobook', minutes: 17, overlap: 'Double', outcome: 'Done' },
			{ window: '9:31-10:18', stack: 'Focus sprint', minutes: 47, overlap: 'Solo', outcome: 'Done' },
			{ window: '12:16-12:42', stack: 'Walk loop + voice notes', minutes: 26, overlap: 'Double', outcome: 'Done' },
			{ window: '3:58-4:26', stack: 'Budget check-in + background music', minutes: 28, overlap: 'Double', outcome: 'Done' },
			{ window: '6:12-6:41', stack: 'Laundry fold + call-back queue', minutes: 29, overlap: 'Triple', outcome: 'Done' },
			{ window: '8:52-9:13', stack: 'Reading notes', minutes: 21, overlap: 'Solo', outcome: 'Done' },
			{ window: '9:14-9:20', stack: 'Plant round + stretch + podcast', minutes: 6, overlap: 'Triple', outcome: 'Active late' }
		]
	},
	yesterday: {
		eyebrow: 'Stats',
		title: 'Yesterday report',
		subtitle:
			'Yesterday was a little noisier. More snoozes, fewer clean finishes, but still enough output to make the day count.',
		windowLabel: 'Wednesday, April 8',
		status: 'Closed day snapshot',
		heroScore: {
			label: 'Rhythm score',
			value: 73,
			note: 'Useful day, but a little ragged around transitions and alarm response.'
		},
		metricCards: [
			{ label: 'Tracked minutes', value: '3h 12m', note: 'Several blocks slipped but still got counted.', tone: 'ink' },
			{ label: 'Done items', value: '6', note: 'Mostly repeatable maintenance wins.', tone: 'teal' },
			{ label: 'Double time', value: '26 min', note: 'Overlap existed, just less often.', tone: 'gold' },
			{ label: 'Triple time', value: '6 min', note: 'A couple compressed errands.', tone: 'rose' },
			{ label: 'Quad minutes', value: '0', note: 'No true four-way overlap showed up.', tone: 'night' },
			{ label: 'Snooze saves', value: '5', note: 'More timer recovery work than ideal.', tone: 'blue' }
		],
		scoreCards: [
			{ label: 'Completion', value: 68, note: 'Several tasks stayed inactive longer than planned.' },
			{ label: 'Consistency', value: 63, note: 'The middle of the day drifted hard.' },
			{ label: 'Alarm discipline', value: 58, note: 'Timers rang longer before being handled.' }
		],
		counters: [
			{ label: 'Done items', value: '6', note: 'Explicit closes logged before sleep.' },
			{ label: 'One-time cleared', value: '1', note: 'One unique task fully removed.' },
			{ label: 'Repeatable recycled', value: '5', note: 'The day still reset a lot of maintenance work.' },
			{ label: 'Longest stack', value: '19 min', note: 'Walk, podcast, and planning notes.' }
		],
		overlapBands: [
			{ label: 'Solo minutes', minutes: 160, note: 'Still mostly single-track work.', color: '#6f7d8b' },
			{ label: 'Double time', minutes: 26, note: 'Useful but limited overlap.', color: '#3d9790' },
			{ label: 'Triple time', minutes: 6, note: 'Only a couple compact bursts.', color: '#d7b23d' },
			{ label: 'Quad minutes', minutes: 0, note: 'Nothing counted here yesterday.', color: '#c74a4a' }
		],
		breakdown: {
			title: 'Time by task',
			caption: 'The day leaned toward maintenance instead of deep work.',
			items: [
				{ label: 'Weekly plan', minutes: 44, note: 'Started late, still worth it.', color: '#8a5bd1' },
				{ label: 'Focus sprint', minutes: 39, note: 'Interrupted once by admin drift.', color: '#4f6ed6' },
				{ label: 'Walk loop', minutes: 24, note: 'Planning notes overlapped briefly.', color: '#5f9b55' },
				{ label: 'Morning reset', minutes: 18, note: 'Routine close, nothing fancy.', color: '#3d9790' },
				{ label: 'Plant round', minutes: 15, note: 'Closed on time.', color: '#5f9b55' },
				{ label: 'Pharmacy call', minutes: 12, note: 'One-time task, cleared after a hold wait.', color: '#de7d37' },
				{ label: 'Reading notes', minutes: 10, note: 'Thin finish before bed.', color: '#4f6ed6' }
			]
		},
		cadence: {
			title: 'Day pulse',
			caption: 'Yesterday had a strong open, soft middle, and modest recovery late.',
			items: [
				{ label: '7a', minutes: 18, note: 'Reset', color: '#3d9790' },
				{ label: '8a', minutes: 10, note: 'Setup', color: '#80b1de' },
				{ label: '9a', minutes: 39, note: 'Work', color: '#4f6ed6' },
				{ label: '11a', minutes: 9, note: 'Hold', color: '#de7d37' },
				{ label: '12p', minutes: 24, note: 'Walk', color: '#5f9b55' },
				{ label: '2p', minutes: 8, note: 'Dip', color: '#8f99a5' },
				{ label: '4p', minutes: 14, note: 'Admin', color: '#c74a4a' },
				{ label: '6p', minutes: 15, note: 'Plants', color: '#5f9b55' },
				{ label: '8p', minutes: 19, note: 'Planning', color: '#8a5bd1' },
				{ label: '9p', minutes: 10, note: 'Notes', color: '#5c6470' }
			]
		},
		combos: [
			{ title: 'Walk + planning notes', minutes: 11, multiplier: '2x', note: 'Best pairing of the day.' },
			{ title: 'Pharmacy hold + email clean-up', minutes: 8, multiplier: '2x', note: 'Turned dead time into useful cleanup.' },
			{ title: 'Plant round + podcast', minutes: 6, multiplier: '2x', note: 'Simple overlap in the evening.' },
			{ title: 'Laundry sort + message replies', minutes: 4, multiplier: '3x', note: 'Small but real compression.' }
		],
		progress: [
			{ label: 'Home systems', progress: 74, note: 'Maintenance work landed, but later than usual.' },
			{ label: 'Deep work', progress: 61, note: 'One main sprint only partly held together.' },
			{ label: 'Body maintenance', progress: 64, note: 'Walk happened, movement otherwise stayed light.' },
			{ label: 'Admin stability', progress: 69, note: 'The necessary call got done even with friction.' }
		],
		doneLog: [
			{ time: '7:24 AM', title: 'Morning reset', note: 'Routine close before work started.' },
			{ time: '10:07 AM', title: 'Focus sprint', note: 'Closed after one interruption.' },
			{ time: '12:38 PM', title: 'Walk loop', note: 'Planning ideas captured on the move.' },
			{ time: '5:12 PM', title: 'Pharmacy call', note: 'One-time task cleared after a hold stretch.' },
			{ time: '6:48 PM', title: 'Plant round', note: 'Evening maintenance block.' },
			{ time: '9:41 PM', title: 'Weekly plan', note: 'Drafted the next set of priorities.' }
		],
		sessionLog: [
			{ window: '7:06-7:24', stack: 'Morning reset', minutes: 18, overlap: 'Solo', outcome: 'Done' },
			{ window: '9:21-10:07', stack: 'Focus sprint', minutes: 46, overlap: 'Solo', outcome: 'Done' },
			{ window: '12:14-12:38', stack: 'Walk loop + planning notes', minutes: 24, overlap: 'Double', outcome: 'Done' },
			{ window: '1:46-1:54', stack: 'Inbox clean-up', minutes: 8, overlap: 'Double', outcome: 'Done' },
			{ window: '4:57-5:12', stack: 'Pharmacy call + email cleanup', minutes: 15, overlap: 'Double', outcome: 'Done' },
			{ window: '6:33-6:48', stack: 'Plant round + podcast', minutes: 15, overlap: 'Double', outcome: 'Done' },
			{ window: '9:02-9:41', stack: 'Weekly plan', minutes: 39, overlap: 'Solo', outcome: 'Done' }
		]
	},
	week: {
		eyebrow: 'Stats',
		title: 'Weekly report',
		subtitle:
			'A broader view of what repeated, what shipped, and how much multi-tasking added without dissolving the week into noise.',
		windowLabel: 'Monday, April 6 to Sunday, April 12',
		status: 'Rolling seven day window',
		heroScore: {
			label: 'Rhythm score',
			value: 81,
			note: 'A healthy week. Strong maintenance discipline with enough deep work to matter.'
		},
		metricCards: [
			{ label: 'Tracked minutes', value: '16h 24m', note: 'Sum of all closed and active filler runs this week.', tone: 'ink' },
			{ label: 'Done items', value: '31', note: 'The weekly close count across all task types.', tone: 'teal' },
			{ label: 'Double time', value: '126 min', note: 'Most overlap stayed in the safe zone.', tone: 'gold' },
			{ label: 'Triple time', value: '28 min', note: 'A few dense stack windows appeared.', tone: 'rose' },
			{ label: 'Quad minutes', value: '6 min', note: 'Rare, but not imaginary.', tone: 'night' },
			{ label: 'Snooze saves', value: '12', note: 'Timers recovered without losing the task entirely.', tone: 'blue' }
		],
		scoreCards: [
			{ label: 'Completion', value: 79, note: 'Most weekly anchors landed on at least one day.' },
			{ label: 'Consistency', value: 83, note: 'The week avoided major dead zones.' },
			{ label: 'Alarm discipline', value: 74, note: 'Not bad, but alarms still sat too long in a few spots.' }
		],
		counters: [
			{ label: 'Done items', value: '31', note: 'All closes recorded this week.' },
			{ label: 'One-time cleared', value: '6', note: 'One-time tasks fully removed after completion.' },
			{ label: 'Repeatable recycled', value: '25', note: 'The weekly backbone is still repeatable work.' },
			{ label: 'Longest stack', value: '44 min', note: 'Walk, audiobook, errands, and note capture together.' }
		],
		overlapBands: [
			{ label: 'Solo minutes', minutes: 824, note: 'Single-task work still carried the week.', color: '#6f7d8b' },
			{ label: 'Double time', minutes: 126, note: 'Two-task overlap did the real compression.', color: '#3d9790' },
			{ label: 'Triple time', minutes: 28, note: 'Useful but not dominant.', color: '#d7b23d' },
			{ label: 'Quad minutes', minutes: 6, note: 'Tiny slice of the week.', color: '#c74a4a' }
		],
		breakdown: {
			title: 'Minutes by task family',
			caption: 'Weekly view stays broader so the page does not become a wall of tiny task bars.',
			items: [
				{ label: 'Deep work', minutes: 290, note: 'Focus sprint and planning blocks.', color: '#4f6ed6' },
				{ label: 'Home systems', minutes: 248, note: 'Resets, laundry, plant care, dishes.', color: '#3d9790' },
				{ label: 'Admin', minutes: 144, note: 'Budgeting, calls, and inbox cleanup.', color: '#c74a4a' },
				{ label: 'Learning', minutes: 122, note: 'Reading notes and audio capture.', color: '#8a5bd1' },
				{ label: 'Wellness', minutes: 106, note: 'Walks and short body reset blocks.', color: '#5f9b55' },
				{ label: 'Planning', minutes: 74, note: 'Weekly direction and next-step shaping.', color: '#de7d37' }
			]
		},
		cadence: {
			title: 'Week pulse',
			caption: 'The weekly shape is visible fast when each day gets its own bar.',
			items: [
				{ label: 'Mon', minutes: 142, note: 'Steady open', color: '#3d9790' },
				{ label: 'Tue', minutes: 178, note: 'Best day', color: '#4f6ed6' },
				{ label: 'Wed', minutes: 111, note: 'Soft middle', color: '#de7d37' },
				{ label: 'Thu', minutes: 226, note: 'Heavy push', color: '#c74a4a' },
				{ label: 'Fri', minutes: 148, note: 'Even', color: '#5f9b55' },
				{ label: 'Sat', minutes: 92, note: 'Maintenance', color: '#d7b23d' },
				{ label: 'Sun', minutes: 87, note: 'Reset', color: '#8a5bd1' }
			]
		},
		combos: [
			{ title: 'Audiobook + dishes', minutes: 54, multiplier: '2x', note: 'The weekly overlap champion.' },
			{ title: 'Walk + note capture', minutes: 33, multiplier: '2x', note: 'Reliable way to stack movement with planning.' },
			{ title: 'Laundry + call queue', minutes: 18, multiplier: '3x', note: 'Admin finally stopped demanding its own block.' },
			{ title: 'Plant care + stretch + podcast', minutes: 11, multiplier: '3x', note: 'Small but repeatable evening compression.' }
		],
		progress: [
			{ label: 'Home systems', progress: 82, note: 'The home stack stayed consistently reset by night.' },
			{ label: 'Deep work', progress: 77, note: 'Enough real attention blocks to move important work.' },
			{ label: 'Body maintenance', progress: 71, note: 'Walk cadence held better than stretching cadence.' },
			{ label: 'Planning cadence', progress: 69, note: 'Weekly planning exists, but midweek review could tighten.' }
		],
		doneLog: [
			{ time: 'Mon 8:54 AM', title: 'Weekly plan', note: 'Opened the week with a clean priority map.' },
			{ time: 'Tue 10:11 AM', title: 'Focus sprint', note: 'Most productive work block of the week.' },
			{ time: 'Wed 5:12 PM', title: 'Pharmacy call', note: 'A drag to do, but fully cleared.' },
			{ time: 'Thu 6:41 PM', title: 'Laundry fold', note: 'One-time task closed before the pile grew teeth.' },
			{ time: 'Fri 4:18 PM', title: 'Budget check-in', note: 'Closed with no dangling receipts.' },
			{ time: 'Sun 9:14 PM', title: 'Reading notes', note: 'A small but real weekly learning close.' }
		],
		sessionLog: [
			{ window: 'Mon 7:04-7:23', stack: 'Morning reset + audiobook', minutes: 19, overlap: 'Double', outcome: 'Done' },
			{ window: 'Tue 9:12-10:11', stack: 'Focus sprint', minutes: 59, overlap: 'Solo', outcome: 'Done' },
			{ window: 'Wed 12:16-12:38', stack: 'Walk + note capture', minutes: 22, overlap: 'Double', outcome: 'Done' },
			{ window: 'Thu 6:12-6:41', stack: 'Laundry + call queue', minutes: 29, overlap: 'Triple', outcome: 'Done' },
			{ window: 'Fri 3:54-4:18', stack: 'Budget check + playlist', minutes: 24, overlap: 'Double', outcome: 'Done' },
			{ window: 'Sat 10:08-10:26', stack: 'Plant round + podcast', minutes: 18, overlap: 'Double', outcome: 'Done' },
			{ window: 'Sun 8:52-9:14', stack: 'Reading notes', minutes: 22, overlap: 'Solo', outcome: 'Done' }
		]
	},
	month: {
		eyebrow: 'Stats',
		title: 'Monthly report',
		subtitle:
			'The monthly view leans broad on purpose: big arcs, real totals, repeated pairings, and enough texture to show how the weeks actually behaved.',
		windowLabel: 'April 2026',
		status: 'Rolling thirty day snapshot',
		heroScore: {
			label: 'Rhythm score',
			value: 79,
			note: 'A solid month. Good maintenance backbone, decent output, and plenty of chances to tighten the middle.'
		},
		metricCards: [
			{ label: 'Tracked minutes', value: '71h 26m', note: 'Total filler time represented across the month.', tone: 'ink' },
			{ label: 'Done items', value: '124', note: 'Closed items across repeatable and one-time tasks.', tone: 'teal' },
			{ label: 'Double time', value: '512 min', note: 'The month was built on safe overlap.', tone: 'gold' },
			{ label: 'Triple time', value: '104 min', note: 'Useful bursts when the day got dense.', tone: 'rose' },
			{ label: 'Quad minutes', value: '24 min', note: 'Rare, but enough to matter in the totals.', tone: 'night' },
			{ label: 'Snooze saves', value: '41', note: 'Plenty of timer recoveries instead of abandoned alarms.', tone: 'blue' }
		],
		scoreCards: [
			{ label: 'Completion', value: 77, note: 'The catalog mostly turned over instead of collecting dust.' },
			{ label: 'Consistency', value: 81, note: 'The month stayed steady without huge silent patches.' },
			{ label: 'Alarm discipline', value: 72, note: 'The weakest of the three, but still serviceable.' }
		],
		counters: [
			{ label: 'Done items', value: '124', note: 'All monthly closes captured in the filler ledger.' },
			{ label: 'One-time cleared', value: '18', note: 'Distinct tasks that disappeared once finished.' },
			{ label: 'Repeatable recycled', value: '106', note: 'The system is overwhelmingly driven by repeatable work.' },
			{ label: 'Longest stack', value: '63 min', note: 'A weekend errand run with audio, planning, and cleanup overlap.' }
		],
		overlapBands: [
			{ label: 'Solo minutes', minutes: 3646, note: 'Still the bulk of the month.', color: '#6f7d8b' },
			{ label: 'Double time', minutes: 512, note: 'The main compression layer all month long.', color: '#3d9790' },
			{ label: 'Triple time', minutes: 104, note: 'Much less common, but useful.', color: '#d7b23d' },
			{ label: 'Quad minutes', minutes: 24, note: 'Real, but thankfully rare.', color: '#c74a4a' }
		],
		breakdown: {
			title: 'Minutes by category',
			caption: 'Thirty days is too wide for individual task bars, so the categories take over.',
			items: [
				{ label: 'Home systems', minutes: 1128, note: 'Kitchen, laundry, plants, dishes, resets.', color: '#3d9790' },
				{ label: 'Deep work', minutes: 986, note: 'Focus sprints and structured planning.', color: '#4f6ed6' },
				{ label: 'Admin', minutes: 672, note: 'Budgeting, calls, scheduling, and inbox passes.', color: '#c74a4a' },
				{ label: 'Learning', minutes: 524, note: 'Reading notes, audio capture, and review.', color: '#8a5bd1' },
				{ label: 'Wellness', minutes: 436, note: 'Walks, short resets, and basic body upkeep.', color: '#5f9b55' },
				{ label: 'Planning', minutes: 340, note: 'Weekly and monthly steering work.', color: '#de7d37' }
			]
		},
		cadence: {
			title: 'Week by week load',
			caption: 'Each bar is a week. The middle of the month did the most work.',
			items: [
				{ label: 'W1', minutes: 932, note: 'Strong open', color: '#3d9790' },
				{ label: 'W2', minutes: 1014, note: 'Heaviest week', color: '#4f6ed6' },
				{ label: 'W3', minutes: 1102, note: 'Peak output', color: '#c74a4a' },
				{ label: 'W4', minutes: 930, note: 'Stable close', color: '#d7b23d' },
				{ label: 'W5', minutes: 308, note: 'Partial week', color: '#8a5bd1' }
			]
		},
		combos: [
			{ title: 'Audiobook + dishes', minutes: 148, multiplier: '2x', note: 'The clear monthly overlap winner.' },
			{ title: 'Walk + notes', minutes: 112, multiplier: '2x', note: 'Good for body maintenance without losing idea capture.' },
			{ title: 'Laundry + call queue', minutes: 57, multiplier: '3x', note: 'Admin got folded into chores repeatedly.' },
			{ title: 'Plant care + stretch + podcast', minutes: 33, multiplier: '3x', note: 'A reliable low-energy evening stack.' }
		],
		progress: [
			{ label: 'Home systems', progress: 86, note: 'The house usually landed in a good state by the end of the day.' },
			{ label: 'Deep work', progress: 76, note: 'The month delivered, even if some sessions ran shorter than planned.' },
			{ label: 'Body maintenance', progress: 69, note: 'Walks were steady, stretching still needs more weight.' },
			{ label: 'Planning cadence', progress: 72, note: 'Weekly steering is present, monthly reviews could deepen.' },
			{ label: 'Learning capture', progress: 64, note: 'Good intake, but more extraction would raise the ceiling.' }
		],
		doneLog: [
			{ time: 'Apr 3', title: 'Closet reset', note: 'Large one-time cleanup block fully cleared.' },
			{ time: 'Apr 7', title: 'Weekly plan', note: 'Most stable planning session of the month.' },
			{ time: 'Apr 11', title: 'Budget sweep', note: 'Receipts and subscriptions fully reconciled.' },
			{ time: 'Apr 18', title: 'Pharmacy call', note: 'A repeated nuisance task closed before the refill gap.' },
			{ time: 'Apr 22', title: 'Reading notes', note: 'Best capture session from the current book.' },
			{ time: 'Apr 27', title: 'Laundry backlog', note: 'One-time pile fully broken down and cleared.' }
		],
		sessionLog: [
			{ window: 'Apr 2 7:08-7:29', stack: 'Morning reset + audiobook', minutes: 21, overlap: 'Double', outcome: 'Done' },
			{ window: 'Apr 7 8:02-8:58', stack: 'Weekly plan', minutes: 56, overlap: 'Solo', outcome: 'Done' },
			{ window: 'Apr 11 3:46-4:22', stack: 'Budget sweep + playlist', minutes: 36, overlap: 'Double', outcome: 'Done' },
			{ window: 'Apr 16 6:03-6:34', stack: 'Laundry + call queue', minutes: 31, overlap: 'Triple', outcome: 'Done' },
			{ window: 'Apr 19 12:11-12:44', stack: 'Walk + notes + podcast', minutes: 33, overlap: 'Triple', outcome: 'Done' },
			{ window: 'Apr 24 9:09-10:07', stack: 'Focus sprint', minutes: 58, overlap: 'Solo', outcome: 'Done' },
			{ window: 'Apr 28 8:48-9:17', stack: 'Reading notes', minutes: 29, overlap: 'Solo', outcome: 'Done' }
		]
	}
};
