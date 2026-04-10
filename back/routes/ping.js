async function pingRoute(app) {
	app.get(
		'/ping',
		{
			config: {
				isPublic: true
			}
		},
		async () => ({
			ok: true
		})
	);
}

module.exports = pingRoute;
