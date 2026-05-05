<script>
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
		doneTask,
		loadActiveTasks,
		loadDaymapTasks,
		loadInactiveTasks,
		moveTaskToDaymap,
		queueTask,
		unqueueTask,
		unmapTask,
		updateTaskDaymapLock,
		updateTaskDaymapWeekdays,
		updateTaskNote
	} from '$lib/tasks-client';

	let activeTasks = $state([]);
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
			const [nextActiveTasks, nextDaymapTasks, nextInactiveTasks] = await Promise.all([
				loadActiveTasks(),
				loadDaymapTasks(),
				loadInactiveTasks()
			]);

			activeTasks = nextActiveTasks;
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
		activeTasks = activeTasks.map(mergeTask);
	}

	function isScheduledForToday(daymapWeekdays) {
		return Array.isArray(daymapWeekdays) && daymapWeekdays.includes(new Date().getDay());
	}

	function upsertTask(tasks, nextTask) {
		const hasTask = tasks.some((task) => task.id === nextTask.id);

		return hasTask
			? tasks.map((task) => (task.id === nextTask.id ? nextTask : task))
			: [...tasks, nextTask];
	}

	function getQueuePosition(task) {
		return Number.isInteger(task?.queuePosition) && task.queuePosition > 0
			? task.queuePosition
			: null;
	}

	function getNextQueuedDaymapTask() {
		return (
			daymapTasks
				.filter((task) => getQueuePosition(task) !== null)
				.sort((left, right) => {
					const leftQueuePosition = getQueuePosition(left);
					const rightQueuePosition = getQueuePosition(right);

					if (leftQueuePosition !== rightQueuePosition) {
						return leftQueuePosition - rightQueuePosition;
					}

					return (
						new Date(left.mappedAt || left.createdAt).getTime() -
						new Date(right.mappedAt || right.createdAt).getTime()
					);
				})[0] ?? null
		);
	}

	function buildLocalTaskUpdate(currentTask, updatedTask) {
		const daymapWeekdays = updatedTask?.daymapWeekdays ?? currentTask?.daymapWeekdays ?? [];
		const lastStartedAt = updatedTask?.lastStartedAt ?? currentTask?.lastStartedAt ?? null;

		return {
			...currentTask,
			...updatedTask,
			daymapWeekdays,
			scheduledToday: updatedTask?.scheduledToday === true || isScheduledForToday(daymapWeekdays),
			startedToday:
				updatedTask?.startedToday === true ||
				currentTask?.startedToday === true ||
				Boolean(lastStartedAt),
			lastStartedAt
		};
	}

	function activateQueuedTaskLocally(queuedTask, activatedAt) {
		const previousQueuePosition = getQueuePosition(queuedTask);
		const activeTallyCount =
			queuedTask.trackingType === 'tally' && Number.isInteger(queuedTask.activeTallyCount)
				? queuedTask.activeTallyCount
				: 0;
		const activatedTask = {
			...queuedTask,
			activeToday: true,
			activatedAt,
			activeTallyCount,
			queuePosition: null,
			updatedAt: activatedAt
		};

		activeTasks = upsertTask(
			activeTasks.filter((task) => task.id !== queuedTask.id),
			activatedTask
		);
		daymapTasks = daymapTasks
			.filter((task) => task.id !== queuedTask.id)
			.map((task) =>
				previousQueuePosition !== null &&
				getQueuePosition(task) !== null &&
				getQueuePosition(task) > previousQueuePosition
					? {
							...task,
							queuePosition: task.queuePosition - 1
						}
					: task
			);
	}

	function applyTaskBoardMembership(nextTask) {
		if (!nextTask || nextTask.archived === true) {
			activeTasks = activeTasks.filter((task) => task.id !== nextTask?.id);
			daymapTasks = daymapTasks.filter((task) => task.id !== nextTask?.id);
			inactiveTasks = inactiveTasks.filter((task) => task.id !== nextTask?.id);
			return;
		}

		if (nextTask.activeToday === true) {
			activeTasks = upsertTask(
				activeTasks.filter((task) => task.id !== nextTask.id),
				nextTask
			);
			daymapTasks = daymapTasks.filter((task) => task.id !== nextTask.id);
			inactiveTasks = inactiveTasks.filter((task) => task.id !== nextTask.id);
			return;
		}

		activeTasks = activeTasks.filter((task) => task.id !== nextTask.id);

		const shouldShowInDaymap = nextTask.mappedToday === true || nextTask.scheduledToday === true;

		if (shouldShowInDaymap) {
			daymapTasks = upsertTask(
				daymapTasks.filter((task) => task.id !== nextTask.id),
				nextTask
			);
			inactiveTasks = inactiveTasks.filter((task) => task.id !== nextTask.id);
			return;
		}

		daymapTasks = daymapTasks.filter((task) => task.id !== nextTask.id);
		inactiveTasks = upsertTask(
			inactiveTasks.filter((task) => task.id !== nextTask.id),
			nextTask
		);
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

	async function handleActivate(taskId) {
		actionError = '';
		setBusy(taskId, 'activate');

		try {
			const updatedTask = await activateTask(taskId);

			daymapTasks = daymapTasks.filter((task) => task.id !== taskId);
			inactiveTasks = inactiveTasks.filter((task) => task.id !== taskId);
			activeTasks = updatedTask
				? upsertTask(
						activeTasks.filter((task) => task.id !== taskId),
						updatedTask
					)
				: await loadActiveTasks();
		} catch (error) {
			actionError = error.message;
		} finally {
			clearBusy(taskId);
		}
	}

	async function handleDone(taskId) {
		actionError = '';
		setBusy(taskId, 'done');

		try {
			const currentTask = activeTasks.find((task) => task.id === taskId) ?? null;
			const shouldAutoActivateQueuedTask = activeTasks.length < 2;
			const nextQueuedTask = shouldAutoActivateQueuedTask ? getNextQueuedDaymapTask() : null;
			const updatedTask = await doneTask(taskId);
			const nextTask = buildLocalTaskUpdate(currentTask, updatedTask);

			applyTaskBoardMembership(nextTask);

			if (nextQueuedTask) {
				activateQueuedTaskLocally(
					nextQueuedTask,
					updatedTask?.updatedAt ?? updatedTask?.lastCompletedAt ?? new Date().toISOString()
				);
			}
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
			const updatedTask = (await updateTaskDaymapWeekdays(task.id, daymapWeekdays)) ?? {};
			const scheduledToday = isScheduledForToday(daymapWeekdays);
			const nextTask = {
				...task,
				...updatedTask,
				daymapWeekdays,
				scheduledToday,
				startedToday: task.startedToday || updatedTask?.startedToday === true,
				lastStartedAt: updatedTask?.lastStartedAt ?? task.lastStartedAt
			};

			applyTaskBoardMembership(nextTask);
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

	const sortedActiveTasks = $derived(
		sortTasks(filterTasks(activeTasks, searchQuery), { mode: sortMode, variant: 'active' })
	);
	const sortedDaymapTasks = $derived(
		sortTasks(filterTasks(daymapTasks, searchQuery), { mode: sortMode, variant: 'daymap' })
	);
	const sortedInactiveTasks = $derived(
		sortTasks(filterTasks(inactiveTasks, searchQuery), { mode: sortMode, variant: 'inactive' })
	);
	const hasAnyTasks = $derived(activeTasks.length + daymapTasks.length + inactiveTasks.length > 0);
	const hasAnyMatches = $derived(
		sortedActiveTasks.length + sortedDaymapTasks.length + sortedInactiveTasks.length > 0
	);
</script>

<svelte:head>
	<title>Tasks</title>
	<meta
		name="description"
		content="Your active tasks, daymap, and inactive task backlog in one control surface."
	/>
</svelte:head>

<section class="tasks-board app-page">
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
		<div class="page-loader" aria-label="Loading tasks">
			<span class="page-spinner" aria-hidden="true"></span>
		</div>
	{:else}
		<div class="tasks-toolbar">
			<TaskSortBar
				value={sortMode}
				options={DAYMAP_TASK_SORT_OPTIONS}
				onChange={(nextSortMode) => {
					sortMode = nextSortMode;
					storeTaskSort('tasks', nextSortMode, DAYMAP_TASK_SORT_OPTIONS);
				}}
				searchValue={searchQuery}
				searchPlaceholder="Search board"
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
				<p>Clear search to show the full board.</p>
			</div>
		{/if}

		{#if activeTasks.length > 0}
			<section class="task-section task-section-active" aria-labelledby="tasks-active-heading">
				<div class="section-divider section-divider--primary">
					<span></span>
					<h2 id="tasks-active-heading">Active</h2>
					<span></span>
				</div>

				{#if sortedActiveTasks.length === 0}
					<div class="section-empty">
						<p>No active matches.</p>
					</div>
				{:else}
					<div class="task-grid">
						{#each sortedActiveTasks as task}
							<TaskCard
								{task}
								variant="board-active"
								editableTaskId={task.id}
								compact={true}
								showDoneButton={true}
								showScheduleControls={true}
								showNextDueTiming={false}
								lastDonePlacement="schedule"
								busyAction={busyTasks[task.id] || null}
								onDone={handleDone}
								onScheduleChange={handleScheduleChange}
								onSaveNote={handleSaveNote}
							/>
						{/each}
					</div>
				{/if}
			</section>
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
							showNextDueTiming={false}
							lastDonePlacement="schedule"
							busyAction={busyTasks[task.id] || null}
							onDaymapToggle={() => handleMoveToInactive(task.id)}
							onActivate={() => handleActivate(task.id)}
							onToggleDaymapLock={handleDaymapLockToggle}
							onQueueToggle={handleQueueToggle}
							onScheduleChange={handleScheduleChange}
							onSaveNote={handleSaveNote}
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
							showNextDueTiming={false}
							lastDonePlacement="schedule"
							busyAction={busyTasks[task.id] || null}
							showArchiveButton={true}
							onDaymapToggle={() => handleMoveToDaymap(task.id)}
							onActivate={() => handleActivate(task.id)}
							onArchive={handleArchive}
							onScheduleChange={handleScheduleChange}
							onSaveNote={handleSaveNote}
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
	}

	.tasks-toolbar {
		display: flex;
		align-items: end;
		justify-content: flex-end;
		gap: 1rem;
		padding: 0.2rem 0 0.1rem;
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
		.tasks-toolbar {
			align-items: stretch;
			gap: 0.75rem;
		}

		.task-grid {
			grid-template-columns: 1fr;
			gap: 0.75rem;
		}
	}

	@media (max-width: 520px) {
		.tasks-toolbar {
			display: grid;
		}
	}
</style>
