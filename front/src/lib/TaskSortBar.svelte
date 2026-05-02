<script>
	import { tick } from 'svelte';

	import { TASK_SORT_OPTIONS } from '$lib/task-sort';

	let {
		value = 'date',
		options = TASK_SORT_OPTIONS,
		onChange = () => {},
		searchValue = '',
		onSearchChange = () => {},
		searchPlaceholder = 'Search tasks'
	} = $props();

	let isSortOpen = $state(false);
	let isSearchOpen = $state(false);
	let searchInput = $state(null);

	const selectedSortLabel = $derived(
		options.find((option) => option.value === value)?.label ?? 'Sort'
	);
	const normalizedSearchValue = $derived(typeof searchValue === 'string' ? searchValue : '');

	$effect(() => {
		if (normalizedSearchValue) {
			isSearchOpen = true;
		}
	});

	function toggleSortMenu() {
		isSortOpen = !isSortOpen;
	}

	function selectSortMode(nextSortMode) {
		onChange(nextSortMode);
		isSortOpen = false;
	}

	async function openSearch() {
		isSortOpen = false;
		isSearchOpen = true;
		await tick();
		searchInput?.focus();
	}

	function clearSearch() {
		onSearchChange('');
		isSearchOpen = false;
	}

	function handleSearchKeydown(event) {
		if (event.key === 'Escape') {
			clearSearch();
		}
	}

	function handleSortKeydown(event) {
		if (event.key === 'Escape') {
			isSortOpen = false;
		}
	}
</script>

