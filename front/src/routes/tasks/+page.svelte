<script>
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';

	import { ASSISTANT_REFRESH_EVENT } from '$lib/assistant-client';
	import TaskCard from '$lib/TaskCard.svelte';
	import TaskSortBar from '$lib/TaskSortBar.svelte';
	import {
		DAYMAP_TASK_SORT_OPTIONS,
		DEFAULT_TASK_SORT_MODE,
		filterTasks,
		loadStoredTaskSort,
		sortTasks,
		storeTaskSort
	} from '$lib/task-sort';
	import {
		activateTask,
		archiveTask,
		loadDaymapTasks,
		loadInactiveTasks,
		moveTaskToDaymap,
		queueTask,
		unqueueTask,
		unmapTask,
		updateTaskDaymapLock,
		updateTaskDaymapWeekdays,
		updateTaskNextDue,
		updateTaskNote
	} from '$lib/tasks-client';

	let daymapTasks = $state([]);
	let inactiveTasks = $state([]);
	let isLoading = $state(true);
	let loadError = $state('');
	let actionError = $state('');
	let busyTasks = $state({});
	let sortMode = $state(DEFAULT_TASK_SORT_MODE);
	let searchQuery = $state('');

	function setBusy(taskId, action) {
		busyTasks = {
			...busyTasks,
			[taskId]: action
		};
	}

	function clearBusy(taskId) {
		const nextBusyTasks = { ...busyTasks };
		delete nextBusyTasks[taskId];
		busyTasks = nextBusyTasks;
	}

	async function loadTasks() {
		isLoading = true;
		loadError = '';

		try {
			const [nextDaymapTasks, nextInactiveTasks] = await Promise.all([
				loadDaymapTasks(),
				loadInactiveTasks()
			]);

			daymapTasks = nextDaymapTasks;
			inactiveTasks = nextInactiveTasks;
		} catch (error) {
			loadError = error.message;
		} finally {
			isLoading = false;
		}
	}

	function replaceTask(taskId, updatedTask) {
		if (!updatedTask) {
			return;
		}

		const mergeTask = (task) =>
			task.id === taskId
				? {
						...task,
						...updatedTask,
						scheduledToday: updatedTask.scheduledToday || task.scheduledToday,
						startedToday: updatedTask.startedToday || task.startedToday,
						lastStartedAt: updatedTask.lastStartedAt ?? task.lastStartedAt
					}
				: task;

		daymapTasks = daymapTasks.map(mergeTask);
		inactiveTasks = inactiveTasks.map(mergeTask);
	}

	async function handleMoveToDaymap(taskId) {
		actionError = '';
		setBusy(taskId, 'daymap');

		try {
			const updatedTask = await moveTaskToDaymap(taskId);
			inactiveTasks = inactiveTasks.filter((task) => task.id !== taskId);
			daymapTasks = updatedTask ? [...daymapTasks, updatedTask] : await loadDaymapTasks();
		} catch (error) {
			actionError = error.message;
		} finally {
			clearBusy(taskId);
		}
	}

	async function handleMoveToInactive(taskId) {
		actionError = '';
		setBusy(taskId, 'unmap');

		try {
			const updatedTask = await unmapTask(taskId);
			daymapTasks = daymapTasks.filter((task) => task.id !== taskId);
			inactiveTasks = updatedTask ? [...inactiveTasks, updatedTask] : await loadInactiveTasks();
		} catch (error) {
			actionError = error.message;
		} finally {
			clearBusy(taskId);
		}
	}

	async function handleActivate(taskId, source) {
		actionError = '';
		setBusy(taskId, 'activate');

		try {
			await activateTask(taskId);

			if (source === 'inactive') {
				inactiveTasks = inactiveTasks.filter((task) => task.id !== taskId);
			} else {
				daymapTasks = daymapTasks.filter((task) => task.id !== taskId);
			}

			await goto(resolve('/active'));
		} catch (error) {
			actionError = error.message;
		} finally {
			clearBusy(taskId);
		}
	}

	async function handleArchive(taskId) {
		if (
			typeof window !== 'undefined' &&
			!window.confirm(
				'Archive this task? It will no longer be visible until an archive page exists.'
			)
		) {
			return;
		}

		actionError = '';
		setBusy(taskId, 'archive');

		try {
			await archiveTask(taskId);
			inactiveTasks = inactiveTasks.filter((task) => task.id !== taskId);
		} catch (error) {
			actionError = error.message;
		} finally {
			clearBusy(taskId);
		}
	}

	async function handleQueueToggle(task) {
		actionError = '';
		setBusy(task.id, task.queuePosition ? 'unqueue' : 'queue');

		try {
			if (task.queuePosition) {
				await unqueueTask(task.id);
			} else {
				await queueTask(task.id);
			}

			daymapTasks = await loadDaymapTasks();
		} catch (error) {
			actionError = error.message;
		} finally {
			clearBusy(task.id);
		}
	}

	async function handleDaymapLockToggle(task) {
		actionError = '';
		setBusy(task.id, task.daymapLocked ? 'unlock' : 'lock');

		try {
			const updatedTask = await updateTaskDaymapLock(task.id, !task.daymapLocked);
			replaceTask(task.id, updatedTask);
		} catch (error) {
			actionError = error.message;
		} finally {
			clearBusy(task.id);
		}
	}

	async function handleScheduleChange(task, daymapWeekdays) {
		actionError = '';
		setBusy(task.id, 'schedule');

		try {
			await updateTaskDaymapWeekdays(task.id, daymapWeekdays);
			await loadTasks();
		} catch (error) {
			actionError = error.message;
		} finally {
			clearBusy(task.id);
		}
	}

	async function handleSaveNote(taskId, note) {
		const updatedTask = await updateTaskNote(taskId, note);
		replaceTask(taskId, updatedTask);
		return updatedTask;
	}

	async function handleSaveNextDue(taskId, nextDueAt) {
		const updatedTask = await updateTaskNextDue(taskId, nextDueAt);
		replaceTask(taskId, updatedTask);
		return updatedTask;
	}

	onMount(() => {
		sortMode = loadStoredTaskSort('tasks', DAYMAP_TASK_SORT_OPTIONS);
		void loadTasks();

		if (typeof window === 'undefined') {
			return;
		}

		const handleAssistantRefresh = async (event) => {
			if (event.detail?.refresh?.tasks !== true) {
				return;
			}

			await loadTasks();
		};

		window.addEventListener(ASSISTANT_REFRESH_EVENT, handleAssistantRefresh);

		return () => {
			window.removeEventListener(ASSISTANT_REFRESH_EVENT, handleAssistantRefresh);
		};
	});

	const sortedDaymapTasks = $derived(
		sortTasks(filterTasks(daymapTasks, searchQuery), { mode: sortMode, variant: 'daymap' })
	);
	const sortedInactiveTasks = $derived(
		sortTasks(filterTasks(inactiveTasks, searchQuery), { mode: sortMode, variant: 'inactive' })
	);
	const hasAnyTasks = $derived(daymapTasks.length + inactiveTasks.length > 0);
	const hasAnyMatches = $derived(sortedDaymapTasks.length + sortedInactiveTasks.length > 0);
