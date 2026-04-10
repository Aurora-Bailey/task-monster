import { base } from '$app/paths';
import { redirect } from '@sveltejs/kit';

export const csr = true;
export const prerender = false;

export function load() {
	throw redirect(307, `${base}/active`);
}
