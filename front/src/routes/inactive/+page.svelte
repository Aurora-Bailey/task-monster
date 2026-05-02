<script>
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';

	import { ASSISTANT_REFRESH_EVENT } from '$lib/assistant-client';
	import TaskCard from '$lib/TaskCard.svelte';
	import TaskSortBar from '$lib/TaskSortBar.svelte';
	import {
		DEFAULT_TASK_SORT_MODE,
		loadStoredTaskSort,
		sortTasks,
		storeTaskSort
	} from '$lib/task-sort';
	import {
		archiveTask,
		loadInactiveTasks,
		moveTaskToDaymap,
		updateTaskNote
	} from '$lib/tasks-client';

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
			await goto(resolve('/daymap'));
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

	const sortedTasks = $derived(sortTasks(tasks, { mode: sortMode, variant: 'inactive' }));
</script>

<svelte:head>
	<title>Inactive Tasks</title>
	<meta
		name="description"
		content="Your full backlog of possible tasks that are not on today's map yet."
	/>
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
					{task}
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
