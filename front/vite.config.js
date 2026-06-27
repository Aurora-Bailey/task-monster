import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { loadEnv, defineConfig } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootEnvDir = resolve(__dirname, '..');

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, rootEnvDir, '');
	const allowedHost = process.env.PUBLIC_FRONTEND_HOST || env.PUBLIC_FRONTEND_HOST;

	return {
		envDir: rootEnvDir,
		plugins: [tailwindcss(), sveltekit()],
		server: allowedHost ? { allowedHosts: [allowedHost] } : undefined
	};
});
