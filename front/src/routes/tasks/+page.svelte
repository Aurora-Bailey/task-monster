<script>
	import { goto, replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';

	import { APP_REFRESH_EVENT } from '$lib/app-events';
	import PageContentReveal from '$lib/PageContentReveal.svelte';
	import { buildTasksHref } from '$lib/routing';
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
		cancelActiveTask,
		doneTask,
		loadActiveTasks,
		loadDaymapTasks,
		loadInactiveTasks,
		loadTask,
		queueTask,
		unqueueTask,
		updateTaskDaymapPin,
		updateTaskDaySkip,
		updateTaskDaymapWeekdays,
		updateTaskHueShift,
		updateTaskInstanceNote,
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
	let resolvedExactTask = $state(null);
	let resolvedExactTaskId = $state('');
	let resolvingExactTaskId = $state('');
	let exactFilterStatus = $state('idle');
	let exactFilterError = $state('');
	let exactResolveRevision = 0;
	const exactTaskId = $derived(page.url.searchParams.get('task')?.trim() || '');
	const textSearchQuery = $derived(exactTaskId ? '' : page.url.searchParams.get('search') || '');
	const allBoardTasks = $derived([...activeTasks, ...daymapTasks, ...inactiveTasks]);
	const exactBoardTask = $derived(
		exactTaskId ? (allBoardTasks.find((task) => task.id === exactTaskId) ?? null) : null
	);
	const taskFilterSearchValue = $derived(
		exactTaskId
			? exactBoardTask?.name ||
					(resolvedExactTaskId === exactTaskId ? resolvedExactTask?.name : '') ||
					exactTaskId
			: textSearchQuery
	);
	const isExactTaskFilter = $derived(Boolean(exactTaskId));

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

	async function resolveExactTask(taskId) {
		const revision = ++exactResolveRevision;
		resolvingExactTaskId = taskId;
		exactFilterStatus = 'loading';
		exactFilterError = '';

		try {
			const task = await loadTask(taskId);

			if (revision !== exactResolveRevision || taskId !== exactTaskId) {
				return;
			}

			resolvedExactTask = task;
			resolvedExactTaskId = taskId;
			exactFilterStatus = 'unavailable';
		} catch (error) {
			if (revision !== exactResolveRevision || taskId !== exactTaskId) {
				return;
			}

			resolvedExactTask = null;
			resolvedExactTaskId = taskId;

			if (error?.status === 400 || error?.status === 404) {
				exactFilterStatus = 'not-found';
				exactFilterError = '';
			} else {
				exactFilterStatus = 'error';
				exactFilterError = error instanceof Error ? error.message : 'Unable to load that task.';
			}
		} finally {
			if (revision === exactResolveRevision && resolvingExactTaskId === taskId) {
				resolvingExactTaskId = '';
			}
		}
	}

	function filterBoardTasks(tasks) {
		if (exactTaskId) {
			return tasks.filter((task) => task.id === exactTaskId);
		}

		return filterTasks(tasks, textSearchQuery);
	}

	function handleSearchChange(nextSearchQuery) {
		replaceState(
			buildTasksHref({
				search: nextSearchQuery
			}),
			{}
		);
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
						skippedToday: updatedTask.skippedToday || task.skippedToday,
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
				.filter((task) => getQueuePosition(task) !== null && task.skippedToday !== true)
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
			skippedToday: updatedTask?.skippedToday === true || currentTask?.skippedToday === true,
			lastStartedAt
		};
	}

	function isTaskDaymapPinned(task) {
		return task?.mappedToday === true || task?.daymapLocked === true;
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

	async function handleCancelActive(taskId) {
		actionError = '';
		setBusy(taskId, 'cancel');

		try {
			const updatedTask = await cancelActiveTask(taskId);

			if (updatedTask) {
				applyTaskBoardMembership(updatedTask);
				return;
			}

			const [nextActiveTasks, nextDaymapTasks] = await Promise.all([
				loadActiveTasks(),
				loadDaymapTasks()
			]);

			activeTasks = nextActiveTasks;
			daymapTasks = nextDaymapTasks;
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

	async function handleEdit(taskId) {
		await goto(`${resolve('/add')}?edit=${encodeURIComponent(taskId)}`);
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

	async function handleDaymapPinToggle(task) {
		actionError = '';
		const nextPinned = !isTaskDaymapPinned(task);
		setBusy(task.id, nextPinned ? 'daymap' : 'unmap');

		try {
			const updatedTask = await updateTaskDaymapPin(task.id, nextPinned);
			const nextTask = buildLocalTaskUpdate(task, updatedTask);

			applyTaskBoardMembership(nextTask);
		} catch (error) {
			actionError = error.message;
		} finally {
			clearBusy(task.id);
		}
	}

	async function handleDaySkipToggle(task) {
		actionError = '';
		const nextSkipped = task.skippedToday !== true;
		setBusy(task.id, nextSkipped ? 'skip' : 'unskip');

		try {
			await updateTaskDaySkip(task.id, nextSkipped);
			daymapTasks = await loadDaymapTasks();
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
				skippedToday: task.skippedToday || updatedTask?.skippedToday === true,
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
		replaceTask(taskId, {
			note: updatedTask?.note ?? null
		});
		return updatedTask;
	}

	async function handleSaveInstanceNote(taskId, instanceNote) {
		const updatedTask = await updateTaskInstanceNote(taskId, instanceNote);
		replaceTask(taskId, {
			instanceNote: updatedTask?.instanceNote ?? null
		});
		return updatedTask;
	}

	async function handleHueShiftChange(taskId, hueShift) {
		actionError = '';

		try {
			const updatedTask = await updateTaskHueShift(taskId, hueShift);
			replaceTask(taskId, {
				hueShift: updatedTask?.hueShift
			});
			return updatedTask;
		} catch (error) {
			actionError = error.message;
			throw error;
		}
	}

	$effect(() => {
		const taskId = exactTaskId;
		const boardTask = exactBoardTask;

		if (!taskId) {
			exactResolveRevision += 1;
			resolvedExactTask = null;
			resolvedExactTaskId = '';
			resolvingExactTaskId = '';
			exactFilterStatus = 'idle';
			exactFilterError = '';
			return;
		}

		if (isLoading) {
			exactFilterStatus = 'loading';
			return;
		}

		if (loadError) {
			exactFilterStatus = 'error';
			exactFilterError = loadError;
			return;
		}

		if (boardTask) {
			exactResolveRevision += 1;
			resolvedExactTask = boardTask;
			resolvedExactTaskId = taskId;
			resolvingExactTaskId = '';
			exactFilterStatus = 'available';
			exactFilterError = '';
			return;
		}

		if (resolvingExactTaskId === taskId) {
			return;
		}

		if (
			resolvedExactTaskId === taskId &&
			['unavailable', 'not-found', 'error'].includes(exactFilterStatus)
		) {
			return;
		}

		void resolveExactTask(taskId);
	});

	onMount(() => {
		sortMode = loadStoredTaskSort('tasks', DAYMAP_TASK_SORT_OPTIONS);
		void loadTasks();

		if (typeof window === 'undefined') {
			return;
		}

		const handleAppRefresh = async (event) => {
			if (event.detail?.refresh?.tasks !== true) {
				return;
			}

			await loadTasks();
		};

		window.addEventListener(APP_REFRESH_EVENT, handleAppRefresh);

		return () => {
			window.removeEventListener(APP_REFRESH_EVENT, handleAppRefresh);
		};
	});

	const sortedActiveTasks = $derived(
		sortTasks(filterBoardTasks(activeTasks), { mode: sortMode, variant: 'active' })
	);
	const sortedDaymapTasks = $derived(
		sortTasks(filterBoardTasks(daymapTasks), { mode: sortMode, variant: 'daymap' })
	);
	const sortedInactiveTasks = $derived(
		sortTasks(filterBoardTasks(inactiveTasks), { mode: sortMode, variant: 'inactive' })
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
		<PageContentReveal className="page-content-stack">
			<div class="tasks-toolbar">
				<TaskSortBar
					value={sortMode}
					options={DAYMAP_TASK_SORT_OPTIONS}
					onChange={(nextSortMode) => {
						sortMode = nextSortMode;
						storeTaskSort('tasks', nextSortMode, DAYMAP_TASK_SORT_OPTIONS);
					}}
					searchValue={taskFilterSearchValue}
					searchPlaceholder="Search board"
					onSearchChange={handleSearchChange}
				/>
			</div>

			{#if isExactTaskFilter && !hasAnyMatches}
				<div class="message-card">
					{#if exactFilterStatus === 'loading' || exactFilterStatus === 'idle'}
						<strong>Finding task</strong>
						<p>Checking where this task lives on the board.</p>
					{:else if exactFilterStatus === 'unavailable'}
						<strong>Task unavailable on board</strong>
						<p>
							{resolvedExactTask?.name
								? `${resolvedExactTask.name} is archived or otherwise unavailable on Tasks.`
								: 'This task is archived or otherwise unavailable on Tasks.'}
							Clear the search to return to the full board.
						</p>
					{:else if exactFilterStatus === 'not-found'}
						<strong>Task not found</strong>
						<p>No task exists for this link. Clear the search to return to the full board.</p>
					{:else}
						<strong>Could not load linked task</strong>
						<p>{exactFilterError || 'Unable to resolve this task right now.'}</p>
					{/if}
				</div>
			{:else if !hasAnyTasks}
				<p class="machine-inscription">
					<span>No task backlog installed. <a href={resolve('/add')}>Add the first task</a>.</span>
				</p>
			{:else if !hasAnyMatches}
				<div class="message-card">
					<strong>No matching tasks</strong>
					<p>Clear search to show the full board.</p>
				</div>
			{/if}

			{#if (isExactTaskFilter && sortedActiveTasks.length > 0) || (!isExactTaskFilter && activeTasks.length > 0)}
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
									showCancelButton={true}
									showDoneButton={true}
									showScheduleControls={true}
									showHueShiftControl={true}
									showNextDueTiming={false}
									lastDonePlacement="schedule"
									busyAction={busyTasks[task.id] || null}
									onInactivate={handleCancelActive}
									onDone={handleDone}
									onScheduleChange={handleScheduleChange}
									onHueShiftChange={handleHueShiftChange}
									onSaveInstanceNote={handleSaveInstanceNote}
									onSaveNote={handleSaveNote}
								/>
							{/each}
						</div>
					{/if}
				</section>
			{/if}

			{#if !isExactTaskFilter || sortedDaymapTasks.length > 0}
				<section class="task-section" aria-labelledby="tasks-daymap-heading">
					<div class="section-divider">
						<span></span>
						<h2 id="tasks-daymap-heading">Day Map</h2>
						<span></span>
					</div>

					{#if sortedDaymapTasks.length === 0}
						<div class="section-empty">
							<p>{textSearchQuery ? 'No daymap matches.' : 'No tasks on the daymap yet.'}</p>
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
									showSkipButton={true}
									showActivateButton={true}
									showScheduleControls={true}
									showHueShiftControl={true}
									showNextDueTiming={false}
									lastDonePlacement="schedule"
									busyAction={busyTasks[task.id] || null}
									onDaymapToggle={handleDaymapPinToggle}
									onActivate={() => handleActivate(task.id)}
									onSkipDay={handleDaySkipToggle}
									onQueueToggle={handleQueueToggle}
									onScheduleChange={handleScheduleChange}
									onHueShiftChange={handleHueShiftChange}
									onSaveNote={handleSaveNote}
								/>
							{/each}
						</div>
					{/if}
				</section>
			{/if}

			{#if !isExactTaskFilter || sortedInactiveTasks.length > 0}
				<section class="task-section" aria-labelledby="tasks-inactive-heading">
					<div class="section-divider">
						<span></span>
						<h2 id="tasks-inactive-heading">Inactive</h2>
						<span></span>
					</div>

					{#if sortedInactiveTasks.length === 0}
						<div class="section-empty">
							<p>
								{textSearchQuery ? 'No inactive matches.' : 'No inactive tasks waiting in reserve.'}
							</p>
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
									showHueShiftControl={true}
									showEditButton={true}
									showNextDueTiming={false}
									lastDonePlacement="schedule"
									busyAction={busyTasks[task.id] || null}
									showArchiveButton={true}
									onDaymapToggle={handleDaymapPinToggle}
									onActivate={() => handleActivate(task.id)}
									onEdit={handleEdit}
									onArchive={handleArchive}
									onScheduleChange={handleScheduleChange}
									onHueShiftChange={handleHueShiftChange}
									onSaveNote={handleSaveNote}
								/>
							{/each}
						</div>
					{/if}
				</section>
			{/if}
		</PageContentReveal>
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
