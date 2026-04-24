const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const ROOT_ENV_PATH = resolve(__dirname, '../../.env');

let hasLoadedRootEnv = false;

function parseEnvFileContents(contents) {
	const parsed = {};
	const lines = contents.split(/\r?\n/);

	for (const rawLine of lines) {
		const line = rawLine.trim();

		if (!line || line.startsWith('#')) {
			continue;
		}

		const match = rawLine.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);

		if (!match) {
			continue;
		}

		const [, key, rawValue] = match;
		let value = rawValue;
		const isDoubleQuoted = value.startsWith('"') && value.endsWith('"');
		const isSingleQuoted = value.startsWith("'") && value.endsWith("'");

		if (isDoubleQuoted || isSingleQuoted) {
			value = value.slice(1, -1);
		}

		parsed[key] = value;
	}

	return parsed;
}

function loadRootEnv() {
	if (hasLoadedRootEnv) {
		return;
	}

	hasLoadedRootEnv = true;

	if (!existsSync(ROOT_ENV_PATH)) {
		return;
	}

	const parsed = parseEnvFileContents(readFileSync(ROOT_ENV_PATH, 'utf8'));

	for (const [key, value] of Object.entries(parsed)) {
		if (process.env[key] === undefined) {
			process.env[key] = value;
		}
	}
}

module.exports = {
	loadRootEnv
};
