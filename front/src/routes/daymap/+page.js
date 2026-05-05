import { redirect } from '@sveltejs/kit';

export const csr = true;

export function load() {
	throw redirect(307, '/tasks');
}