</script>

<svelte:head>
	<title>Tasks</title>
	<meta
		name="description"
		content="Your daymap and inactive task backlog in one control surface."
	/>
</svelte:head>

<section class="tasks-board">
	{#if loadError}
		<div class="message-card error-card">
			<strong>Could not load tasks</strong>
			<p>{loadError}</p>
		</div>
	{/if}

	{#if actionError}
		<div class="message-card error-card">
			<strong>Could not update that task</strong>
			<p>{actionError}</p>
		</div>
	{/if}

	{#if isLoading}
		<div class="message-card">
			<strong>Loading tasks</strong>
			<p>Pulling today&apos;s map and the inactive backlog into one board.</p>
		</div>
	{:else}
		<div class="tasks-toolbar">
			<div>
				<p class="tasks-kicker">Tasks</p>
				<h1>Daymap and backlog</h1>
			</div>

			<TaskSortBar
				value={sortMode}
				options={DAYMAP_TASK_SORT_OPTIONS}
				onChange={(nextSortMode) => {
					sortMode = nextSortMode;
					storeTaskSort('tasks', nextSortMode, DAYMAP_TASK_SORT_OPTIONS);
				}}
				searchValue={searchQuery}
				searchPlaceholder="Search both sections"
				onSearchChange={(nextSearchQuery) => {
					searchQuery = nextSearchQuery;
				}}
			/>
		</div>

		{#if !hasAnyTasks}
			<div class="message-card">
				<strong>No task backlog</strong>
				<p>Add a task when you want something ready to stage, start, or save for later.</p>
			</div>
		{:else if !hasAnyMatches}
			<div class="message-card">
				<strong>No matching tasks</strong>
				<p>Clear search to show both the daymap and inactive backlog.</p>
			</div>
		{/if}

		<section class="task-section" aria-labelledby="tasks-daymap-heading">
			<div class="section-divider">
				<span></span>
				<h2 id="tasks-daymap-heading">Day Map</h2>
				<span></span>
			</div>

			{#if sortedDaymapTasks.length === 0}
				<div class="section-empty">
					<p>{searchQuery ? 'No daymap matches.' : 'No tasks on the daymap yet.'}</p>
				</div>
			{:else}
				<div class="task-grid">
					{#each sortedDaymapTasks as task}
						<TaskCard
							{task}
							variant="daymap"
							editableTaskId={task.id}
							compact={true}
							showDaymapToggle={true}
							showActivateButton={true}
							showScheduleControls={true}
							busyAction={busyTasks[task.id] || null}
							onDaymapToggle={() => handleMoveToInactive(task.id)}
							onActivate={() => handleActivate(task.id, 'daymap')}
							onToggleDaymapLock={handleDaymapLockToggle}
							onQueueToggle={handleQueueToggle}
							onScheduleChange={handleScheduleChange}
							onSaveNote={handleSaveNote}
							onSaveNextDue={handleSaveNextDue}
						/>
					{/each}
				</div>
			{/if}
		</section>

		<section class="task-section" aria-labelledby="tasks-inactive-heading">
			<div class="section-divider">
				<span></span>
				<h2 id="tasks-inactive-heading">Inactive</h2>
				<span></span>
			</div>

			{#if sortedInactiveTasks.length === 0}
				<div class="section-empty">
					<p>{searchQuery ? 'No inactive matches.' : 'No inactive tasks waiting in reserve.'}</p>
				</div>
			{:else}
				<div class="task-grid">
					{#each sortedInactiveTasks as task}
						<TaskCard
							{task}
							editableTaskId={task.id}
							compact={true}
							showDaymapToggle={true}
							showActivateButton={true}
							showScheduleControls={true}
							busyAction={busyTasks[task.id] || null}
							showArchiveButton={true}
							onDaymapToggle={() => handleMoveToDaymap(task.id)}
							onActivate={() => handleActivate(task.id, 'inactive')}
							onArchive={handleArchive}
							onScheduleChange={handleScheduleChange}
							onSaveNote={handleSaveNote}
							onSaveNextDue={handleSaveNextDue}
						/>
					{/each}
				</div>
			{/if}
		</section>
	{/if}
</section>

<style>
	.tasks-board {
		display: grid;
		gap: 1rem;
		padding: 1.1rem 0 2.6rem;
	}

	.tasks-toolbar {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.2rem 0 0.1rem;
	}

	.tasks-kicker {
		margin: 0 0 0.16rem;
		font-size: 0.7rem;
		font-weight: 900;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--color-theme-2);
	}

	h1 {
		margin: 0;
		font-size: clamp(1.35rem, 3vw, 2rem);
		line-height: 1;
		color: var(--color-heading);
	}

	.message-card,
	.section-empty {
		display: grid;
		gap: 0.4rem;
		padding: 0.95rem 1rem;
		border-radius: 18px;
		background: var(--surface-1);
		border: 1px solid var(--surface-border);
		box-shadow: var(--surface-shadow);
	}

	.message-card strong {
		font-size: 1.05rem;
		letter-spacing: -0.02em;
		color: var(--color-heading);
	}

	.message-card p,
	.section-empty p {
		margin: 0;
		font-size: 0.95rem;
		color: var(--color-muted);
	}

	.error-card {
		border-color: color-mix(in srgb, var(--color-danger) 22%, var(--surface-border));
		background: color-mix(in srgb, var(--color-danger) 8%, var(--surface-1));
	}

	.task-section {
		display: grid;
		gap: 0.9rem;
	}

	.section-divider {
		display: grid;
		grid-template-columns: minmax(1rem, 1fr) auto minmax(1rem, 1fr);
		align-items: center;
		gap: 0.75rem;
		margin-top: 0.4rem;
		color: var(--color-theme-2);
	}

	.section-divider span {
		height: 1px;
		background: linear-gradient(
			90deg,
			transparent,
			color-mix(in srgb, var(--color-theme-2) 52%, var(--surface-border)),
			transparent
		);
	}

	.section-divider h2 {
		margin: 0;
		font-size: 0.72rem;
		font-weight: 900;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--color-theme-2) 82%, var(--color-heading));
	}

	.task-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.85rem;
	}

	@media (max-width: 1080px) {
		.task-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 720px) {
		.tasks-board {
			padding-top: 0.7rem;
		}

		.tasks-toolbar {
			align-items: stretch;
			gap: 0.75rem;
		}

		.task-grid {
			grid-template-columns: 1fr;
			gap: 0.75rem;
		}

		.section-divider {
			gap: 0.55rem;
		}
	}

	@media (max-width: 520px) {
		.tasks-toolbar {
			display: grid;
		}
	}
</style>
