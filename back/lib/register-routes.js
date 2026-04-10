const { readdirSync } = require('node:fs');
const { join } = require('node:path');

function collectRouteFiles(directoryPath) {
	const entries = readdirSync(directoryPath, {
		withFileTypes: true
	});

	return entries
		.sort((left, right) => left.name.localeCompare(right.name))
		.flatMap((entry) => {
			const fullPath = join(directoryPath, entry.name);

			if (entry.isDirectory()) {
				return collectRouteFiles(fullPath);
			}

			if (entry.isFile() && entry.name.endsWith('.js')) {
				return [fullPath];
			}

			return [];
		});
}

async function registerRoutes(app, routesDirectory) {
	const routeFiles = collectRouteFiles(routesDirectory);

	for (const routeFile of routeFiles) {
		const registerRoute = require(routeFile);

		if (typeof registerRoute !== 'function') {
			throw new TypeError(`Route file must export a function: ${routeFile}`);
		}

		await app.register(registerRoute);
	}
}

module.exports = {
	registerRoutes
};
