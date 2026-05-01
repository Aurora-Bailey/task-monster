const CACHE_NAME = 'task-monster-pwa-v1';
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

	if (CACHEABLE_DESTINATIONS.has(request.destination) || url.pathname.includes('/_app/immutable/')) {
		event.respondWith(cacheFirst(request));
	}
});

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
