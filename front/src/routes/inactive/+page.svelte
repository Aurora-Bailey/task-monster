<script>
	import TaskCard from '$lib/TaskCard.svelte';
	import { activeTasks, inactiveTasks, taskCatalog } from '$lib/task-catalog';

	const catalogView = [...inactiveTasks, ...activeTasks];
	const repeatableCount = taskCatalog.filter((task) => task.mode === 'repeatable').length;
</script>

<svelte:head>
	<title>Inactive Tasks</title>
	<meta name="description" content="All possible tasks, with inactive items surfaced first." />
</svelte:head>

<section class="board">
	<div class="hero">
		<p class="eyebrow">Inactive</p>
		<h1>The full task pool</h1>
		<p class="lede">
			{taskCatalog.length} possible tasks live here. {inactiveTasks.length} are currently idle, and
			{activeTasks.length} are already on today&apos;s table.
		</p>
	</div>

	<div class="stats">
		<article class="stat">
			<span>Inactive now</span>
			<strong>{inactiveTasks.length} waiting</strong>
		</article>
		<article class="stat">
			<span>Total catalog</span>
			<strong>{taskCatalog.length} options</strong>
		</article>
		<article class="stat">
			<span>Repeatable</span>
			<strong>{repeatableCount} loops</strong>
		</article>
	</div>

	<div class="task-grid">
		{#each catalogView as task}
			<TaskCard {task} showStatus={true} />
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
