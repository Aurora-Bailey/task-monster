<script>
	import { dev } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';

	import { initializeSession, session } from '$lib/session';
	import { initializeTheme } from '$lib/theme';
	import { normalizeAppPathname } from '$lib/routing';
	import Header from './Header.svelte';
	import './layout.css';

	let { children } = $props();
	const PUBLIC_ROUTE_PATHS = new Set(['/', '/auth', '/privacy', '/terms', '/demo-board']);
	const DEVELOPMENT_SW_RELOAD_KEY = 'task-monster-dev-sw-reload';

	function clearDevelopmentServiceWorkers() {
		if (!('serviceWorker' in navigator)) {
			return;
		}

		const hadController = Boolean(navigator.serviceWorker.controller);
		const unregisterServiceWorkers = navigator.serviceWorker
			.getRegistrations()
			.then((registrations) =>
				Promise.all(
					registrations
						.filter((registration) => registration.scope.startsWith(window.location.origin))
						.map((registration) => registration.unregister())
				)
			);
		const clearCaches =
			'caches' in window
				? caches
						.keys()
						.then((cacheNames) =>
							Promise.all(
								cacheNames
									.filter((cacheName) => cacheName.startsWith('task-monster-pwa-'))
									.map((cacheName) => caches.delete(cacheName))
							)
						)
				: Promise.resolve();

		void Promise.all([unregisterServiceWorkers, clearCaches]).then(() => {
			if (hadController) {
				if (sessionStorage.getItem(DEVELOPMENT_SW_RELOAD_KEY) !== 'true') {
					sessionStorage.setItem(DEVELOPMENT_SW_RELOAD_KEY, 'true');
					window.location.reload();
				}

				return;
			}

			sessionStorage.removeItem(DEVELOPMENT_SW_RELOAD_KEY);
		});
	}

	function registerServiceWorker() {
		if (!('serviceWorker' in navigator)) {
			return;
		}

		if (dev) {
			clearDevelopmentServiceWorkers();
			return;
		}

		const register = () => {
			navigator.serviceWorker
				.register(resolve('/sw.js'), { scope: resolve('/'), updateViaCache: 'none' })
				.catch((error) => {
					console.error('Service worker registration failed', error);
				});
		};

		if (document.readyState === 'complete') {
			register();
			return;
		}

		window.addEventListener('load', register, { once: true });
	}

	onMount(() => {
		initializeTheme();
		initializeSession();
		registerServiceWorker();
	});

	const currentPath = $derived(normalizeAppPathname(page.url.pathname));
	const isMarketingRoute = $derived(currentPath === '/' || currentPath === '/demo-board');
	const isAuthRoute = $derived(currentPath === '/auth');
	const isAddAccountRoute = $derived(
		isAuthRoute && page.url.searchParams.get('addAccount') === '1'
	);
	const isLegalRoute = $derived(currentPath === '/privacy' || currentPath === '/terms');
	const allowsGuest = $derived(PUBLIC_ROUTE_PATHS.has(currentPath));
	const isSessionReady = $derived(
		$session.status === 'guest' || $session.status === 'authenticated'
	);
	const shouldShowBoot = $derived(!allowsGuest && !isSessionReady);

	$effect(() => {
		if (isSessionReady && $session.status === 'guest' && !allowsGuest) {
			goto(resolve('/auth'), { replaceState: true });
		}

		if (
			isSessionReady &&
			$session.status === 'authenticated' &&
			isAuthRoute &&
			!isAddAccountRoute
		) {
			goto(resolve('/active'), { replaceState: true });
		}
	});
</script>

{#if shouldShowBoot}
	<div class="page-loader page-loader--screen" aria-label="Checking your session">
		<span class="page-spinner" aria-hidden="true"></span>
	</div>
{:else if isAuthRoute}
	<main class="auth-main">{@render children()}</main>
{:else if isLegalRoute || isMarketingRoute}
	<div class="public-page">
		<main class:marketing-main={isMarketingRoute} class="public-main">{@render children()}</main>

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
		max-width: 76rem;
		margin: 0 auto;
		box-sizing: border-box;
	}

	.auth-main,
	.public-main {
		min-height: 100vh;
		width: 100%;
		max-width: 64rem;
		margin: 0 auto;
		padding: 1rem;
		box-sizing: border-box;
	}

	.marketing-main {
		padding-top: 0;
	}

	.site-footer {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		gap: 0.45rem;
		padding: 12px;
		color: var(--color-soft);
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
		color: var(--color-muted);
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
