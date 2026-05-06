const DEFAULT_THEME = 'light';

const THEME_IDS = [
	'light',
	'dark',
	'neo-candy-tokyo-night',
	'vampire-candy',
	'magica-pink',
	'candy-apple-green',
	'deep-earth',
	'cherry-sprout-in-earth',
	'candy-cloud',
	'deep-royal-purple-gold',
	'forbidden-apple',
	'black-widow',
	'kawaii',
	'spooky',
	'ancient-book',
	'tea-and-leaves',
	'metal',
	'hard-rock',
	'ancient-cavern-torch',
	'dark-lain',
	'ultraglow',
	'matrix-neo',
	'lain',
	'ultra-white'
];

const themeIds = new Set(THEME_IDS);

function isValidTheme(theme) {
	return themeIds.has(theme);
}

function normalizeTheme(theme) {
	return isValidTheme(theme) ? theme : DEFAULT_THEME;
}

module.exports = {
	DEFAULT_THEME,
	THEME_IDS,
	isValidTheme,
	normalizeTheme
};
