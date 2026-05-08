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
	const PUBLIC_ROUTE_PATHS = new Set(['/', '/auth', '/privacy', '/terms']);
	const DEVELOPMENT_SW_RELOAD_KEY = 'task-monster-dev-sw-reload';
	const ROUTE_ANIMATION_ORDER = [
		'/',
		'/auth',
		'/add',
		'/tasks',
		'/active',
		'/done',
		'/stats',
		'/profile',
		'/privacy',
		'/terms'
	];

	let previousTransitionPath = $state('');
	let pageAnimationDirection = $state('right');

	function getRouteAnimationIndex(pathname) {
		const exactIndex = ROUTE_ANIMATION_ORDER.indexOf(pathname);

		if (exactIndex !== -1) {
			return exactIndex;
		}

		return ROUTE_ANIMATION_ORDER.findIndex(
			(routePath) => routePath !== '/' && pathname.startsWith(`${routePath}/`)
		);
	}

	function getPageAnimationDirection(previousPath, nextPath) {
		const previousIndex = getRouteAnimationIndex(previousPath);
		const nextIndex = getRouteAnimationIndex(nextPath);

		if (previousIndex === -1 || nextIndex === -1 || previousIndex === nextIndex) {
			return 'right';
		}

		return nextIndex < previousIndex ? 'left' : 'right';
	}

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
	const isMarketingRoute = $derived(currentPath === '/');
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

	$effect.pre(() => {
		if (!previousTransitionPath) {
			previousTransitionPath = currentPath;
			return;
		}

		if (currentPath !== previousTransitionPath) {
			pageAnimationDirection = getPageAnimationDirection(previousTransitionPath, currentPath);
			previousTransitionPath = currentPath;
		}
	});

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
	<main class="auth-main">
		{#key currentPath}
			<div
				class:page-transition-frame--from-left={pageAnimationDirection === 'left'}
				class:page-transition-frame--from-right={pageAnimationDirection === 'right'}
				class="page-transition-frame"
			>
				{@render children()}
			</div>
		{/key}
	</main>
{:else if isLegalRoute || isMarketingRoute}
	<div class="public-page">
		<main class:marketing-main={isMarketingRoute} class="public-main">
			{#key currentPath}
				<div
					class:page-transition-frame--from-left={pageAnimationDirection === 'left'}
					class:page-transition-frame--from-right={pageAnimationDirection === 'right'}
					class="page-transition-frame"
				>
					{@render children()}
				</div>
			{/key}
		</main>

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
		<main>
			{#key currentPath}
				<div
					class:page-transition-frame--from-left={pageAnimationDirection === 'left'}
					class:page-transition-frame--from-right={pageAnimationDirection === 'right'}
					class="page-transition-frame"
				>
					{@render children()}
				</div>
			{/key}
		</main>

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

	.page-transition-frame {
		width: 100%;
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.page-transition-frame--from-right {
		animation: page-slide-in-from-right 0.26s cubic-bezier(0.2, 0.8, 0.2, 1) both;
	}

	.page-transition-frame--from-left {
		animation: page-slide-in-from-left 0.26s cubic-bezier(0.2, 0.8, 0.2, 1) both;
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

	@keyframes page-slide-in-from-right {
		from {
			opacity: 0;
			transform: translateX(1.35rem);
		}

		to {
			opacity: 1;
			transform: translateX(0);
		}
	}

	@keyframes page-slide-in-from-left {
		from {
			opacity: 0;
			transform: translateX(-1.35rem);
		}

		to {
			opacity: 1;
			transform: translateX(0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.page-transition-frame--from-left,
		.page-transition-frame--from-right {
			animation: none;
		}
	}
</style>
