<script>
	import { onMount } from 'svelte';

	import { readApiBody, readApiError } from '$lib/api';
	import { authorizedRequest, revokeSession, session } from '$lib/session';

	const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
	});

	let isLoading = true;
	let loadError = '';
	let revokeError = '';
	let revokingSessionId = null;
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

	onMount(() => {
		loadProfile();
	});
</script>

<svelte:head>
	<title>Profile</title>
	<meta name="description" content="Review recent login attempts and active sessions." />
</svelte:head>

<section class="profile-page">
	<div class="hero">
		<p class="eyebrow">Profile</p>
		<h1>Account and session control</h1>
		<p class="lede">
			{$session.user?.username || 'Your account'} can review recent login traffic, see which
			sessions are still alive, and void any token from here.
		</p>
	</div>

	{#if isLoading}
		<div class="status-card">
			<strong>Loading profile data</strong>
			<p>Pulling your session list and recent login attempts.</p>
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
										<h3>{item.isCurrent ? 'This device' : `Session ending in ${item.tokenPreview}`}</h3>
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
		padding: 1.4rem 0 2.6rem;
	}

	.hero {
		display: grid;
		gap: 0.5rem;
		max-width: 42rem;
	}

	.eyebrow,
	.section-label {
		margin: 0;
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--color-theme-2);
	}

	h1,
	h2,
	h3 {
		margin: 0;
		text-align: left;
	}

	h1 {
		font-size: clamp(2.2rem, 5vw, 3.8rem);
		line-height: 0.95;
		letter-spacing: -0.05em;
		color: rgba(10, 20, 30, 0.92);
	}

	h2 {
		font-size: 1.45rem;
	}

	h3 {
		font-size: 1rem;
	}

	.lede,
	.panel-header p:last-child,
	.session-topline p,
	.attempt-topline p,
	.status-card p,
	.empty-card p {
		margin: 0;
		color: rgba(10, 20, 30, 0.66);
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
		background: rgba(255, 255, 255, 0.64);
		border: 1px solid rgba(255, 255, 255, 0.74);
		box-shadow: 0 18px 36px rgba(44, 62, 80, 0.08);
	}

	.panel {
		display: grid;
		gap: 1rem;
		padding: 1.2rem;
		border-radius: 26px;
		align-content: start;
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
		background: rgba(64, 117, 166, 0.12);
		color: var(--color-theme-2);
		font-size: 0.74rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.muted-pill {
		background: rgba(13, 24, 36, 0.08);
		color: rgba(13, 24, 36, 0.62);
	}

	.success-pill {
		background: rgba(67, 142, 94, 0.16);
		color: #2d6d44;
	}

	.failed-pill {
		background: rgba(175, 68, 56, 0.14);
		color: #9f2d27;
	}

	.blocked-pill {
		background: rgba(191, 121, 31, 0.16);
		color: #9a5e12;
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
		border-color: rgba(159, 45, 39, 0.18);
		background: rgba(255, 245, 244, 0.92);
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
		background: rgba(13, 24, 36, 0.08);
		color: rgba(13, 24, 36, 0.6);
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.session-badge.item-current {
		background: rgba(64, 117, 166, 0.14);
		color: var(--color-theme-2);
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
		color: rgba(13, 24, 36, 0.46);
	}

	.session-meta strong,
	.attempt-meta strong {
		font-size: 0.94rem;
		color: rgba(10, 20, 30, 0.88);
	}

	.void-button {
		justify-self: start;
		padding: 0.78rem 1rem;
		border: 0;
		border-radius: 999px;
		background: linear-gradient(135deg, rgba(13, 24, 36, 0.9), rgba(44, 62, 80, 0.82));
		color: white;
		font-size: 0.76rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		box-shadow: 0 14px 28px rgba(44, 62, 80, 0.16);
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
	}

	@media (max-width: 640px) {
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
