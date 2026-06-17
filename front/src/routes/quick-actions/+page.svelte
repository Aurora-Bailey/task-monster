<script>
	import { onMount } from 'svelte';

	import PageContentReveal from '$lib/PageContentReveal.svelte';
	import {
		QUICK_ACTIONS_DOCS_API_BASE_URL,
		createQuickToken,
		loadQuickTokens,
		revokeQuickToken
	} from '$lib/quick-actions-client';

	const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
	});
	const rememberedTokenStorageKey = 'task_monster_quick_action_raw_tokens';
	const placeholderToken = 'tmq_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
	const supportLinks = [
		{
			label: 'Request an API from Shortcuts',
			href: 'https://support.apple.com/guide/shortcuts/request-your-first-api-apd58d46713f/ios'
		},
		{
			label: 'Run shortcuts with Siri',
			href: 'https://support.apple.com/guide/shortcuts/run-shortcuts-with-siri-apd07c25bb38/ios'
		},
		{
			label: 'Run shortcuts with the Action button',
			href: 'https://support.apple.com/en-hk/guide/shortcuts/apdfea15680b/ios'
		},
		{
			label: 'Run shortcuts from a widget',
			href: 'https://support.apple.com/guide/shortcuts/run-shortcuts-from-the-home-screen-widget-apd029b36d05/ios'
		},
		{
			label: 'Run shortcuts from Apple Watch',
			href: 'https://support.apple.com/guide/shortcuts/run-shortcuts-from-apple-watch-apd5888b0858/ios'
		},
		{
			label: 'Use shortcuts on Apple Watch',
			href: 'https://support.apple.com/guide/watch/shortcuts-apd99050d435/watchos'
		},
		{
			label: 'Add a shortcut to the Home Screen',
			href: 'https://support.apple.com/guide/shortcuts/add-a-shortcut-to-the-home-screen-apd735880972/ios'
		},
		{
			label: 'Add watch face complications',
			href: 'https://support.apple.com/guide/watch/add-complications-to-the-watch-face-apd8d0b9c582/watchos'
		}
	];

	let tokens = [];
	let isLoading = true;
	let loadError = '';
	let actionError = '';
	let createSuccess = '';
	let tokenLabel = 'iPhone + Watch';
	let generatedToken = '';
	let generatedTokenId = '';
	let rememberedRawTokens = {};
	let isCreating = false;
	let revokingTokenId = null;
	let copiedKey = '';

	$: rememberedActiveToken = tokens.find((token) => rememberedRawTokens[token.id]);
	$: rememberedDocsToken = rememberedActiveToken
		? rememberedRawTokens[rememberedActiveToken.id]
		: '';
	$: docsToken = generatedToken || rememberedDocsToken || placeholderToken;
	$: docsTokenIsReal = docsToken !== placeholderToken;
	$: stopUrl = `${QUICK_ACTIONS_DOCS_API_BASE_URL}/api/quick/stop`;
	$: nextUrl = `${QUICK_ACTIONS_DOCS_API_BASE_URL}/api/quick/next`;
	$: curlStop = `curl -X POST "${stopUrl}" \\
  -H "Authorization: Bearer ${docsToken}" \\
  -H "Content-Type: application/json" \\
  --data '{}'`;
	$: curlNext = `curl -X POST "${nextUrl}" \\
  -H "Authorization: Bearer ${docsToken}" \\
  -H "Content-Type: application/json" \\
  --data '{}'`;
	$: shortcutHeaders = `Authorization: Bearer ${docsToken}
Content-Type: application/json`;
	$: messageKey = 'message';
	$: stopBody = `{
  "source": "ios_shortcut",
  "action": "stop"
}`;
	$: nextBody = `{
  "source": "ios_shortcut",
  "action": "next"
}`;

	function formatDateTime(value) {
		return value ? dateTimeFormatter.format(new Date(value)) : 'Never';
	}

	function formatScopes(scopes) {
		return scopes.length > 0 ? scopes.join(', ') : 'No scopes';
	}

	function readRememberedRawTokens() {
		if (typeof localStorage === 'undefined') {
			return {};
		}

		try {
			const parsed = JSON.parse(localStorage.getItem(rememberedTokenStorageKey) || '{}');

			if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
				return {};
			}

			return Object.fromEntries(
				Object.entries(parsed).filter(
					([tokenId, rawToken]) =>
						typeof tokenId === 'string' &&
						tokenId.length > 0 &&
						typeof rawToken === 'string' &&
						rawToken.startsWith('tmq_live_')
				)
			);
		} catch {
			return {};
		}
	}

	function writeRememberedRawTokens(nextTokens) {
		rememberedRawTokens = nextTokens;

		if (typeof localStorage === 'undefined') {
			return;
		}

		try {
			localStorage.setItem(rememberedTokenStorageKey, JSON.stringify(nextTokens));
		} catch {
			// The in-memory copy still keeps this page's examples usable.
		}
	}

	function rememberRawToken(tokenId, rawToken) {
		if (!tokenId || !rawToken) {
			return;
		}

		writeRememberedRawTokens({
			...rememberedRawTokens,
			[tokenId]: rawToken
		});
	}

	function forgetRawToken(tokenId) {
		if (!rememberedRawTokens[tokenId]) {
			return;
		}

		const nextTokens = { ...rememberedRawTokens };
		delete nextTokens[tokenId];
		writeRememberedRawTokens(nextTokens);
	}

	function pruneRememberedRawTokens(activeTokens) {
		const activeTokenIds = new Set(activeTokens.map((token) => token.id));
		const nextTokens = Object.fromEntries(
			Object.entries(rememberedRawTokens).filter(([tokenId]) => activeTokenIds.has(tokenId))
		);

		if (Object.keys(nextTokens).length !== Object.keys(rememberedRawTokens).length) {
			writeRememberedRawTokens(nextTokens);
		}
	}

	async function loadTokens() {
		isLoading = true;
		loadError = '';

		try {
			const loadedTokens = await loadQuickTokens();
			tokens = loadedTokens;
			pruneRememberedRawTokens(loadedTokens);
		} catch (error) {
			loadError = error.message;
		} finally {
			isLoading = false;
		}
	}

	async function handleCreateToken(event) {
		event.preventDefault();
		actionError = '';
		createSuccess = '';
		generatedToken = '';
		generatedTokenId = '';
		isCreating = true;

		try {
			const result = await createQuickToken({
				label: tokenLabel
			});

			generatedToken = result.rawToken;
			generatedTokenId = result.token.id;
			rememberRawToken(result.token.id, result.rawToken);
			tokens = [result.token, ...tokens.filter((token) => token.id !== result.token.id)];
			createSuccess = 'Token created. This browser will use it in the copy examples below.';
		} catch (error) {
			actionError = error.message;
		} finally {
			isCreating = false;
		}
	}

	async function handleRevokeToken(tokenId) {
		actionError = '';
		revokingTokenId = tokenId;

		try {
			await revokeQuickToken(tokenId);
			tokens = tokens.filter((token) => token.id !== tokenId);
			forgetRawToken(tokenId);

			if (generatedTokenId === tokenId) {
				generatedToken = '';
				generatedTokenId = '';
			}
		} catch (error) {
			actionError = error.message;
		} finally {
			revokingTokenId = null;
		}
	}

	async function copyText(key, text) {
		if (!navigator?.clipboard) {
			actionError = 'Clipboard access is not available in this browser.';
			return;
		}

		try {
			await navigator.clipboard.writeText(text);
			copiedKey = key;
			window.setTimeout(() => {
				if (copiedKey === key) {
					copiedKey = '';
				}
			}, 1600);
		} catch {
			actionError = 'Unable to copy to clipboard.';
		}
	}

	onMount(() => {
		rememberedRawTokens = readRememberedRawTokens();
		void loadTokens();
	});
