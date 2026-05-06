import { browser } from '$app/environment';
import { writable } from 'svelte/store';

export const THEME_STORAGE_KEY = 'task_monster_theme';
const SESSION_STORAGE_KEY = 'task_monster_session_token';
const SESSION_ACCOUNTS_STORAGE_KEY = 'task_monster_session_accounts';
const SESSION_COOKIE_NAME = 'task_monster_session_token';

export const THEMES = [
	{
		id: 'light',
		label: 'Light mode',
		description: 'Soft daylight glass with the original blue accent.',
		swatch: ['#cbd8e4', '#f4f7fb', '#4075a6'],
		themeColor: '#4075a6',
		colorScheme: 'light'
	},
	{
		id: 'dark',
		label: 'Dark mode',
		description: 'Low-glare charcoal with cool blue control lights.',
		swatch: ['#07111d', '#111b2a', '#7ab7ff'],
		themeColor: '#111b2a',
		colorScheme: 'dark'
	},
	{
		id: 'neo-candy-tokyo-night',
		label: 'Neo Candy Tokyo Night',
		description: 'Electric cyan, hot candy pink, and midnight glass.',
		swatch: ['#08091f', '#ff3bc8', '#29f1ff'],
		themeColor: '#08091f',
		colorScheme: 'dark'
	},
	{
		id: 'vampire-candy',
		label: 'Vampire Candy',
		description: 'Black cherry, blood red, and polished sugar highlights.',
		swatch: ['#14030b', '#7b1238', '#ff7ab8'],
		themeColor: '#14030b',
		colorScheme: 'dark'
	},
	{
		id: 'magica-pink',
		label: 'Magica Pink',
		description: 'Dreamy rose gradients with a violet-pink accent.',
		swatch: ['#ffe5f3', '#fff7fc', '#d9369b'],
		themeColor: '#d9369b',
		colorScheme: 'light'
	},
	{
		id: 'candy-apple-green',
		label: 'Candy Apple Green',
		description: 'Glossy orchard greens with a sharp lime candy shell.',
		swatch: ['#e6ffd8', '#7ce13a', '#145f2f'],
		themeColor: '#7ce13a',
		colorScheme: 'light'
	},
	{
		id: 'deep-earth',
		label: 'Deep Earth',
		description: 'Charred soil, cedar shadows, moss, and amber heat.',
		swatch: ['#17110c', '#4f3825', '#d1964a'],
		themeColor: '#17110c',
		colorScheme: 'dark'
	},
	{
		id: 'cherry-sprout-in-earth',
		label: 'Cherry Sprout in Earth',
		description: 'Black soil, cherry skin, and tiny spring-green signals.',
		swatch: ['#0b0706', '#8f1d2c', '#8fd36b'],
		themeColor: '#0b0706',
		colorScheme: 'dark'
	},
	{
		id: 'candy-cloud',
		label: 'Candy Cloud',
		description: 'Cotton-candy sky, peach glow, and blue-sugar glass.',
		swatch: ['#f8ecff', '#d8f4ff', '#ff7cb8'],
		themeColor: '#d8f4ff',
		colorScheme: 'light'
	},
	{
		id: 'deep-royal-purple-gold',
		label: 'Deep Royal Purple Gold',
		description: 'Velvet purple halls with molten gold command lights.',
		swatch: ['#14051f', '#5b2a86', '#f2c14e'],
		themeColor: '#14051f',
		colorScheme: 'dark'
	},
	{
		id: 'forbidden-apple',
		label: 'Forbidden Apple',
		description: 'Poisoned orchard shadows, enamel red, and serpent green.',
		swatch: ['#090506', '#d71935', '#7adf5a'],
		themeColor: '#090506',
		colorScheme: 'dark'
	},
	{
		id: 'black-widow',
		label: 'Black Widow',
		description: 'Gloss-black webbing, venom red, and cold silver edges.',
		swatch: ['#050507', '#c1121f', '#d8dbe2'],
		themeColor: '#050507',
		colorScheme: 'dark'
	},
	{
		id: 'kawaii',
		label: 'Kawaii',
		description: 'Strawberry milk, soft lilac, and bubblegum controls.',
		swatch: ['#ffe7f3', '#f7d9ff', '#ff6fb1'],
		themeColor: '#ffe7f3',
		colorScheme: 'light'
	},
	{
		id: 'spooky',
		label: 'Spooky',
		description: 'Pumpkin glow, ghost fog, and purple midnight glass.',
		swatch: ['#120819', '#ff8a1f', '#8b5cf6'],
		themeColor: '#120819',
		colorScheme: 'dark'
	},
	{
		id: 'ancient-book',
		label: 'Ancient Book',
		description: 'Aged parchment, walnut ink, and illuminated margins.',
		swatch: ['#ead8b8', '#8b5e34', '#3b2a1a'],
		themeColor: '#ead8b8',
		colorScheme: 'light'
	},
	{
		id: 'tea-and-leaves',
		label: 'Tea and Leaves',
		description: 'Matcha steam, pressed leaves, and ceramic cream.',
		swatch: ['#f1ecd7', '#76925c', '#2f4f2f'],
		themeColor: '#f1ecd7',
		colorScheme: 'light'
	},
	{
		id: 'metal',
		label: 'Metal',
		description: 'Brushed graphite, chrome highlights, and blue arc light.',
		swatch: ['#101318', '#7d8793', '#9fd4ff'],
		themeColor: '#101318',
		colorScheme: 'dark'
	},
	{
		id: 'hard-rock',
		label: 'Hard Rock',
		description: 'Stage black, amplifier red, amber bulbs, and worn leather.',
		swatch: ['#090706', '#d72638', '#f7b538'],
		themeColor: '#090706',
		colorScheme: 'dark'
	},
	{
		id: 'ancient-cavern-torch',
		label: 'Ancient Cavern Torch',
		description: 'Basalt cave walls, torchlit amber, and mineral teal.',
		swatch: ['#06080a', '#d9822b', '#4fb7a5'],
		themeColor: '#06080a',
		colorScheme: 'dark'
	},
	{
		id: 'dark-lain',
		label: 'Dark Lain',
		description: 'Black CRT glass, signal green, and cold terminal static.',
		swatch: ['#050805', '#00d889', '#dce8df'],
		themeColor: '#050805',
		colorScheme: 'dark'
	},
	{
		id: 'ultraglow',
		label: 'Ultraglow',
		description: 'Overcharged violet darkness with cyan and acid-pink bloom.',
		swatch: ['#070416', '#20f6ff', '#ff2efb'],
		themeColor: '#070416',
		colorScheme: 'dark'
	},
	{
		id: 'matrix-neo',
		label: 'Matrix Neo',
		description: 'Digital black, code rain green, and pale machine light.',
		swatch: ['#020703', '#00ff77', '#9de8b4'],
		themeColor: '#020703',
		colorScheme: 'dark'
	},
	{
		id: 'lain',
		label: 'Lain',
		description: 'Washed monitor whites, wired shadows, and signal green.',
		swatch: ['#edf0ec', '#11151c', '#00a676'],
		themeColor: '#edf0ec',
		colorScheme: 'light'
	},
	{
		id: 'ultra-white',
		label: 'Ultra White',
		description: 'Clean white canvas, soft silver borders, minimal chroma.',
		swatch: ['#ffffff', '#f7f8fb', '#111827'],
		themeColor: '#ffffff',
		colorScheme: 'light'
	}
];

