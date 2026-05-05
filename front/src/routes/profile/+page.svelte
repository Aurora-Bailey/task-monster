<script>
	import { onMount } from 'svelte';

	import { readApiBody, readApiError } from '$lib/api';
	import { authorizedRequest, logoutAccount, revokeSession, session } from '$lib/session';
	import { THEMES, setTheme, theme } from '$lib/theme';

	const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
	});
	const themeGroups = [
		{
			id: 'light',
			label: 'Light',
			themes: THEMES.filter((themeOption) => themeOption.colorScheme === 'light')
		},
		{
			id: 'dark',
			label: 'Dark',
			themes: THEMES.filter((themeOption) => themeOption.colorScheme === 'dark')
		}
	];

	let isLoading = true;
	let loadError = '';
	let revokeError = '';
	let logoutError = '';
	let revokingSessionId = null;
	let isLoggingOut = false;
	let activeSessions = [];
	let loginAttempts = [];

	function formatDateTime(value) {
		return dateTimeFormatter.format(new Date(value));
	}

	function describeOutcome(outcome) {
		switch (outcome) {
			case 'success':
				return 'Success';
			case 'rate_limited':
				return 'Blocked';
			default:
				return 'Failed';
		}
	}

	function outcomeClass(outcome) {
		switch (outcome) {
			case 'success':
				return 'success-pill';
			case 'rate_limited':
				return 'blocked-pill';
			default:
				return 'failed-pill';
		}
	}

	function formatUserAgent(userAgent) {
		if (!userAgent) {
			return 'Unknown device';
		}

		return userAgent.length > 88 ? `${userAgent.slice(0, 88)}...` : userAgent;
	}

	function handleThemeSelect(themeId) {
		setTheme(themeId);
	}

	async function loadProfile() {
		isLoading = true;
		loadError = '';

		try {
			const [attemptsResponse, sessionsResponse] = await Promise.all([
				authorizedRequest('/login-attempts'),
				authorizedRequest('/sessions')
			]);

			if (!attemptsResponse.ok) {
				throw new Error(await readApiError(attemptsResponse, 'Unable to load login attempts.'));
			}

			if (!sessionsResponse.ok) {
				throw new Error(await readApiError(sessionsResponse, 'Unable to load active sessions.'));
			}

			const attemptsBody = await readApiBody(attemptsResponse);
			const sessionsBody = await readApiBody(sessionsResponse);

			loginAttempts = attemptsBody?.attempts ?? [];
			activeSessions = sessionsBody?.sessions ?? [];
		} catch (error) {
			loadError = error.message;
		} finally {
			isLoading = false;
		}
	}

	async function handleRevoke(sessionId) {
		revokeError = '';
		revokingSessionId = sessionId;

		try {
			const result = await revokeSession(sessionId);

			if (result?.revokedCurrentSession) {
				return;
			}

			activeSessions = activeSessions.filter((item) => item.id !== sessionId);
		} catch (error) {
			revokeError = error.message;
		} finally {
			revokingSessionId = null;
		}
	}

	async function handleLogout() {
		logoutError = '';
		isLoggingOut = true;

		try {
			await logoutAccount();
		} catch (error) {
			logoutError = error.message;
		} finally {
			isLoggingOut = false;
		}
	}

	onMount(() => {
		loadProfile();
	});
</script>

<svelte:head>
	<title>Profile</title>
	<meta name="description" content="Review recent login attempts and active sessions." />
</svelte:head>