<div class="sort-bar" role="group" aria-label="Board controls">
	<div class="sort-bar__controls">
		<div class="search-control" class:search-control-open={isSearchOpen}>
			{#if isSearchOpen}
				<div class="search-bubble">
					<label class="visually-hidden" for="task-board-search">Search tasks</label>
					<input
						id="task-board-search"
						bind:this={searchInput}
						type="search"
						value={normalizedSearchValue}
						placeholder={searchPlaceholder}
						oninput={(event) => onSearchChange(event.currentTarget.value)}
						onkeydown={handleSearchKeydown}
					/>
					<button
						class="search-clear"
						type="button"
						aria-label="Clear search"
						onclick={clearSearch}
					>
						<svg aria-hidden="true" focusable="false" viewBox="0 0 20 20">
							<path d="M5 5l10 10M15 5L5 15" />
						</svg>
					</button>
				</div>
			{/if}

			<button
				class="icon-button"
				type="button"
				aria-label="Search tasks"
				aria-expanded={isSearchOpen}
				onclick={openSearch}
			>
				<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
					<path d="M10.5 18a7.5 7.5 0 1 1 5.3-2.2L21 21" />
				</svg>
			</button>
		</div>

		<div class="sort-menu-wrap">
			<button
				class="icon-button"
				type="button"
				aria-label={`Sort tasks. Current sort: ${selectedSortLabel}`}
				aria-expanded={isSortOpen}
				aria-haspopup="menu"
				onclick={toggleSortMenu}
				onkeydown={handleSortKeydown}
			>
				<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
					<path d="M4 7h10M4 17h10M18 5v4M18 15v4M14 7h8M14 17h8" />
				</svg>
			</button>

			{#if isSortOpen}
				<div class="sort-menu" role="menu" aria-label="Sort tasks">
					<span class="sort-menu__label">Sort by</span>
					{#each options as option}
						<button
							type="button"
							role="menuitemradio"
							class:selected-option={value === option.value}
							aria-checked={value === option.value}
							onclick={() => selectSortMode(option.value)}
						>
							<span>{option.label}</span>
							{#if value === option.value}
								<svg aria-hidden="true" focusable="false" viewBox="0 0 20 20">
									<path d="M4 10.5l3.4 3.4L16 5.8" />
								</svg>
							{/if}
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.sort-bar {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		min-height: 2.8rem;
	}

	.sort-bar__controls {
		position: relative;
		z-index: 3;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.45rem;
	}

	.search-control {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.45rem;
	}

	.search-bubble {
		display: flex;
		align-items: center;
		width: min(16rem, calc(100vw - 8rem));
		min-height: 2.55rem;
		padding: 0.25rem 0.35rem 0.25rem 0.8rem;
		border: 1px solid var(--surface-border);
		border-radius: 999px;
		background: var(--surface-1);
		box-shadow: var(--surface-shadow), var(--surface-inset);
		transform-origin: right center;
		animation: search-slide-in 0.18s ease both;
	}

	.search-bubble input {
		min-width: 0;
		width: 100%;
		border: 0;
		background: transparent;
		font: inherit;
		font-size: 0.9rem;
		color: var(--color-text);
		outline: none;
	}

	.search-bubble input::placeholder {
		color: var(--color-soft);
	}

	.search-bubble input::-webkit-search-cancel-button {
		display: none;
	}

	.icon-button,
	.search-clear {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--surface-border);
		border-radius: 999px;
		background: var(--surface-1);
		color: var(--color-muted);
		box-shadow: var(--surface-shadow), var(--surface-inset);
		cursor: pointer;
		transition:
			transform 0.15s ease,
			border-color 0.15s ease,
			box-shadow 0.15s ease,
			color 0.15s ease,
			background-color 0.15s ease;
	}

	.icon-button {
		width: 2.65rem;
		height: 2.65rem;
		padding: 0;
	}

	.search-clear {
		flex: 0 0 auto;
		width: 2rem;
		height: 2rem;
		padding: 0;
		background: color-mix(in srgb, var(--surface-2) 72%, transparent);
		box-shadow: var(--surface-inset);
	}

	.icon-button svg,
	.search-clear svg,
	.sort-menu button svg {
		width: 1.12rem;
		height: 1.12rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.icon-button:hover,
	.search-clear:hover {
		transform: translateY(-1px);
		border-color: color-mix(in srgb, var(--color-accent) 28%, var(--surface-border));
		color: var(--color-accent);
		box-shadow: var(--surface-shadow-strong), var(--surface-inset);
	}

	.icon-button[aria-expanded='true'] {
		background: var(--accent-gradient);
		color: var(--color-accent-contrast);
		border-color: transparent;
		box-shadow: 0 14px 28px color-mix(in srgb, var(--color-accent) 24%, transparent);
	}

	.sort-menu-wrap {
		position: relative;
	}

	.sort-menu {
		position: absolute;
		top: calc(100% + 0.45rem);
		right: 0;
		z-index: 4;
		display: grid;
		gap: 0.28rem;
		min-width: 11rem;
		padding: 0.55rem;
		border: 1px solid var(--surface-border);
		border-radius: 18px;
		background: var(--surface-2);
		box-shadow: var(--surface-shadow-strong), var(--surface-inset);
		transform-origin: top right;
		animation: sort-drop-in 0.16s ease both;
	}

	.sort-menu__label {
		padding: 0.2rem 0.45rem 0.3rem;
		font-size: 0.76rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--color-soft);
	}

	.sort-menu button {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.7rem;
		min-height: 2.25rem;
		padding: 0.55rem 0.65rem;
		border: 1px solid transparent;
		border-radius: 12px;
		background: transparent;
		font-size: 0.82rem;
		font-weight: 800;
		color: var(--color-muted);
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			border-color 0.15s ease,
			color 0.15s ease;
	}

	.sort-menu button:hover {
		background: var(--surface-muted);
		border-color: color-mix(in srgb, var(--color-accent) 28%, var(--surface-border));
		color: var(--color-accent);
	}

	.sort-menu button.selected-option {
		background: color-mix(in srgb, var(--color-accent) 12%, var(--surface-1));
		border-color: color-mix(in srgb, var(--color-accent) 26%, var(--surface-border));
		color: var(--color-heading);
	}

	.sort-menu button svg {
		width: 1rem;
		height: 1rem;
		color: var(--color-accent);
	}

	@keyframes search-slide-in {
		from {
			opacity: 0;
			transform: translateX(0.7rem) scaleX(0.94);
		}

		to {
			opacity: 1;
			transform: translateX(0) scaleX(1);
		}
	}

	@keyframes sort-drop-in {
		from {
			opacity: 0;
			transform: translateY(-0.45rem) scaleY(0.96);
		}

		to {
			opacity: 1;
			transform: translateY(0) scaleY(1);
		}
	}

	@media (max-width: 640px) {
		.sort-bar {
			min-height: 2.55rem;
		}

		.sort-bar__controls,
		.search-control {
			gap: 0.35rem;
		}

		.icon-button {
			width: 2.45rem;
			height: 2.45rem;
		}

		.search-bubble {
			width: min(13.5rem, calc(100vw - 7.2rem));
			min-height: 2.4rem;
		}

		.sort-menu {
			min-width: 10rem;
		}
	}
</style>
