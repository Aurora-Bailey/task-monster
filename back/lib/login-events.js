async function recordLoginEvent(
	db,
	{ userId = null, username = null, usernameLower, ipAddress, userAgent, outcome, now = new Date() }
) {
	await db.collection('login_events').insertOne({
		userId,
		username,
		usernameLower,
		ipAddress,
		userAgent: userAgent || null,
		outcome,
		createdAt: now
	});
}

module.exports = {
	recordLoginEvent
};
