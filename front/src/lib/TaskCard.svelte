<script>
	import { formatMinutes, formatTaskMode } from '$lib/task-catalog';

	let { task, showStatus = false } = $props();
</script>

<article class="task-card" class:is-active={task.activeToday} style={`--task-accent: ${task.color};`}>
	<div class="task-card__header">
		<div>
			<p class="task-card__category">{task.category}</p>
			<h2>{task.name}</h2>
		</div>

		{#if showStatus}
			<span class="task-card__status" class:active-status={task.activeToday}>
				{task.activeToday ? 'On table' : 'Inactive'}
			</span>
		{/if}
	</div>

	<p class="task-card__note">{task.note}</p>

	<div class="task-card__chips">
		<span>{formatTaskMode(task.mode)}</span>
		<span>{formatMinutes(task.durationMinutes)}</span>
		<span>Snooze {formatMinutes(task.snoozeMinutes)}</span>
	</div>

	<dl class="task-card__details">
		<div>
			<dt>Window</dt>
			<dd>{task.window}</dd>
		</div>
		<div>
			<dt>Where</dt>
			<dd>{task.location}</dd>
		</div>
	</dl>
</article>

<style>
	.task-card {
		display: grid;
		gap: 1rem;
		padding: 1.2rem;
		border-radius: 20px;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(248, 251, 255, 0.88)),
			linear-gradient(135deg, color-mix(in srgb, var(--task-accent) 14%, white), white 65%);
		border: 1px solid color-mix(in srgb, var(--task-accent) 22%, white);
		box-shadow:
			0 18px 40px rgba(44, 62, 80, 0.1),
			inset 0 1px 0 rgba(255, 255, 255, 0.75);
		position: relative;
		overflow: hidden;
	}

	.task-card::before {
		content: '';
		position: absolute;
		inset: 0 auto 0 0;
		width: 0.38rem;
		background: linear-gradient(180deg, var(--task-accent), color-mix(in srgb, var(--task-accent) 55%, white));
	}

	.task-card.is-active {
		box-shadow:
			0 22px 44px rgba(44, 62, 80, 0.14),
			0 0 0 1px color-mix(in srgb, var(--task-accent) 20%, white);
	}

	.task-card__header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	.task-card__category {
		margin: 0 0 0.35rem;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--task-accent) 60%, black);
	}

	h2 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: rgba(13, 24, 36, 0.92);
	}

	.task-card__status {
		flex-shrink: 0;
		padding: 0.4rem 0.7rem;
		border-radius: 999px;
		background: rgba(20, 28, 38, 0.08);
		color: rgba(20, 28, 38, 0.68);
		font-size: 0.7rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.task-card__status.active-status {
		background: color-mix(in srgb, var(--task-accent) 16%, white);
		color: color-mix(in srgb, var(--task-accent) 65%, black);
	}

	.task-card__note {
		margin: 0;
		color: rgba(20, 28, 38, 0.72);
	}

	.task-card__chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
	}

	.task-card__chips span {
		padding: 0.45rem 0.7rem;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.88);
		border: 1px solid rgba(20, 28, 38, 0.08);
		font-size: 0.78rem;
		font-weight: 700;
		color: rgba(20, 28, 38, 0.72);
	}

	.task-card__details {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.9rem;
		margin: 0;
	}

	.task-card__details div {
		padding-top: 0.85rem;
		border-top: 1px solid rgba(20, 28, 38, 0.08);
	}

	dt {
		margin: 0 0 0.3rem;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(20, 28, 38, 0.45);
	}

	dd {
		margin: 0;
		font-weight: 700;
		color: rgba(20, 28, 38, 0.78);
	}

	@media (max-width: 640px) {
		.task-card__header {
			flex-direction: column;
		}

		.task-card__details {
			grid-template-columns: 1fr;
		}
	}
</style>
