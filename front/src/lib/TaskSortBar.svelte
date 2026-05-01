<script>
	import { TASK_SORT_OPTIONS } from '$lib/task-sort';

	let { value = 'date', options = TASK_SORT_OPTIONS, onChange = () => {} } = $props();
</script>

<div class="sort-bar" role="group" aria-label="Sort tasks">
	<span class="sort-label">Sort</span>

	<div class="sort-options">
		{#each options as option}
			<button
				type="button"
				class:selected-option={value === option.value}
				aria-pressed={value === option.value}
				onclick={() => onChange(option.value)}
			>
				{option.label}
			</button>
		{/each}
	</div>
</div>

<style>
	.sort-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.8rem;
		padding: 0.85rem 1rem;
		border-radius: 18px;
		background: var(--surface-1);
		border: 1px solid var(--surface-border);
		box-shadow: var(--surface-shadow);
	}

	.sort-label {
		font-size: 0.76rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--color-soft);
	}

	.sort-options {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.sort-options button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 2.4rem;
		padding: 0.65rem 0.9rem;
		border: 1px solid var(--surface-border-strong);
		border-radius: 999px;
		background: var(--surface-2);
		font-size: 0.76rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--color-muted);
		box-shadow: var(--surface-inset);
		cursor: pointer;
		transition:
			transform 0.15s ease,
			border-color 0.15s ease,
			box-shadow 0.15s ease,
			color 0.15s ease;
	}

	.sort-options button:hover {
		transform: translateY(-1px);
		border-color: color-mix(in srgb, var(--color-accent) 28%, var(--surface-border));
		color: var(--color-accent);
	}

	.sort-options button.selected-option {
		background: var(--accent-gradient);
		color: var(--color-accent-contrast);
		box-shadow: 0 14px 28px color-mix(in srgb, var(--color-accent) 24%, transparent);
		border-color: transparent;
	}

	@media (max-width: 640px) {
		.sort-bar {
			flex-direction: column;
			align-items: stretch;
		}
	}
</style>
