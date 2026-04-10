function normalizeUsername(username) {
	return username.trim().toLowerCase();
}

function validateUsername(username) {
	return /^[a-zA-Z0-9_-]+$/.test(username);
}

module.exports = {
	normalizeUsername,
	validateUsername
};