<section class="profile-page app-page">
	<div class="section-divider section-divider--primary">
		<span></span>
		<h1>Profile</h1>
		<span></span>
	</div>

	<div class="hero">
		<h1>Account and session control</h1>
		<p class="lede">
			{$session.user?.username || 'Your account'} can review recent login traffic, see which sessions
			are still alive, and void any token from here.
		</p>
		<div class="hero-actions">
			<button
				class="profile-logout-button"
				type="button"
				disabled={isLoggingOut}
				onclick={handleLogout}
			>
				{isLoggingOut ? 'Logging out...' : 'Log out'}
			</button>
		</div>
		{#if logoutError}
			<p class="inline-error">{logoutError}</p>
		{/if}
	</div>

	<div class="section-divider">
		<span></span>
		<h2>Display</h2>
		<span></span>
	</div>

	<section class="panel theme-panel" aria-labelledby="theme-panel-heading">
		<div class="panel-header">
			<div>
				<p class="section-label">Display</p>
				<h2 id="theme-panel-heading">Theme engine</h2>
			</div>
			<span class="pill">Local only</span>
		</div>

		<p class="theme-copy">
			Pick the app skin for this browser. This only writes the selected theme key to local storage,
			not your account.
		</p>

		<div class="theme-sections" aria-label="Theme choices">
			{#each themeGroups as themeGroup}
				<section class="theme-group" aria-labelledby={`theme-group-${themeGroup.id}`}>
					<div class="theme-group__header">
						<h3 id={`theme-group-${themeGroup.id}`}>{themeGroup.label}</h3>
						<span>{themeGroup.themes.length} skins</span>
					</div>

					<div class="theme-grid">
						{#each themeGroup.themes as themeOption}
							<button
								class="theme-option"
								class:is-selected={$theme === themeOption.id}
								type="button"
								aria-pressed={$theme === themeOption.id}
								style={`--swatch-0: ${themeOption.swatch[0]}; --swatch-1: ${themeOption.swatch[1]}; --swatch-2: ${themeOption.swatch[2]};`}
								onclick={() => handleThemeSelect(themeOption.id)}
							>
								<span class="theme-swatch" aria-hidden="true">
									<span></span>
									<span></span>
									<span></span>
								</span>
								<span class="theme-option__text">
									<strong>{themeOption.label}</strong>
									<span>{themeOption.description}</span>
								</span>
							</button>
						{/each}
					</div>
				</section>
			{/each}
		</div>
	</section>

	<div class="section-divider">
		<span></span>
		<h2>Security</h2>
		<span></span>
	</div>

	{#if isLoading}
		<div class="page-loader" aria-label="Loading profile data">
			<span class="page-spinner" aria-hidden="true"></span>
		</div>
	{:else}
		{#if loadError}
			<div class="status-card error-card">
				<strong>Could not load the profile</strong>
				<p>{loadError}</p>
			</div>
		{/if}

		{#if revokeError}
			<div class="status-card error-card">
				<strong>Could not void that session</strong>
				<p>{revokeError}</p>
			</div>
		{/if}

		<div class="section-grid">
			<section class="panel">
				<div class="panel-header">
					<div>
						<p class="section-label">Sessions</p>
						<h2>Active tokens</h2>
					</div>
					<span class="pill">{activeSessions.length} live</span>
				</div>

				{#if activeSessions.length === 0}
					<div class="empty-card">
						<strong>No active sessions</strong>
						<p>There are no non-revoked tokens attached to this account right now.</p>
					</div>
				{:else}
					<div class="session-list">
						{#each activeSessions as item}
							<article class="session-card">
								<div class="session-topline">
									<div>
										<h3>
											{item.isCurrent ? 'This device' : `Session ending in ${item.tokenPreview}`}
										</h3>
										<p>{formatUserAgent(item.userAgent)}</p>
									</div>
									<span class:item-current={item.isCurrent} class="session-badge">
										{item.isCurrent ? 'Current' : 'Active'}
									</span>
								</div>

								<div class="session-meta">
									<div>
										<span>Created</span>
										<strong>{formatDateTime(item.createdAt)}</strong>
									</div>
									<div>
										<span>Last used</span>
										<strong>{formatDateTime(item.lastUsedAt)}</strong>
									</div>
									<div>
										<span>IP address</span>
										<strong>{item.lastUsedIp || 'Unknown'}</strong>
									</div>
								</div>

								<button
									class="void-button"
									type="button"
									disabled={revokingSessionId === item.id}
									onclick={() => handleRevoke(item.id)}
								>
									{#if revokingSessionId === item.id}
										Voiding...
									{:else if item.isCurrent}
										Log out this device
									{:else}
										Void session
									{/if}
								</button>
							</article>
						{/each}
					</div>
				{/if}
			</section>

			<section class="panel">
				<div class="panel-header">
					<div>
						<p class="section-label">Security</p>
						<h2>Recent login attempts</h2>
					</div>
					<span class="pill muted-pill">{loginAttempts.length} recent</span>
				</div>

				{#if loginAttempts.length === 0}
					<div class="empty-card">
						<strong>No attempts recorded yet</strong>
						<p>Once this account starts getting used, recent login traffic will show up here.</p>
					</div>
				{:else}
					<div class="attempt-list">
						{#each loginAttempts as attempt}
							<article class="attempt-card">
								<div class="attempt-topline">
									<div>
										<h3>{formatDateTime(attempt.createdAt)}</h3>
										<p>{formatUserAgent(attempt.userAgent)}</p>
									</div>
									<span class={`pill ${outcomeClass(attempt.outcome)}`}>
										{describeOutcome(attempt.outcome)}
									</span>
								</div>

								<div class="attempt-meta">
									<div>
										<span>IP address</span>
										<strong>{attempt.ipAddress || 'Unknown'}</strong>
									</div>
									<div>
										<span>Outcome</span>
										<strong>{describeOutcome(attempt.outcome)}</strong>
									</div>
								</div>
							</article>
						{/each}
					</div>
				{/if}
			</section>
		</div>
	{/if}
</section>

<style>
	.profile-page {
		display: grid;
		gap: 1.35rem;
	}

	.hero {
		display: grid;
		gap: 0.5rem;
		max-width: 42rem;
	}

	.section-label {
		margin: 0;
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--color-accent);
	}

	.hero h1,
	.panel h2,
	.session-card h3,
	.attempt-card h3 {
		margin: 0;
		text-align: left;
	}

	.hero h1 {
		font-size: clamp(2.2rem, 5vw, 3.8rem);
		line-height: 0.95;
		letter-spacing: -0.05em;
		color: var(--color-heading);
	}

	.panel h2 {
		font-size: 1.45rem;
	}

	.session-card h3,
	.attempt-card h3 {
		font-size: 1rem;
	}

	.lede,
	.theme-copy,
	.panel-header p:last-child,
	.session-topline p,
	.attempt-topline p,
	.status-card p,
	.empty-card p {
		margin: 0;
		color: var(--color-muted);
	}

	.hero-actions {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		margin-top: 0.15rem;
	}

	.profile-logout-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 2.7rem;
		padding: 0.72rem 1rem;
		border: 1px solid color-mix(in srgb, var(--color-danger) 24%, var(--surface-border));
		border-radius: 999px;
		background: color-mix(in srgb, var(--color-danger) 10%, var(--surface-1));
		box-shadow: var(--surface-shadow);
		color: var(--color-danger);
		font-size: 0.76rem;
		font-weight: 900;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		cursor: pointer;
		transition:
			transform 0.16s ease,
			border-color 0.16s ease,
			box-shadow 0.16s ease;
	}

	.profile-logout-button:hover {
		transform: translateY(-1px);
		border-color: color-mix(in srgb, var(--color-danger) 44%, var(--surface-border));
		box-shadow: var(--surface-shadow-strong);
	}

	.profile-logout-button:disabled {
		cursor: wait;
		opacity: 0.72;
		transform: none;
	}

	.inline-error {
		margin: 0;
		font-size: 0.82rem;
		font-weight: 700;
		color: var(--color-danger);
	}

	.section-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
	}

	.panel,
	.status-card,
	.empty-card,
	.session-card,
	.attempt-card {
		background: var(--surface-1);
		border: 1px solid var(--surface-border);
		box-shadow: var(--surface-shadow);
	}

	.panel {
		display: grid;
		gap: 1rem;
		padding: 1.2rem;
		border-radius: 26px;
		align-content: start;
	}

	.theme-panel {
		gap: 1.1rem;
	}

	.theme-sections {
		display: grid;
		gap: 1.15rem;
	}

	.theme-group {
		display: grid;
		gap: 0.65rem;
	}

	.theme-group__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0 0.1rem;
	}

	.theme-group__header h3 {
		color: var(--color-heading);
		font-size: 0.88rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.theme-group__header span {
		color: var(--color-soft);
		font-size: 0.74rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.theme-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.85rem;
	}

	.theme-option {
		display: grid;
		grid-template-columns: auto 1fr;
		align-items: center;
		gap: 0.8rem;
		min-height: 5.35rem;
		padding: 0.85rem;
		border-radius: 22px;
		border: 1px solid var(--surface-border);
		background:
			linear-gradient(
				135deg,
				color-mix(in srgb, var(--swatch-2) 10%, transparent),
				transparent 48%
			),
			var(--surface-2);
		box-shadow: var(--surface-shadow);
		text-align: left;
		cursor: pointer;
		transition:
			transform 0.16s ease,
			border-color 0.16s ease,
			box-shadow 0.16s ease,
			background-color 0.16s ease;
	}

	.theme-option:hover {
		transform: translateY(-1px);
		border-color: color-mix(in srgb, var(--swatch-2) 40%, var(--surface-border));
		box-shadow: var(--surface-shadow-strong);
	}

	.theme-option:focus-visible {
		outline: none;
		box-shadow:
			0 0 0 4px color-mix(in srgb, var(--swatch-2) 22%, transparent),
			var(--surface-shadow-strong);
	}

	.theme-option.is-selected {
		border-color: color-mix(in srgb, var(--swatch-2) 62%, var(--surface-border));
		background:
			linear-gradient(
				135deg,
				color-mix(in srgb, var(--swatch-2) 18%, transparent),
				transparent 54%
			),
			var(--surface-3);
		box-shadow:
			0 0 0 1px color-mix(in srgb, var(--swatch-2) 20%, transparent),
			var(--surface-shadow-strong);
	}

	.theme-swatch {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		width: 3.4rem;
		height: 3.4rem;
		overflow: hidden;
		border-radius: 999px;
		border: 1px solid color-mix(in srgb, var(--swatch-2) 28%, var(--surface-border));
		box-shadow: var(--surface-inset);
	}

	.theme-swatch span:nth-child(1) {
		background: var(--swatch-0);
	}

	.theme-swatch span:nth-child(2) {
		background: var(--swatch-1);
	}

	.theme-swatch span:nth-child(3) {
		background: var(--swatch-2);
	}

	.theme-option__text {
		display: grid;
		gap: 0.22rem;
	}

	.theme-option__text strong {
		color: var(--color-heading);
		font-size: 0.92rem;
		line-height: 1.1;
	}

	.theme-option__text span {
		color: var(--color-muted);
		font-size: 0.78rem;
		line-height: 1.28;
	}

	.panel-header,
	.session-topline,
	.attempt-topline {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	.pill {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.45rem 0.7rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--color-accent) 14%, transparent);
		color: var(--color-accent);
		font-size: 0.74rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.muted-pill {
		background: var(--surface-muted);
		color: var(--color-muted);
	}

	.success-pill {
		background: color-mix(in srgb, var(--color-success) 16%, transparent);
		color: var(--color-success);
	}

	.failed-pill {
		background: color-mix(in srgb, var(--color-danger) 14%, transparent);
		color: var(--color-danger);
	}

	.blocked-pill {
		background: color-mix(in srgb, var(--color-warning) 16%, transparent);
		color: var(--color-warning);
	}

	.status-card,
	.empty-card {
		padding: 1rem 1.05rem;
		border-radius: 20px;
	}

	.status-card strong,
	.empty-card strong {
		display: block;
		margin-bottom: 0.35rem;
	}

	.error-card {
		border-color: color-mix(in srgb, var(--color-danger) 22%, var(--surface-border));
		background: color-mix(in srgb, var(--color-danger) 8%, var(--surface-1));
	}

	.session-list,
	.attempt-list {
		display: grid;
		gap: 0.85rem;
	}

	.session-card,
	.attempt-card {
		display: grid;
		gap: 0.9rem;
		padding: 1rem;
		border-radius: 20px;
	}

	.session-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.4rem 0.65rem;
		border-radius: 999px;
		background: var(--surface-muted);
		color: var(--color-muted);
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.session-badge.item-current {
		background: color-mix(in srgb, var(--color-accent) 14%, transparent);
		color: var(--color-accent);
	}

	.session-meta,
	.attempt-meta {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.8rem;
	}

	.attempt-meta {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.session-meta span,
	.attempt-meta span {
		display: block;
		margin-bottom: 0.28rem;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-soft);
	}

	.session-meta strong,
	.attempt-meta strong {
		font-size: 0.94rem;
		color: var(--color-heading);
	}

	.void-button {
		justify-self: start;
		padding: 0.78rem 1rem;
		border: 0;
		border-radius: 999px;
		background: var(--control-gradient);
		color: var(--color-accent-contrast);
		font-size: 0.76rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		box-shadow: var(--surface-shadow);
		cursor: pointer;
	}

	.void-button:disabled {
		cursor: wait;
		opacity: 0.7;
	}

	@media (max-width: 860px) {
		.section-grid {
			grid-template-columns: 1fr;
		}

		.theme-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 640px) {
		.theme-grid {
			grid-template-columns: 1fr;
		}

		.session-meta,
		.attempt-meta {
			grid-template-columns: 1fr;
		}

		.panel-header,
		.session-topline,
		.attempt-topline {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>
