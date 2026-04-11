<script>
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	import TaskCard from '$lib/TaskCard.svelte';
	import TaskSortBar from '$lib/TaskSortBar.svelte';
	import { DEFAULT_TASK_SORT_MODE, loadStoredTaskSort, sortTasks, storeTaskSort } from '$lib/task-sort';
	import { archiveTask, loadInactiveTasks, moveTaskToDaymap, updateTaskNote } from '$lib/tasks-client';

	let tasks = $state([]);
	let isLoading = $state(true);
	let loadError = $state('');
	let actionError = $state('');
	let busyTasks = $state({});
	let sortMode = $state(DEFAULT_TASK_SORT_MODE);

	async function loadTasks() {
		isLoading = true;
		loadError = '';

		try {
			tasks = await loadInactiveTasks();
		} catch (error) {
			loadError = error.message;
		} finally {
			isLoading = false;
		}
	}

	async function handleDaymap(taskId) {
		actionError = '';
		busyTasks = {
			...busyTasks,
			[taskId]: 'daymap'
		};

		try {
			await moveTaskToDaymap(taskId);
			await goto('/daymap');
		} catch (error) {
			actionError = error.message;
		} finally {
			const nextBusyTasks = { ...busyTasks };
			delete nextBusyTasks[taskId];
			busyTasks = nextBusyTasks;
		}
	}

	async function handleSaveNote(taskId, note) {
		const updatedTask = await updateTaskNote(taskId, note);
		tasks = tasks.map((task) => (task.id === taskId ? updatedTask : task));
		return updatedTask;
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
		busyTasks = {
			...busyTasks,
			[taskId]: 'archive'
		};

		try {
			await archiveTask(taskId);
			tasks = tasks.filter((task) => task.id !== taskId);
		} catch (error) {
			actionError = error.message;
		} finally {
			const nextBusyTasks = { ...busyTasks };
			delete nextBusyTasks[taskId];
			busyTasks = nextBusyTasks;
		}
	}

	onMount(() => {
		sortMode = loadStoredTaskSort('inactive');
		loadTasks();
	});

	const sortedTasks = $derived(sortTasks(tasks, { mode: sortMode, variant: 'inactive' }));
</script>

<svelte:head>
	<title>Inactive Tasks</title>
	<meta name="description" content="Your full backlog of possible tasks that are not on today's map yet." />
</svelte:head>

<section class="board">
	{#if loadError}
		<div class="message-card error-card">
			<strong>Could not load inactive tasks</strong>
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
			<strong>Loading inactive tasks</strong>
			<p>Pulling the full backlog that is still outside today's plan.</p>
		</div>
	{:else if tasks.length === 0}
		<div class="message-card">
			<strong>No inactive tasks</strong>
			<p>
				Everything is already on today's map, active, or finished. Add another task if you want more
				options in reserve.
			</p>
		</div>
	{:else}
		<TaskSortBar
			value={sortMode}
			onChange={(nextSortMode) => {
				sortMode = nextSortMode;
				storeTaskSort('inactive', nextSortMode);
			}}
		/>

		<div class="task-grid">
			{#each sortedTasks as task}
				<TaskCard
					task={task}
					editableTaskId={task.id}
					clickActionLabel="Move to daymap"
					busyAction={busyTasks[task.id] || null}
					showArchiveButton={true}
					onActivate={handleDaymap}
					onArchive={handleArchive}
					onSaveNote={handleSaveNote}
				/>
			{/each}
		</div>
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
		color: rgba(10, 20, 30, 0.7);
	}

	.message-card {
		display: grid;
		gap: 0.4rem;
		padding: 1rem 1.1rem;
		border-radius: 18px;
		background: rgba(255, 255, 255, 0.58);
		border: 1px solid rgba(255, 255, 255, 0.66);
		box-shadow: 0 14px 32px rgba(44, 62, 80, 0.08);
	}

	.message-card strong {
		font-size: 1.15rem;
		letter-spacing: -0.02em;
		color: rgba(10, 20, 30, 0.82);
	}

	.error-card {
		border-color: rgba(159, 45, 39, 0.18);
		background: rgba(255, 245, 244, 0.92);
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