</script>

<svelte:head>
	<title>Quick Actions</title>
	<meta
		name="description"
		content="Create and manage Task Monster shortcut tokens for iPhone and Apple Watch."
	/>
</svelte:head>

<section class="quick-page app-page">
	<div class="section-divider section-divider--primary">
		<span></span>
		<h1>Quick Actions</h1>
		<span></span>
	</div>

	<div class="hero">
		<p class="section-label">Shortcut tokens</p>
		<h1>One tap. One backend call.</h1>
		<p class="lede">
			Create a limited token for iOS Shortcuts and Apple Watch. The token can only call quick stop
			and quick next. Both mark active tasks done, and the backend derives your account from the
			token.
		</p>
	</div>

	{#if isLoading}
		<div class="page-loader" aria-label="Loading shortcut tokens">
			<span class="page-spinner" aria-hidden="true"></span>
		</div>
	{:else}
		<PageContentReveal className="page-content-stack">
			{#if loadError}
				<div class="status-card error-card">
					<strong>Could not load shortcut tokens</strong>
					<p>{loadError}</p>
				</div>
			{/if}

			{#if actionError}
				<div class="status-card error-card">
					<strong>Action failed</strong>
					<p>{actionError}</p>
				</div>
			{/if}

			<section class="panel generate-panel" aria-labelledby="generate-heading">
				<div class="panel-header">
					<div>
						<p class="section-label">Create</p>
						<h2 id="generate-heading">Generate a shortcut token</h2>
					</div>
					<span class="pill">Limited</span>
				</div>

				<p class="panel-copy">
					Name the device pair, generate the token, then paste the raw value into Apple Shortcuts.
					The backend only stores a hash; this browser remembers the raw token for the examples.
				</p>

				<form class="token-form" onsubmit={handleCreateToken}>
					<label class="field-label">
						<span>Label</span>
						<input
							bind:value={tokenLabel}
							class="text-input"
							type="text"
							maxlength="80"
							placeholder="iPhone + Watch"
							disabled={isCreating}
						/>
					</label>

					<button class="primary-button" type="submit" disabled={isCreating}>
						{isCreating ? 'Generating...' : 'Generate token'}
					</button>
				</form>

				{#if createSuccess}
					<div class="status-card success-card" role="status">
						<strong>{createSuccess}</strong>
						<p>Revoking the token removes this browser's remembered copy.</p>
					</div>
				{/if}

				{#if generatedToken}
					<div class="copy-box token-copy-box">
						<div class="copy-box__header">
							<span>Raw token</span>
							<button type="button" onclick={() => copyText('raw-token', generatedToken)}>
								{copiedKey === 'raw-token' ? 'Copied' : 'Copy'}
							</button>
						</div>
						<pre><code>{generatedToken}</code></pre>
					</div>
				{/if}
			</section>

			<section class="panel" aria-labelledby="active-tokens-heading">
				<div class="panel-header">
					<div>
						<p class="section-label">Active</p>
						<h2 id="active-tokens-heading">Shortcut tokens</h2>
					</div>
					<span class="pill muted-pill">{tokens.length} live</span>
				</div>

				{#if tokens.length === 0}
					<div class="empty-card">
						<strong>No shortcut tokens</strong>
						<p>Generate one token for your iPhone and Apple Watch shortcuts.</p>
					</div>
				{:else}
					<div class="token-list">
						{#each tokens as token}
							<article class="token-card">
								<div class="token-card__topline">
									<div>
										<h3>{token.label}</h3>
										<p>Ending in {token.tokenPreview}</p>
									</div>
									<span class="token-badge">Active</span>
								</div>

								<div class="token-meta">
									<div>
										<span>Scopes</span>
										<strong>{formatScopes(token.scopes)}</strong>
									</div>
									<div>
										<span>Created</span>
										<strong>{formatDateTime(token.createdAt)}</strong>
									</div>
									<div>
										<span>Last used</span>
										<strong>{formatDateTime(token.lastUsedAt)}</strong>
									</div>
								</div>

								<button
									class="void-button"
									type="button"
									disabled={revokingTokenId === token.id}
									onclick={() => handleRevokeToken(token.id)}
								>
									{revokingTokenId === token.id ? 'Revoking...' : 'Revoke token'}
								</button>
							</article>
						{/each}
					</div>
				{/if}
			</section>

			<section class="panel docs-panel" aria-labelledby="docs-heading">
				<div class="panel-header">
					<div>
						<p class="section-label">Setup</p>
						<h2 id="docs-heading">Shortcut setup</h2>
					</div>
					<span class="pill">iPhone + Watch</span>
				</div>

				<div class="docs-grid">
					<div class="doc-section">
						<h3>Terminal test</h3>
						<p>
							{docsTokenIsReal
								? "These commands include this browser's remembered shortcut token."
								: 'Generate a token on this browser to fill these examples with the real token.'}
						</p>
						{@render copyBlock('curl-stop', 'tm stop curl', curlStop, copiedKey, copyText)}
						{@render copyBlock('curl-next', 'tm next curl', curlNext, copiedKey, copyText)}
					</div>

					<div class="doc-section">
						<h3>iPhone shortcut: tm stop</h3>
						<ol>
							<li>Open Shortcuts, tap +, and name the shortcut <strong>tm stop</strong>.</li>
							<li>Add URL and paste the stop endpoint.</li>
							<li>Add Get Contents of URL, set Method to POST, and add the headers.</li>
							<li>Set Request Body to JSON with the stop body below.</li>
							<li>
								Add Get Dictionary Value for <strong>message</strong> from Contents of URL.
							</li>
							<li>Add Show Result using that dictionary value.</li>
						</ol>
						{@render copyBlock('stop-url', 'URL', stopUrl, copiedKey, copyText)}
						{@render copyBlock('stop-headers', 'Headers', shortcutHeaders, copiedKey, copyText)}
						{@render copyBlock('stop-body', 'JSON body', stopBody, copiedKey, copyText)}
						{@render copyBlock('stop-message-key', 'Result key', messageKey, copiedKey, copyText)}
					</div>

					<div class="doc-section">
						<h3>iPhone shortcut: tm next</h3>
						<ol>
							<li>Duplicate tm stop or create a new shortcut named <strong>tm next</strong>.</li>
							<li>Use the next endpoint.</li>
							<li>Keep the same Authorization and Content-Type headers.</li>
							<li>Use the next JSON body below.</li>
							<li>
								Add Get Dictionary Value for <strong>message</strong> from Contents of URL.
							</li>
							<li>Add Show Result using that dictionary value.</li>
						</ol>
						{@render copyBlock('next-url', 'URL', nextUrl, copiedKey, copyText)}
						{@render copyBlock('next-headers', 'Headers', shortcutHeaders, copiedKey, copyText)}
						{@render copyBlock('next-body', 'JSON body', nextBody, copiedKey, copyText)}
						{@render copyBlock('next-message-key', 'Result key', messageKey, copiedKey, copyText)}
					</div>

					<div class="doc-section">
						<h3>Watch result display</h3>
						<ol>
							<li>After Get Contents of URL, add Get Dictionary Value.</li>
							<li>Set Get value for to <strong>message</strong>.</li>
							<li>Set the input dictionary to <strong>Contents of URL</strong>.</li>
							<li>Add Show Result and pass it the dictionary value.</li>
						</ol>
						<p>
							tm next shows <strong>Next Task: Dishes</strong> when a queued task starts, or
							<strong>No next task queued</strong> when the queue is empty.
						</p>
					</div>

					<div class="doc-section">
						<h3>Fast access layout</h3>
						<ul>
							<li>Set iPhone Action Button to <strong>tm stop</strong>.</li>
							<li>
								Add a Shortcuts Home Screen widget with <strong>tm stop</strong> and
								<strong>tm next</strong>.
							</li>
							<li>Add each shortcut to the Home Screen if you want direct icons.</li>
							<li>Use Siri by saying the shortcut names.</li>
							<li>
								Enable Show on Apple Watch, then add the shortcuts to a complication or Smart Stack.
							</li>
						</ul>
					</div>
				</div>

				<div class="support-links">
					{#each supportLinks as link}
						<a href={link.href} target="_blank" rel="noreferrer">{link.label}</a>
					{/each}
				</div>
			</section>
		</PageContentReveal>
	{/if}
</section>

{#snippet copyBlock(keyName, title, text, copiedKey, copyText)}
	<div class="copy-box">
		<div class="copy-box__header">
			<span>{title}</span>
			<button type="button" onclick={() => copyText(keyName, text)}>
				{copiedKey === keyName ? 'Copied' : 'Copy'}
			</button>
		</div>
		<pre><code>{text}</code></pre>
	</div>
{/snippet}

<style>
	.quick-page {
		display: grid;
		gap: 1.35rem;
	}

	.hero {
		display: grid;
		gap: 0.5rem;
		max-width: 46rem;
	}

	.hero h1,
	.panel h2,
	.token-card h3,
	.doc-section h3 {
		margin: 0;
		text-align: left;
	}

	.hero h1 {
		color: var(--color-heading);
		font-size: clamp(2.2rem, 5vw, 3.8rem);
		letter-spacing: -0.05em;
		line-height: 0.95;
	}

	.panel h2 {
		font-size: 1.45rem;
	}

	.section-label {
		margin: 0;
		color: var(--color-accent);
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}

	.lede,
	.panel-copy,
	.status-card p,
	.empty-card p,
	.token-card p,
	.doc-section p,
	.doc-section li {
		margin: 0;
		color: var(--color-muted);
	}

	.panel,
	.status-card,
	.empty-card,
	.token-card,
	.copy-box {
		border: 1px solid var(--surface-border);
		background: var(--surface-1);
		box-shadow: var(--surface-shadow);
	}

	.panel {
		display: grid;
		align-content: start;
		gap: 1rem;
		padding: 1.2rem;
		border-radius: 26px;
	}

	.panel-header,
	.token-card__topline {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	.pill,
	.token-badge {
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

	.muted-pill,
	.token-badge {
		background: var(--surface-muted);
		color: var(--color-muted);
	}

	.token-form {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: end;
		gap: 0.8rem;
	}

	.field-label {
		display: grid;
		gap: 0.38rem;
		color: var(--color-heading);
		font-size: 0.78rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.text-input {
		width: 100%;
		min-height: 2.7rem;
		padding: 0.72rem 0.85rem;
		border: 1px solid var(--surface-border);
		border-radius: 16px;
		background: var(--surface-2);
		box-shadow: var(--surface-inset);
		color: var(--color-heading);
		font: inherit;
		font-size: 0.95rem;
		font-weight: 700;
		letter-spacing: 0;
		text-transform: none;
	}

	.text-input:focus {
		outline: none;
		border-color: color-mix(in srgb, var(--color-accent) 46%, var(--surface-border));
		box-shadow:
			0 0 0 4px color-mix(in srgb, var(--color-accent) 14%, transparent),
			var(--surface-inset);
	}

	.primary-button,
	.void-button,
	.copy-box button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 2.55rem;
		border: 0;
		border-radius: 999px;
		background: var(--control-gradient);
		box-shadow: var(--surface-shadow);
		color: var(--color-accent-contrast);
		cursor: pointer;
		font-size: 0.76rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		white-space: nowrap;
	}

	.primary-button,
	.void-button {
		padding: 0.78rem 1rem;
	}

	.primary-button:disabled,
	.void-button:disabled {
		cursor: wait;
		opacity: 0.7;
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

	.success-card {
		border-color: color-mix(in srgb, var(--color-success) 24%, var(--surface-border));
		background: color-mix(in srgb, var(--color-success) 9%, var(--surface-1));
	}

	.token-list {
		display: grid;
		gap: 0.85rem;
	}

	.token-card {
		display: grid;
		gap: 0.9rem;
		padding: 1rem;
		border-radius: 20px;
	}

	.token-meta {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.8rem;
	}

	.token-meta span {
		display: block;
		margin-bottom: 0.28rem;
		color: var(--color-soft);
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.token-meta strong {
		color: var(--color-heading);
		font-size: 0.94rem;
	}

	.docs-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
	}

	.doc-section {
		display: grid;
		align-content: start;
		gap: 0.75rem;
	}

	.doc-section h3 {
		color: var(--color-heading);
		font-size: 1rem;
	}

	.doc-section ol,
	.doc-section ul {
		display: grid;
		gap: 0.42rem;
		margin: 0;
		padding-left: 1.2rem;
	}

	.copy-box {
		overflow: hidden;
		border-radius: 18px;
		background: var(--surface-2);
	}

	.copy-box__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.8rem;
		padding: 0.65rem 0.75rem;
		border-bottom: 1px solid var(--surface-border);
	}

	.copy-box__header span {
		color: var(--color-heading);
		font-size: 0.75rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.copy-box button {
		min-height: 2rem;
		padding: 0.45rem 0.65rem;
		font-size: 0.68rem;
	}

	.copy-box pre {
		overflow-x: auto;
		margin: 0;
		padding: 0.85rem;
		color: var(--color-heading);
		font-size: 0.82rem;
		line-height: 1.5;
		white-space: pre;
	}

	.token-copy-box pre {
		font-size: 0.78rem;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	.support-links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
	}

	.support-links a {
		display: inline-flex;
		align-items: center;
		min-height: 2.35rem;
		padding: 0.58rem 0.72rem;
		border-radius: 999px;
		background: var(--surface-2);
		color: var(--color-accent);
		font-size: 0.76rem;
		font-weight: 800;
		text-decoration: none;
	}

	@media (max-width: 860px) {
		.token-form,
		.docs-grid {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 640px) {
		.panel-header,
		.token-card__topline {
			flex-direction: column;
			align-items: flex-start;
		}

		.token-meta {
			grid-template-columns: 1fr;
		}
	}
</style>
