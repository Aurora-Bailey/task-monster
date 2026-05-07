<script>
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';

	import { ASSISTANT_REFRESH_EVENT } from '$lib/assistant-client';
	import PageContentReveal from '$lib/PageContentReveal.svelte';
	import TaskCard from '$lib/TaskCard.svelte';
	import { formatElapsedDuration, formatTallyCount } from '$lib/task-format';
	import TaskSortBar from '$lib/TaskSortBar.svelte';
	import {
		TASK_SORT_OPTIONS,
		filterTasks,
		loadStoredTaskSort,
		sortTasks,
		storeTaskSort
	} from '$lib/task-sort';
	import {
		loadActiveTasks,
		loadDaymapTasks,
		loadDoneFeed,
		loadInactiveTasks,
		updateTaskNextDue,
		updateTaskNote
	} from '$lib/tasks-client';

	const DONE_BATCH_SIZE = 10;
	const DONE_DEFAULT_SORT_MODE = 'date';

	const completedAtFormatter = new Intl.DateTimeFormat(undefined, {
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
	});

	let tasks = $state([]);
	let nextCursor = $state(null);
	let hasMore = $state(true);
	let isLoadingInitial = $state(true);
	let isLoadingMore = $state(false);
	let loadError = $state('');
	let timezoneOffsetMinutes = 0;
	let sortMode = $state(DONE_DEFAULT_SORT_MODE);
	let searchQuery = $state('');
	let sentinel = $state(null);
	let hasAnyBoardTasks = $state(true);

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

	async function loadBoardPresence() {
		try {
			const [activeTasks, daymapTasks, inactiveTasks] = await Promise.all([
				loadActiveTasks(),
				loadDaymapTasks(),
				loadInactiveTasks()
			]);

			return activeTasks.length + daymapTasks.length + inactiveTasks.length > 0;
		} catch (error) {
			console.error(error);
			return true;
		}
	}

	async function loadNextBatch({ reset = false } = {}) {
		if (isLoadingMore || (isLoadingInitial && !reset) || (!reset && !hasMore)) {
			return;
		}

		if (reset) {
			isLoadingInitial = true;
			loadError = '';
		} else {
			isLoadingMore = true;
		}

		try {
			const historyPromise = loadDoneFeed({
				limit: DONE_BATCH_SIZE,
				cursor: reset ? null : nextCursor,
				tzOffsetMinutes: timezoneOffsetMinutes
			});
			const boardPresencePromise = reset ? loadBoardPresence() : Promise.resolve(hasAnyBoardTasks);
			const [history, nextHasAnyBoardTasks] = await Promise.all([
				historyPromise,
				boardPresencePromise
			]);

			tasks = reset ? history.tasks : [...tasks, ...history.tasks];
			nextCursor = history.nextCursor;
			hasMore = history.hasMore;
			hasAnyBoardTasks = nextHasAnyBoardTasks;
		} catch (error) {
			loadError = error.message;
		} finally {
			isLoadingInitial = false;
			isLoadingMore = false;
		}
	}

	async function reloadTasks() {
		tasks = [];
		nextCursor = null;
		hasMore = true;
		await loadNextBatch({ reset: true });
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

	async function handleSaveNextDue(taskId, nextDueAt) {
		const updatedTask = await updateTaskNextDue(taskId, nextDueAt);
		tasks = tasks.map((task) =>
			task.taskId === taskId
				? {
						...task,
						nextDueAt: updatedTask.nextDueAt
					}
				: task
		);
		return updatedTask;
	}

	const sortedTasks = $derived(
		sortTasks(filterTasks(tasks, searchQuery), { mode: sortMode, variant: 'done' })
	);

	$effect(() => {
		if (!sentinel || typeof IntersectionObserver === 'undefined') {
			return;
		}

		const sentinelObserver = new IntersectionObserver(
			(entries) => {
				const [entry] = entries;

				if (entry?.isIntersecting) {
					void loadNextBatch();
				}
			},
			{
				rootMargin: '700px 0px'
			}
		);

		sentinelObserver.observe(sentinel);

		return () => {
			sentinelObserver.disconnect();
		};
	});

	onMount(() => {
		sortMode = loadStoredTaskSort('done-feed', TASK_SORT_OPTIONS, DONE_DEFAULT_SORT_MODE);
		timezoneOffsetMinutes = new Date().getTimezoneOffset();
		void loadNextBatch({ reset: true });

		if (typeof window === 'undefined') {
			return;
		}

		const handleAssistantRefresh = async (event) => {
			if (event.detail?.refresh?.tasks !== true && event.detail?.refresh?.stats !== true) {
				return;
			}

			await reloadTasks();
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

<section class="board app-page">
	{#if loadError}
		<div class="message-card error-card">
			<strong>Could not load completed tasks</strong>
			<p>{loadError}</p>
		</div>
	{/if}

	{#if isLoadingInitial}
		<div class="page-loader" aria-label="Loading completed tasks">
			<span class="page-spinner" aria-hidden="true"></span>
		</div>
	{:else if tasks.length === 0}
		<PageContentReveal>
			<p class="machine-inscription">
				<span>
					{#if hasAnyBoardTasks}
						No completed runs etched yet. <a href={resolve('/tasks')}>Stage a task</a>.
					{:else}
						No tasks installed. <a href={resolve('/add')}>Add the first task</a>.
					{/if}
				</span>
			</p>
		</PageContentReveal>
	{:else}
		<PageContentReveal className="page-content-stack">
			<TaskSortBar
				value={sortMode}
				onChange={(nextSortMode) => {
					sortMode = nextSortMode;
					storeTaskSort('done-feed', nextSortMode);
				}}
				searchValue={searchQuery}
				onSearchChange={(nextSearchQuery) => {
					searchQuery = nextSearchQuery;
				}}
			/>

			<div class="section-divider section-divider--primary">
				<span></span>
				<h1>Done</h1>
				<span></span>
			</div>

			{#if sortedTasks.length === 0}
				<div class="message-card">
					<strong>No matching tasks</strong>
					<p>Clear search to show the loaded done history.</p>
				</div>
			{:else}
				<div class="task-grid">
					{#each sortedTasks as task (task.id)}
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
							onSaveNextDue={handleSaveNextDue}
						/>
					{/each}
				</div>
			{/if}

			<div class="load-sentinel" bind:this={sentinel}>
				{#if isLoadingMore}
					<span class="page-spinner page-spinner--small" aria-label="Loading older done tasks"
					></span>
				{:else if hasMore}
					<span>Scroll for older done tasks</span>
				{:else}
					<span>End of done history</span>
				{/if}
			</div>
		</PageContentReveal>
	{/if}
</section>

<style>
	.board {
		display: grid;
		gap: 1rem;
	}

	.message-card p {
		margin: 0;
		font-size: 1.05rem;
		color: var(--color-muted);
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

	.load-sentinel {
		min-height: 4rem;
		display: grid;
		place-items: center;
		font-size: 0.8rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-muted);
	}

	@media (max-width: 840px) {
		.task-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
