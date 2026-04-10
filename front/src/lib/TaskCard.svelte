<script>
	import { formatMinutes, formatTaskMode } from '$lib/task-format';

	let {
		task,
		variant = 'inactive',
		activeDurationLabel = '',
		alarmLabel = '',
		ringing = false,
		busyAction = null,
		onActivate = () => {},
		onInactivate = () => {},
		onDone = () => {},
		onSnooze = () => {}
	} = $props();

	const hasAlarm = $derived(task.alarmEnabled && task.durationMinutes && task.snoozeMinutes);
	const isInactiveCard = $derived(variant !== 'active');
	const visibleTitleChips = $derived([
		task.mode === 'one-time' ? formatTaskMode(task.mode) : null,
		hasAlarm ? 'Alarm on' : null,
		hasAlarm ? formatMinutes(task.durationMinutes) : null,
		hasAlarm ? `Snooze ${formatMinutes(task.snoozeMinutes)}` : null
	].filter(Boolean));

	function handleInactiveActivate() {
		if (!isInactiveCard || busyAction !== null) {
			return;
		}

		onActivate(task.id);
	}

	function handleInactiveKeydown(event) {
		if (!isInactiveCard || busyAction !== null) {
			return;
		}

		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			onActivate(task.id);
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
	class="task-card"
	class:is-active={variant === 'active'}
	class:is-inactive={isInactiveCard}
	class:is-busy={busyAction !== null}
	style={`--task-accent: ${task.color};`}
	role={isInactiveCard ? 'button' : undefined}
	tabindex={isInactiveCard ? 0 : undefined}
	aria-label={isInactiveCard ? `Activate ${task.name}` : undefined}
	aria-disabled={isInactiveCard ? busyAction !== null : undefined}
	onclick={isInactiveCard ? handleInactiveActivate : undefined}
	onkeydown={isInactiveCard ? handleInactiveKeydown : undefined}
>
	<div class="task-card__header">
		<div class="task-card__title-block">
			<h2>{task.name}</h2>

			{#if visibleTitleChips.length > 0}
				<div class="task-card__title-chips">
					{#each visibleTitleChips as chip}
						<span class="highlight-chip">{chip}</span>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	{#if task.note}
		<div class="task-card__note-block">
			<span class="task-card__note-label">Note</span>
			<p class="task-card__note">{task.note}</p>
		</div>
	{/if}

	{#if variant === 'active'}
		<div class="task-card__runtime">
			<div class="runtime-stat">
				<span>Active for</span>
				<strong>{activeDurationLabel}</strong>
			</div>

			<div class="runtime-stat">
				<span>Alarm</span>
				<strong>{alarmLabel || 'Off'}</strong>
			</div>
		</div>

		{#if hasAlarm && ringing}
			<div class="alarm-panel">
				<div>
					<strong>Alarm ringing</strong>
					<p>This task has hit its timer and will keep sounding until you snooze it.</p>
				</div>
				<button
					class="action-button warm-button"
					type="button"
					disabled={busyAction !== null}
					onclick={() => onSnooze(task.id)}
				>
					{busyAction === 'snooze' ? 'Snoozing...' : `Snooze ${formatMinutes(task.snoozeMinutes)}`}
				</button>
			</div>
		{/if}

		<div class="task-card__actions split-actions">
			<button
				class="action-button success-button"
				type="button"
				disabled={busyAction !== null}
				onclick={() => onDone(task.id)}
			>
				{busyAction === 'done' ? 'Closing...' : 'Done'}
			</button>
			<button
				class="action-button subtle-button"
				type="button"
				disabled={busyAction !== null}
				onclick={() => onInactivate(task.id)}
			>
				{busyAction === 'inactivate' ? 'Moving...' : 'Inactivate'}
			</button>
		</div>
	{/if}
</div>

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

	.task-card.is-inactive {
		border-width: 2px;
		border-color: color-mix(in srgb, var(--task-accent) 58%, white);
		box-shadow:
			0 20px 42px rgba(44, 62, 80, 0.11),
			0 0 0 1px color-mix(in srgb, var(--task-accent) 16%, white),
			inset 0 1px 0 rgba(255, 255, 255, 0.75);
		cursor: pointer;
		transition:
			transform 0.16s ease,
			box-shadow 0.16s ease,
			border-color 0.16s ease;
	}

	.task-card.is-inactive:hover {
		transform: translateY(-2px);
		border-color: color-mix(in srgb, var(--task-accent) 82%, white);
		box-shadow:
			0 24px 48px rgba(44, 62, 80, 0.14),
			0 0 0 1px color-mix(in srgb, var(--task-accent) 22%, white),
			inset 0 1px 0 rgba(255, 255, 255, 0.82);
	}

	.task-card.is-inactive:focus-visible {
		outline: none;
		box-shadow:
			0 0 0 4px color-mix(in srgb, var(--task-accent) 24%, white),
			0 24px 48px rgba(44, 62, 80, 0.16),
			inset 0 1px 0 rgba(255, 255, 255, 0.82);
	}

	.task-card.is-inactive.is-busy {
		cursor: wait;
		transform: none;
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

	.task-card__header,
	.alarm-panel {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	.task-card__title-block {
		display: grid;
		gap: 0.25rem;
	}

	h2,
	strong,
	p {
		margin: 0;
	}

	h2 {
		font-size: 1.25rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: rgba(13, 24, 36, 0.92);
	}

	.task-card__title-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.85rem;
	}

	.task-card__title-chips {
		margin-top: 0.15rem;
	}

	.runtime-stat,
	.alarm-panel {
		background: rgba(255, 255, 255, 0.88);
		border: 1px solid rgba(20, 28, 38, 0.08);
	}

	.task-card__title-chips span {
		padding: 0 0 0.22rem;
		border-bottom: 2px solid rgba(20, 28, 38, 0.14);
		font-size: 0.78rem;
		font-weight: 700;
		color: rgba(20, 28, 38, 0.72);
		line-height: 1.15;
	}

	.task-card__title-chips span.highlight-chip {
		border-bottom-color: color-mix(in srgb, var(--task-accent) 48%, white);
		color: color-mix(in srgb, var(--task-accent) 65%, black);
	}

	.task-card__note-block {
		padding: 0.9rem 1rem;
		margin-left: 0.35rem;
		border-left: 3px solid color-mix(in srgb, var(--task-accent) 38%, white);
		border-radius: 0 14px 14px 0;
		background:
			linear-gradient(180deg, rgba(248, 250, 252, 0.98), rgba(243, 247, 251, 0.96)),
			rgba(255, 255, 255, 0.88);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
	}

	.task-card__note-label {
		display: inline-block;
		margin-bottom: 0.4rem;
		font-family: 'IBM Plex Mono', 'SFMono-Regular', 'SF Mono', Consolas, 'Liberation Mono',
			Menlo, monospace;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(20, 28, 38, 0.48);
	}

	.task-card__note {
		color: rgba(20, 28, 38, 0.72);
		line-height: 1.5;
		white-space: pre-wrap;
	}

	.task-card__runtime {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.8rem;
	}

	.runtime-stat {
		padding: 0.9rem 1rem;
		border-radius: 16px;
	}

	.runtime-stat span {
		display: block;
		margin-bottom: 0.35rem;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(20, 28, 38, 0.46);
	}

	.runtime-stat strong {
		font-size: 1rem;
		color: rgba(20, 28, 38, 0.84);
	}

	.alarm-panel {
		padding: 0.95rem 1rem;
		border-radius: 18px;
		background:
			linear-gradient(180deg, rgba(255, 247, 236, 0.98), rgba(255, 251, 245, 0.95)),
			rgba(255, 255, 255, 0.88);
		border-color: rgba(191, 121, 31, 0.16);
	}

	.alarm-panel strong {
		display: block;
		margin-bottom: 0.25rem;
		color: #9a5e12;
	}

	.alarm-panel p {
		font-size: 0.88rem;
		color: rgba(20, 28, 38, 0.66);
	}

	.task-card__actions {
		display: grid;
		gap: 0.7rem;
	}

	.split-actions {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.action-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		min-height: 3.2rem;
		padding: 0.9rem 1rem;
		border: 0;
		border-radius: 14px;
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		cursor: pointer;
		transition:
			transform 0.15s ease,
			box-shadow 0.15s ease,
			filter 0.15s ease;
	}

	.action-button:hover {
		transform: translateY(-1px);
	}

	.action-button:disabled {
		cursor: wait;
		opacity: 0.74;
		transform: none;
	}

	.success-button {
		background: linear-gradient(135deg, #4b9f67, #6cbc83);
		color: white;
		box-shadow: 0 12px 24px rgba(75, 159, 103, 0.2);
	}

	.subtle-button {
		background: rgba(20, 28, 38, 0.08);
		color: rgba(20, 28, 38, 0.76);
		border: 1px solid rgba(20, 28, 38, 0.08);
	}

	.warm-button {
		background: linear-gradient(135deg, #c97b22, #e3a04f);
		color: white;
		box-shadow: 0 12px 24px rgba(201, 123, 34, 0.2);
	}

	@media (max-width: 640px) {
		.task-card__header,
		.alarm-panel {
			flex-direction: column;
		}

		.task-card__runtime,
		.split-actions {
			grid-template-columns: 1fr;
		}
	}
</style>
