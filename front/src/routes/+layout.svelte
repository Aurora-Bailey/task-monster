<script>
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';

	import { initializeSession, session } from '$lib/session';
	import Header from './Header.svelte';
	import './layout.css';

	let { children } = $props();
	const PUBLIC_ROUTE_PATHS = new Set(['/auth', '/privacy', '/terms']);

	onMount(() => {
		initializeSession();
	});

	const isAuthRoute = $derived(page.url.pathname === '/auth');
	const isLegalRoute = $derived(
		page.url.pathname === '/privacy' || page.url.pathname === '/terms'
	);
	const allowsGuest = $derived(PUBLIC_ROUTE_PATHS.has(page.url.pathname));
	const isSessionReady = $derived(
		$session.status === 'guest' || $session.status === 'authenticated'
	);

	$effect(() => {
		if (isSessionReady && $session.status === 'guest' && !allowsGuest) {
			goto('/auth', { replaceState: true });
		}

		if (isSessionReady && $session.status === 'authenticated' && isAuthRoute) {
			goto('/active', { replaceState: true });
		}
	});
</script>

{#if !isSessionReady}
	<div class="boot-shell">
		<div class="boot-card">
			<p class="boot-kicker">Task Monster</p>
			<h1>Checking your session</h1>
			<p>Making sure the board knows who you are before it renders anything else.</p>
		</div>
	</div>
{:else if isAuthRoute}
	<main class="auth-main">{@render children()}</main>
{:else if isLegalRoute}
	<div class="public-page">
		<main class="public-main">{@render children()}</main>

		<footer class="site-footer">
			<p>task monster</p>

			<nav aria-label="Legal">
				<a href={resolve('/privacy')}>Privacy Policy</a>
				<a href={resolve('/terms')}>Terms &amp; Conditions</a>
			</nav>
		</footer>
	</div>
{:else}
	<div class="app">
		<Header user={$session.user} />
		<main>{@render children()}</main>

		<footer class="site-footer">
			<p>task monster</p>

			<nav aria-label="Legal">
				<a href={resolve('/privacy')}>Privacy Policy</a>
				<a href={resolve('/terms')}>Terms &amp; Conditions</a>
			</nav>
		</footer>
	</div>
{/if}

<style>
	.app {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	.public-page {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	main {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: 1rem;
		width: 100%;
		max-width: 64rem;
		margin: 0 auto;
		box-sizing: border-box;
	}

	.auth-main,
	.boot-shell,
	.public-main {
		min-height: 100vh;
		width: 100%;
		max-width: 64rem;
		margin: 0 auto;
		padding: 1rem;
		box-sizing: border-box;
	}

	.boot-shell {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.boot-card {
		max-width: 26rem;
		padding: 1.8rem;
		border-radius: 26px;
		background: rgba(255, 255, 255, 0.68);
		border: 1px solid rgba(255, 255, 255, 0.75);
		box-shadow: 0 26px 56px rgba(44, 62, 80, 0.1);
	}

	.boot-kicker {
		margin: 0 0 0.65rem;
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--color-theme-2);
	}

	.boot-card h1 {
		margin: 0 0 0.7rem;
		text-align: left;
	}

	.boot-card p:last-child {
		margin: 0;
		color: rgba(0, 0, 0, 0.62);
	}

	.site-footer {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		gap: 0.45rem;
		padding: 12px;
		color: rgba(0, 0, 0, 0.45);
		font-size: 0.82rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.site-footer p {
		margin: 0;
	}

	.site-footer nav {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.9rem;
		letter-spacing: normal;
		text-transform: none;
	}

	.site-footer a {
		color: rgba(10, 20, 30, 0.62);
		text-decoration: none;
		font-weight: 700;
	}

	.site-footer a:hover {
		color: var(--color-theme-2);
	}

	@media (min-width: 480px) {
		.site-footer {
			padding: 12px 0;
		}
	}
</style>
