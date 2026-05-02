import { browser } from '$app/environment';
import { writable } from 'svelte/store';

export const THEME_STORAGE_KEY = 'task_monster_theme';

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
		id: 'candy-cloud',
		label: 'Candy Cloud',
		description: 'Cotton-candy sky, peach glow, and blue-sugar glass.',
		swatch: ['#f8ecff', '#d8f4ff', '#ff7cb8'],
		themeColor: '#d8f4ff',
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

function getThemeDefinition(themeId) {
	return THEMES.find((item) => item.id === themeId) ?? defaultTheme;
}

function normalizeTheme(themeId) {
	return themeIds.has(themeId) ? themeId : defaultTheme.id;
}

function readStoredTheme() {
	if (!browser) {
		return defaultTheme.id;
	}

	return normalizeTheme(localStorage.getItem(THEME_STORAGE_KEY));
}

function updateThemeColor(themeDefinition) {
	const meta = document.querySelector('meta[name="theme-color"]');

	if (meta) {
		meta.setAttribute('content', themeDefinition.themeColor);
	}
}

export function applyTheme(themeId, { persist = false } = {}) {
	const normalizedThemeId = normalizeTheme(themeId);
	const themeDefinition = getThemeDefinition(normalizedThemeId);

	theme.set(normalizedThemeId);

	if (!browser) {
		return normalizedThemeId;
	}

	document.documentElement.dataset.theme = normalizedThemeId;
	document.documentElement.style.colorScheme = themeDefinition.colorScheme;
	updateThemeColor(themeDefinition);

	if (persist) {
		localStorage.setItem(THEME_STORAGE_KEY, normalizedThemeId);
	}

	return normalizedThemeId;
}

export function initializeTheme() {
	return applyTheme(readStoredTheme());
}

export function setTheme(themeId) {
	return applyTheme(themeId, { persist: true });
}