const themeIds = new Set(THEMES.map((item) => item.id));
const defaultTheme = THEMES[0];

export const theme = writable(defaultTheme.id);

export function getThemeDefinition(themeId) {
	return THEMES.find((item) => item.id === themeId) ?? defaultTheme;
}

export function normalizeTheme(themeId) {
	return themeIds.has(themeId) ? themeId : defaultTheme.id;
}

function parseCookieValue(name) {
	const cookie = document.cookie
		.split(';')
		.map((part) => part.trim())
		.find((part) => part.startsWith(`${name}=`));

	if (!cookie) {
		return null;
	}

	return decodeURIComponent(cookie.slice(name.length + 1));
}

function readCachedAccountTheme() {
	const activeToken =
		parseCookieValue(SESSION_COOKIE_NAME) || localStorage.getItem(SESSION_STORAGE_KEY) || '';
	let accounts = [];

	try {
		const parsedAccounts = JSON.parse(localStorage.getItem(SESSION_ACCOUNTS_STORAGE_KEY) || '[]');
		accounts = Array.isArray(parsedAccounts) ? parsedAccounts : [];
	} catch {
		accounts = [];
	}

	if (!activeToken) {
		return null;
	}

	const activeAccount = accounts.find((account) => account?.token === activeToken);

	return activeAccount?.user?.theme ?? null;
}

function readStoredTheme() {
	if (!browser) {
		return defaultTheme.id;
	}

	return normalizeTheme(readCachedAccountTheme() || localStorage.getItem(THEME_STORAGE_KEY));
}

function updateThemeColor(themeDefinition) {
	const meta = document.querySelector('meta[name="theme-color"]');

	if (meta) {
		meta.setAttribute('content', themeDefinition.themeColor);
	}
}

export function applyTheme(themeId, { cache = false, persist = false } = {}) {
	const normalizedThemeId = normalizeTheme(themeId);
	const themeDefinition = getThemeDefinition(normalizedThemeId);

	theme.set(normalizedThemeId);

	if (!browser) {
		return normalizedThemeId;
	}

	document.documentElement.dataset.theme = normalizedThemeId;
	document.documentElement.style.colorScheme = themeDefinition.colorScheme;
	updateThemeColor(themeDefinition);

	if (cache || persist) {
		localStorage.setItem(THEME_STORAGE_KEY, normalizedThemeId);
	}

	return normalizedThemeId;
}

export function cacheTheme(themeId) {
	return applyTheme(themeId, { cache: true });
}

export function initializeTheme() {
	return applyTheme(readStoredTheme());
}

export function setTheme(themeId) {
	return applyTheme(themeId);
}
