const CACHE_NAME = 'task-monster-pwa-v1';
const DEVELOPMENT_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]', '::1']);
const SHELL_ASSETS = [
	'./',
	'./manifest.webmanifest',
	'./icons/favicon-32.png',
	'./icons/icon-192.png',
	'./icons/icon-512.png',
	'./icons/maskable-512.png',
	'./icons/apple-touch-icon.png'
];
const CACHEABLE_DESTINATIONS = new Set(['font', 'image', 'manifest', 'script', 'style', 'worker']);
const isDevelopmentHost = isDevelopmentHostname(self.location.hostname);

function isDevelopmentHostname(hostname) {
	return (
		DEVELOPMENT_HOSTNAMES.has(hostname) ||
		hostname.endsWith('.local') ||
		/^10\./.test(hostname) ||
		/^192\.168\./.test(hostname) ||
		/^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
	);
}

async function clearTaskMonsterCaches() {
	const cacheNames = await caches.keys();

	await Promise.all(
		cacheNames
			.filter((cacheName) => cacheName.startsWith('task-monster-pwa-'))
			.map((cacheName) => caches.delete(cacheName))
	);
}

if (isDevelopmentHost) {
	self.addEventListener('install', (event) => {
		event.waitUntil(clearTaskMonsterCaches().then(() => self.skipWaiting()));
	});

	self.addEventListener('activate', (event) => {
		event.waitUntil(
			clearTaskMonsterCaches()
				.then(() => self.registration.unregister())
				.then(() => self.clients.claim())
		);
	});

	self.addEventListener('fetch', () => {
		// Dev must never be served from the PWA cache.
	});
} else {
	self.addEventListener('install', (event) => {
		event.waitUntil(
			caches
				.open(CACHE_NAME)
				.then((cache) => cache.addAll(SHELL_ASSETS))
				.then(() => self.skipWaiting())
		);
	});

	self.addEventListener('activate', (event) => {
		event.waitUntil(
			caches
				.keys()
				.then((cacheNames) =>
					Promise.all(
						cacheNames
							.filter((cacheName) => cacheName !== CACHE_NAME)
							.map((cacheName) => caches.delete(cacheName))
					)
				)
				.then(() => self.clients.claim())
		);
	});

	self.addEventListener('fetch', (event) => {
		const { request } = event;

		if (request.method !== 'GET') {
			return;
		}

		const url = new URL(request.url);

		if (url.origin !== self.location.origin) {
			return;
		}

		if (request.mode === 'navigate') {
			event.respondWith(networkFirstNavigation(request));
			return;
		}

		if (
			CACHEABLE_DESTINATIONS.has(request.destination) ||
			url.pathname.includes('/_app/immutable/')
		) {
			event.respondWith(cacheFirst(request));
		}
	});
}

async function networkFirstNavigation(request) {
	const cache = await caches.open(CACHE_NAME);

	try {
		const response = await fetch(request);

		if (response.ok) {
			await cache.put(request, response.clone());
		}

		return response;
	} catch {
		const cachedResponse = await caches.match(request);

		if (cachedResponse) {
			return cachedResponse;
		}

		const shellResponse = await caches.match('./');

		if (shellResponse) {
			return shellResponse;
		}

		return new Response('Task Monster is offline. Reconnect to load this page.', {
			status: 503,
			headers: {
				'Content-Type': 'text/plain'
			}
		});
	}
}

async function cacheFirst(request) {
	const cachedResponse = await caches.match(request);

	if (cachedResponse) {
		return cachedResponse;
	}

	const response = await fetch(request);

	if (response.ok) {
		const cache = await caches.open(CACHE_NAME);
		await cache.put(request, response.clone());
	}

	return response;
}
