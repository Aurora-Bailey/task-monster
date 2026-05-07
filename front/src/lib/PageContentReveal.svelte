<script>
	import { cubicOut } from 'svelte/easing';
	import { fade, fly } from 'svelte/transition';

	let { children, className = '', x = 18 } = $props();
</script>

<div
	class={`page-content-reveal ${className}`.trim()}
	in:fly={{ x, duration: 320, easing: cubicOut }}
	out:fade={{ duration: 140 }}
>
	{@render children()}
</div>

<style>
	.page-content-reveal {
		min-width: 0;
		will-change: opacity, transform;
	}

	:global(.page-content-stack) {
		display: grid;
		gap: 1rem;
	}

	:global(.page-content-stack--loose) {
		display: grid;
		gap: 1.35rem;
	}
</style>
