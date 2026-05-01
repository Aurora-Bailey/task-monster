import { base } from '$app/paths';

export function normalizeAppPathname(pathname) {
	if (!base) {
		return pathname || '/';
	}

	if (pathname === base) {
		return '/';
	}

	if (pathname.startsWith(`${base}/`)) {
		return pathname.slice(base.length) || '/';
	}

	return pathname || '/';
}
