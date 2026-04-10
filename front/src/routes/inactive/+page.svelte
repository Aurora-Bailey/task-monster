<script>
	import { onMount } from 'svelte';

	import TaskCard from '$lib/TaskCard.svelte';
	import { activateTask, loadInactiveTasks } from '$lib/tasks-client';

	let tasks = $state([]);
	let isLoading = $state(true);
	let loadError = $state('');
	let actionError = $state('');
	let busyTasks = $state({});

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

	async function handleActivate(taskId) {
		actionError = '';
		busyTasks = {
			...busyTasks,
			[taskId]: 'activate'
		};

		try {
			await activateTask(taskId);
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
		loadTasks();
	});

	const repeatableCount = $derived(tasks.filter((task) => task.mode === 'repeatable').length);
	const oneTimeCount = $derived(tasks.length - repeatableCount);
</script>

<svelte:head>
	<title>Inactive Tasks</title>
	<meta name="description" content="Tasks waiting off the table until you activate them." />
</svelte:head>

<section class="board">
	<div class="hero">
		<p class="eyebrow">Inactive</p>
		<h1>The ready stack</h1>
		<p class="lede">
			Repeatable tasks always live here when they are idle, and one-time tasks stay here until they
			are actually finished.
		</p>
	</div>

	<div class="stats">
		<article class="stat">
			<span>Inactive now</span>
			<strong>{tasks.length} waiting</strong>
		</article>
		<article class="stat">
			<span>Repeatable</span>
			<strong>{repeatableCount} loops</strong>
		</article>
		<article class="stat">
			<span>One-time open</span>
			<strong>{oneTimeCount} tasks</strong>
		</article>
	</div>

	{#if loadError}
		<div class="message-card error-card">
			<strong>Could not load inactive tasks</strong>
			<p>{loadError}</p>
		</div>
	{/if}

	{#if actionError}
		<div class="message-card error-card">
			<strong>Could not activate that task</strong>
			<p>{actionError}</p>
		</div>
	{/if}

	{#if isLoading}
		<div class="message-card">
			<strong>Loading inactive tasks</strong>
			<p>Pulling your waiting stack from the database.</p>
		</div>
	{:else if tasks.length === 0}
		<div class="message-card">
			<strong>No inactive tasks</strong>
			<p>
				Everything is either active already or finished. Add another task if you want more options on
				the bench.
			</p>
		</div>
	{:else}
		<div class="task-grid">
			{#each tasks as task}
				<TaskCard task={task} busyAction={busyTasks[task.id] || null} onActivate={handleActivate} />
			{/each}
		</div>
	{/if}
</section>

<style>
	.board {
		display: grid;
		gap: 1.4rem;
		padding: 1.4rem 0 2.4rem;
	}

	.hero {
		display: grid;
		gap: 0.5rem;
		max-width: 42rem;
	}

	.eyebrow {
		margin: 0;
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--color-theme-1);
	}

	h1 {
		margin: 0;
		text-align: left;
		font-size: clamp(2.2rem, 5vw, 3.6rem);
		line-height: 0.95;
		letter-spacing: -0.05em;
		color: rgba(10, 20, 30, 0.9);
	}

	.lede,
	.message-card p {
		margin: 0;
		font-size: 1.05rem;
		color: rgba(10, 20, 30, 0.7);
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.85rem;
	}

	.stat,
	.message-card {
		display: grid;
		gap: 0.4rem;
		padding: 1rem 1.1rem;
		border-radius: 18px;
		background: rgba(255, 255, 255, 0.58);
		border: 1px solid rgba(255, 255, 255, 0.66);
		box-shadow: 0 14px 32px rgba(44, 62, 80, 0.08);
	}

	.stat span {
		font-size: 0.76rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba(10, 20, 30, 0.45);
	}

	.stat strong,
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
		.task-grid,
		.stats {
			grid-template-columns: 1fr;
		}
	}
</style>
