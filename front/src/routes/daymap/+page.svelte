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
		loadDaymapTasks,
		queueTask,
		updateTaskDaymapLock,
		updateTaskNextDue,
		unqueueTask,
		unmapTask,
		updateTaskNote
	} from '$lib/tasks-client';

	let tasks = $state([]);
	let isLoading = $state(true);
	let loadError = $state('');
	let actionError = $state('');
	let busyTasks = $state({});
	let sortMode = $state(DEFAULT_TASK_SORT_MODE);
	let searchQuery = $state('');

	async function loadTasks() {
		isLoading = true;
		loadError = '';

		try {
			tasks = await loadDaymapTasks();
		} catch (error) {
			loadError = error.message;
		} finally {
			isLoading = false;
		}
	}

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

	async function handleActivate(taskId) {
		actionError = '';
		setBusy(taskId, 'activate');

		try {
			await activateTask(taskId);
			await goto(resolve('/active'));
		} catch (error) {
			actionError = error.message;
		} finally {
			clearBusy(taskId);
		}
	}

	async function handleUnmap(taskId) {
		actionError = '';
		setBusy(taskId, 'unmap');

		try {
			await unmapTask(taskId);
			await goto(resolve('/inactive'));
		} catch (error) {
			actionError = error.message;
		} finally {
			clearBusy(taskId);
		}
	}

	async function handleSaveNote(taskId, note) {
		const updatedTask = await updateTaskNote(taskId, note);
		tasks = tasks.map((task) => (task.id === taskId ? updatedTask : task));
		return updatedTask;
	}

	async function handleSaveNextDue(taskId, nextDueAt) {
		const updatedTask = await updateTaskNextDue(taskId, nextDueAt);
		tasks = tasks.map((task) => (task.id === taskId ? updatedTask : task));
		return updatedTask;
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

			tasks = await loadDaymapTasks();
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
			tasks = tasks.map((currentTask) => (currentTask.id === task.id ? updatedTask : currentTask));
		} catch (error) {
			actionError = error.message;
		} finally {
			clearBusy(task.id);
		}
	}

	onMount(() => {
		sortMode = loadStoredTaskSort('daymap', DAYMAP_TASK_SORT_OPTIONS);
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

	const sortedTasks = $derived(
		sortTasks(filterTasks(tasks, searchQuery), { mode: sortMode, variant: 'daymap' })
	);
</script>

<svelte:head>
	<title>Daymap Tasks</title>
	<meta
		name="description"
		content="Tasks selected for today that are ready to start but are not active yet."
	/>
</svelte:head>

<section class="board">
	{#if loadError}
		<div class="message-card error-card">
			<strong>Could not load daymap tasks</strong>
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
			<strong>Loading daymap tasks</strong>
			<p>Pulling today's selected stack before anything is started.</p>
		</div>
	{:else if tasks.length === 0}
		<div class="message-card">
			<strong>No tasks on today's daymap</strong>
			<p>Pick a few from inactive when you want to build out the day's chunk before starting.</p>
		</div>
	{:else}
		<TaskSortBar
			value={sortMode}
			options={DAYMAP_TASK_SORT_OPTIONS}
			onChange={(nextSortMode) => {
				sortMode = nextSortMode;
				storeTaskSort('daymap', nextSortMode, DAYMAP_TASK_SORT_OPTIONS);
			}}
			searchValue={searchQuery}
			onSearchChange={(nextSearchQuery) => {
				searchQuery = nextSearchQuery;
			}}
		/>

		{#if sortedTasks.length === 0}
			<div class="message-card">
				<strong>No matching tasks</strong>
				<p>Clear search to show the full daymap.</p>
			</div>
		{:else}
			<div class="task-grid">
				{#each sortedTasks as task}
					<TaskCard
						{task}
						variant="daymap"
						editableTaskId={task.id}
						busyAction={busyTasks[task.id] || null}
						onActivate={handleActivate}
						onToggleDaymapLock={handleDaymapLockToggle}
						onQueueToggle={handleQueueToggle}
						onSaveNote={handleSaveNote}
						onSaveNextDue={handleSaveNextDue}
						onUnmap={handleUnmap}
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

	@media (max-width: 840px) {
		.task-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
