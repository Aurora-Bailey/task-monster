<script>
	import TaskCard from '$lib/TaskCard.svelte';
	import { activeTasks, formatMinutes } from '$lib/task-catalog';

	const totalMinutes = activeTasks.reduce((sum, task) => sum + task.durationMinutes, 0);
	const repeatableCount = activeTasks.filter((task) => task.mode === 'repeatable').length;
	const oneTimeCount = activeTasks.length - repeatableCount;
</script>

<svelte:head>
	<title>Active Tasks</title>
	<meta name="description" content="Tasks currently on the table today." />
</svelte:head>

<section class="board">
	<div class="hero">
		<p class="eyebrow">Active</p>
		<h1>What is on the table today</h1>
		<p class="lede">
			{activeTasks.length} tasks are active today, adding up to {formatMinutes(totalMinutes)} of
			focused work.
		</p>
	</div>

	<div class="stats">
		<article class="stat">
			<span>On deck</span>
			<strong>{activeTasks.length} tasks</strong>
		</article>
		<article class="stat">
			<span>Repeatable</span>
			<strong>{repeatableCount} routines</strong>
		</article>
		<article class="stat">
			<span>One-time</span>
			<strong>{oneTimeCount} shots</strong>
		</article>
	</div>

	<div class="task-grid">
		{#each activeTasks as task}
			<TaskCard {task} />
		{/each}
	</div>
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
		color: var(--color-theme-2);
	}

	h1 {
		margin: 0;
		text-align: left;
		font-size: clamp(2.2rem, 5vw, 3.6rem);
		line-height: 0.95;
		letter-spacing: -0.05em;
		color: rgba(10, 20, 30, 0.9);
	}

	.lede {
		margin: 0;
		font-size: 1.05rem;
		color: rgba(10, 20, 30, 0.7);
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.85rem;
	}

	.stat {
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

	.stat strong {
		font-size: 1.15rem;
		letter-spacing: -0.02em;
		color: rgba(10, 20, 30, 0.82);
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
