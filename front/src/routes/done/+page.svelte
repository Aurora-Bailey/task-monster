<script>
	import { onMount } from 'svelte';

	import { ASSISTANT_REFRESH_EVENT } from '$lib/assistant-client';
	import TaskCard from '$lib/TaskCard.svelte';
	import { formatElapsedDuration, formatTallyCount } from '$lib/task-format';
	import TaskSortBar from '$lib/TaskSortBar.svelte';
	import {
		DEFAULT_TASK_SORT_MODE,
		filterTasks,
		loadStoredTaskSort,
		sortTasks,
		storeTaskSort
	} from '$lib/task-sort';
	import { loadDoneHistory, updateTaskNote } from '$lib/tasks-client';

	const completedAtFormatter = new Intl.DateTimeFormat(undefined, {
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
	});
	const dayLabelFormatter = new Intl.DateTimeFormat(undefined, {
		month: 'long',
		day: 'numeric'
	});

	let tasks = $state([]);
	let availableDays = $state([]);
	let selectedDay = $state(null);
	let isLoading = $state(true);
	let loadError = $state('');
	let timezoneOffsetMinutes = 0;
	let sortMode = $state(DEFAULT_TASK_SORT_MODE);
	let searchQuery = $state('');

	function formatCompletedAt(value) {
		return completedAtFormatter.format(new Date(value));
	}

	function formatDoneMeasure(task) {
		if (task.trackingType === 'tally') {
			return formatTallyCount(task.tallyCount ?? 0, task.tallyUnit || 'units');
		}

		return formatElapsedDuration(task.spentMilliseconds);
	}

	function formatPanicDuration(task) {
		return `Panic ${formatElapsedDuration(task.panicMilliseconds ?? 0)}`;
	}

	function formatEffectiveDuration(task) {
		const effectiveMilliseconds = Number.isInteger(task.effectiveMilliseconds)
			? task.effectiveMilliseconds
			: Math.max(0, (task.spentMilliseconds ?? 0) - (task.panicMilliseconds ?? 0));

		return `Effective ${formatElapsedDuration(effectiveMilliseconds)}`;
	}

	function formatDayLabel(day) {
		const [year, month, date] = day.split('-').map((part) => Number.parseInt(part, 10));
		return dayLabelFormatter.format(new Date(year, month - 1, date));
	}

	function getTodayDay() {
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, '0');
		const date = String(now.getDate()).padStart(2, '0');

		return `${year}-${month}-${date}`;
	}

	function shiftDay(day, deltaDays) {
		const [year, month, date] = day.split('-').map((part) => Number.parseInt(part, 10));
		const shifted = new Date(year, month - 1, date + deltaDays);

		return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}-${String(shifted.getDate()).padStart(2, '0')}`;
	}

	async function loadTasks(day = selectedDay) {
		isLoading = true;
		loadError = '';

		try {
			const history = await loadDoneHistory({
				day,
				tzOffsetMinutes: timezoneOffsetMinutes
			});

			tasks = history.tasks;
			availableDays = history.days;
			selectedDay = history.selectedDay || getTodayDay();
		} catch (error) {
			loadError = error.message;
		} finally {
			isLoading = false;
		}
	}

	async function selectDay(day) {
		if (!day || day === selectedDay || isLoading) {
			return;
		}

		await loadTasks(day);
	}

	async function showNewerDay() {
		if (!canGoNewer) {
			return;
		}

		await loadTasks(shiftDay(selectedDay, 1));
	}

	async function showOlderDay() {
		if (!selectedDay) {
			return;
		}

		await loadTasks(shiftDay(selectedDay, -1));
	}

	async function handleSaveNote(taskId, note) {
		const updatedTask = await updateTaskNote(taskId, note);
		tasks = tasks.map((task) =>
			task.taskId === taskId
				? {
						...task,
						note: updatedTask.note
					}
				: task
		);
		return updatedTask;
	}

	const todayDay = $derived(getTodayDay());
	const visibleDays = $derived(
		selectedDay ? [selectedDay, shiftDay(selectedDay, -1), shiftDay(selectedDay, -2)] : []
	);
	const canGoNewer = $derived(selectedDay !== null && selectedDay < todayDay);
	const canGoOlder = $derived(selectedDay !== null);
	const sortedTasks = $derived(
		sortTasks(filterTasks(tasks, searchQuery), { mode: sortMode, variant: 'done' })
	);

	onMount(() => {
		sortMode = loadStoredTaskSort('done');
		timezoneOffsetMinutes = new Date().getTimezoneOffset();
		void loadTasks();

		if (typeof window === 'undefined') {
			return;
		}

		const handleAssistantRefresh = async (event) => {
			if (event.detail?.refresh?.tasks !== true && event.detail?.refresh?.stats !== true) {
				return;
			}

			await loadTasks(selectedDay);
		};

		window.addEventListener(ASSISTANT_REFRESH_EVENT, handleAssistantRefresh);

		return () => {
			window.removeEventListener(ASSISTANT_REFRESH_EVENT, handleAssistantRefresh);
		};
	});
</script>

<svelte:head>
	<title>Done Tasks</title>
	<meta
		name="description"
		content="Recently completed task runs with the time spent on each one."
	/>
</svelte:head>

<section class="board">
	{#if loadError}
		<div class="message-card error-card">
			<strong>Could not load completed tasks</strong>
			<p>{loadError}</p>
		</div>
	{/if}

	{#if selectedDay}
		<nav class="day-pager" aria-label="Completed task days">
			<button
				class="pager-arrow"
				type="button"
				disabled={!canGoNewer || isLoading}
				onclick={showNewerDay}
			>
				&lt;&lt;
			</button>

			<div class="day-pill-row">
				{#each visibleDays as day}
					<button
						class:selected-day={day === selectedDay}
						class="day-pill"
						type="button"
						disabled={isLoading && day !== selectedDay}
						aria-pressed={day === selectedDay}
						onclick={() => selectDay(day)}
					>
						{formatDayLabel(day)}
					</button>
				{/each}
			</div>

			<button
				class="pager-arrow"
				type="button"
				disabled={!canGoOlder || isLoading}
				onclick={showOlderDay}
			>
				&gt;&gt;
			</button>
		</nav>
	{/if}

	{#if isLoading}
		<div class="message-card">
			<strong>Loading completed tasks</strong>
			<p>Pulling your recent done history from the database.</p>
		</div>
	{:else if tasks.length === 0}
		<div class="message-card">
			<strong
				>{selectedDay
					? `Nothing finished on ${formatDayLabel(selectedDay)}`
					: 'No completed tasks yet'}</strong
			>
			<p>
				{selectedDay
					? 'Pick another day in the pager or close a few tasks to start building out the log.'
					: 'Finished task runs will land here once you start closing things out.'}
			</p>
			{#if availableDays.length > 0}
				<p class="history-hint">
					Most recent day with completions: {formatDayLabel(availableDays[0])}
				</p>
			{/if}
		</div>
	{:else}
		<TaskSortBar
			value={sortMode}
			onChange={(nextSortMode) => {
				sortMode = nextSortMode;
				storeTaskSort('done', nextSortMode);
			}}
			searchValue={searchQuery}
			onSearchChange={(nextSearchQuery) => {
				searchQuery = nextSearchQuery;
			}}
		/>

		{#if sortedTasks.length === 0}
			<div class="message-card">
				<strong>No matching tasks</strong>
				<p>Clear search to show this day&apos;s done list.</p>
			</div>
		{:else}
			<div class="task-grid">
				{#each sortedTasks as task}
					<TaskCard
						{task}
						variant="done"
						editableTaskId={task.taskId}
						doneDurationLabel={formatDoneMeasure(task)}
						doneTallyCount={task.tallyCount}
						panicDurationLabel={formatPanicDuration(task)}
						effectiveDurationLabel={formatEffectiveDuration(task)}
						completedAtLabel={formatCompletedAt(task.completedAt)}
						onSaveNote={handleSaveNote}
					/>
				{/each}
			</div>
		{/if}
	{/if}
</section>

<style>
	.board {
		display: grid;
		gap: 1rem;
		padding: 1.4rem 0 2.4rem;
	}

	.day-pager {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.75rem;
	}

	.day-pill-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
	}

	.day-pill,
	.pager-arrow {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 2.9rem;
		padding: 0.75rem 1rem;
		border: 1px solid var(--surface-border);
		border-radius: 999px;
		background: var(--surface-1);
		box-shadow: var(--surface-shadow);
		font-size: 0.8rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		color: var(--color-muted);
		cursor: pointer;
	}

	.day-pill.selected-day {
		background: var(--accent-gradient);
		color: var(--color-accent-contrast);
		box-shadow: 0 14px 28px color-mix(in srgb, var(--color-accent) 28%, transparent);
	}

	.day-pill:disabled,
	.pager-arrow:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.message-card p {
		margin: 0;
		font-size: 1.05rem;
		color: var(--color-muted);
	}

	.history-hint {
		margin-top: 0.35rem;
		font-size: 0.88rem;
		color: var(--color-soft);
	}

	.message-card {
		display: grid;
		gap: 0.4rem;
		padding: 1rem 1.1rem;
		border-radius: 18px;
		background: var(--surface-1);
		border: 1px solid var(--surface-border);
		box-shadow: var(--surface-shadow);
	}

	.message-card strong {
		font-size: 1.15rem;
		letter-spacing: -0.02em;
		color: var(--color-heading);
	}

	.error-card {
		border-color: color-mix(in srgb, var(--color-danger) 22%, var(--surface-border));
		background: color-mix(in srgb, var(--color-danger) 8%, var(--surface-1));
	}

	.task-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
	}

	@media (max-width: 840px) {
		.day-pager {
			grid-template-columns: 1fr;
		}

		.day-pill-row {
			order: 1;
		}

		.task-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
