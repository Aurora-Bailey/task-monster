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
		background: rgba(255, 255, 255, 0.58);
		border: 1px solid rgba(255, 255, 255, 0.66);
		box-shadow: 0 14px 32px rgba(44, 62, 80, 0.08);
	}

	.sort-label {
		font-size: 0.76rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba(10, 20, 30, 0.45);
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
		border: 1px solid rgba(20, 28, 38, 0.08);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.92);
		font-size: 0.76rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: rgba(13, 24, 36, 0.68);
	}

	.sort-options button.selected-option {
		background: linear-gradient(135deg, var(--color-theme-2), #5b93c8);
		color: white;
		box-shadow: 0 14px 28px rgba(64, 117, 166, 0.24);
		border-color: transparent;
	}

	@media (max-width: 640px) {
		.sort-bar {
			flex-direction: column;
			align-items: stretch;
		}
	}
</style>
