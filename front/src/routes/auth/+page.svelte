<script>
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	import { createAccount, loginAccount } from '$lib/session';

	let mode = 'login';
	let username = '';
	let password = '';
	let confirmPassword = '';
	let alphaCode = '';
	let acceptedLegalTerms = false;
	let errorMessage = '';
	let isSubmitting = false;

	async function handleSubmit(event) {
		event.preventDefault();
		await submitForm();
	}

	async function submitForm() {
		errorMessage = '';

		if (mode === 'create' && password !== confirmPassword) {
			errorMessage = 'Passwords do not match.';
			return;
		}

		if (mode === 'create' && !alphaCode.trim()) {
			errorMessage = 'Alpha code is required.';
			return;
		}

		if (mode === 'create' && !acceptedLegalTerms) {
			errorMessage = 'You must agree to the Privacy Policy and Terms & Conditions.';
			return;
		}

		isSubmitting = true;

		try {
			if (mode === 'create') {
				await createAccount({ username, password, alphaCode, acceptedLegalTerms });
			} else {
				await loginAccount({ username, password });
			}

			await goto(resolve('/active'), {
				replaceState: true
			});
		} catch (error) {
			errorMessage = error.message;
		} finally {
			isSubmitting = false;
		}
	}
</script>

<svelte:head>
	<title>Login</title>
	<meta name="description" content="Log in to task-monster or create an account." />
</svelte:head>

<section class="auth-shell">
	<div class="auth-copy">
		<p class="eyebrow">Task Monster</p>
		<h1>Keep the table tight.</h1>
		<p class="lede">
			Log in to pick up today&apos;s stack, or create a new account with the prerelease alpha code.
		</p>
	</div>

	<div class="auth-card">
		<div class="mode-switch" role="tablist" aria-label="Authentication mode">
			<button
				type="button"
				class:active-mode={mode === 'login'}
				onclick={() => {
					mode = 'login';
					errorMessage = '';
				}}
			>
				Login
			</button>
			<button
				type="button"
				class:active-mode={mode === 'create'}
				onclick={() => {
					mode = 'create';
					errorMessage = '';
				}}
			>
				Create account
			</button>
		</div>

		<form class="auth-form" onsubmit={handleSubmit}>
			<label class="field-label" for="auth-username">Username</label>
			<input
				id="auth-username"
				bind:value={username}
				class="text-input"
				type="text"
				name="username"
				autocomplete="username"
				placeholder="aurora"
				required
			/>

			<label class="field-label" for="auth-password">Password</label>
			<input
				id="auth-password"
				bind:value={password}
				class="text-input"
				type="password"
				name="password"
				autocomplete={mode === 'create' ? 'new-password' : 'current-password'}
				placeholder="At least 8 characters"
				required
			/>

			{#if mode === 'create'}
				<label class="field-label" for="auth-confirm-password">Confirm password</label>
				<input
					id="auth-confirm-password"
					bind:value={confirmPassword}
					class="text-input"
					type="password"
					name="confirmPassword"
					autocomplete="new-password"
					placeholder="Repeat the password"
					required
				/>

				<label class="field-label" for="auth-alpha-code">Alpha code</label>
				<input
					id="auth-alpha-code"
					bind:value={alphaCode}
					class="text-input"
					type="password"
					name="alphaCode"
					autocomplete="one-time-code"
					placeholder="Prerelease access code"
					required
				/>
				<p class="field-note">Account creation is locked behind the prerelease alpha code.</p>

				<div class="consent-card">
					<input
						id="auth-legal-acceptance"
						bind:checked={acceptedLegalTerms}
						class="checkbox-input"
						type="checkbox"
						name="acceptedLegalTerms"
					/>
					<label class="consent-copy" for="auth-legal-acceptance">
						I agree to the <a href={resolve('/privacy')}>Privacy Policy</a> and
						<a href={resolve('/terms')}>Terms &amp; Conditions</a>, including the rules that govern
						the full app and the optional SMS Assistant.
					</label>
				</div>
				<p class="field-note">
					Creating an account records your acceptance of the current legal terms.
				</p>
			{/if}

			{#if errorMessage}
				<p class="error-message">{errorMessage}</p>
			{/if}

			<button class="submit-button" type="submit" disabled={isSubmitting}>
				{#if isSubmitting}
					Working...
				{:else if mode === 'create'}
					Create account
				{:else}
					Log in
				{/if}
			</button>
		</form>

		<div class="legal-links">
			<a href={resolve('/privacy')}>Privacy Policy</a>
			<a href={resolve('/terms')}>Terms &amp; Conditions</a>
		</div>
	</div>
</section>

<style>
	.auth-shell {
		min-height: calc(100vh - 4rem);
		display: grid;
		grid-template-columns: minmax(0, 1.1fr) minmax(18rem, 28rem);
		align-items: center;
		gap: 2rem;
		padding: 2rem 0;
	}

	.auth-copy {
		display: grid;
		gap: 0.8rem;
		max-width: 32rem;
	}

	.eyebrow {
		margin: 0;
		font-size: 0.8rem;
		font-weight: 800;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--color-theme-2);
	}

	h1 {
		margin: 0;
		text-align: left;
		font-size: clamp(2.6rem, 6vw, 4.8rem);
		line-height: 0.92;
		letter-spacing: -0.06em;
		color: var(--color-heading);
	}

	.lede {
		margin: 0;
		font-size: 1.05rem;
		color: var(--color-muted);
	}

	.auth-card {
		display: grid;
		gap: 1.2rem;
		padding: 1.6rem;
		border-radius: 28px;
		background:
			linear-gradient(
				180deg,
				color-mix(in srgb, var(--surface-3) 92%, transparent),
				color-mix(in srgb, var(--surface-2) 88%, transparent)
			),
			radial-gradient(
				circle at top,
				color-mix(in srgb, var(--color-accent) 12%, transparent),
				transparent 62%
			);
		border: 1px solid var(--surface-border);
		box-shadow: var(--surface-shadow-strong), var(--surface-inset);
	}

	.mode-switch {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.35rem;
		padding: 0.35rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--color-accent) 9%, var(--surface-1));
		border: 1px solid color-mix(in srgb, var(--color-accent) 14%, var(--surface-border));
	}

	.mode-switch button {
		padding: 0.85rem 1rem;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: var(--color-muted);
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.mode-switch button.active-mode {
		background: var(--surface-3);
		color: var(--color-theme-2);
		box-shadow: var(--surface-shadow);
	}

	.auth-form {
		display: grid;
		gap: 0.9rem;
	}

	.legal-links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.9rem;
	}

	.legal-links a {
		color: var(--color-theme-2);
		text-decoration: none;
		font-size: 0.92rem;
		font-weight: 700;
	}

	.legal-links a:hover {
		text-decoration: underline;
	}

	.field-label {
		display: block;
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-muted);
	}

	.field-note {
		margin: -0.25rem 0 0.2rem;
		font-size: 0.88rem;
		color: var(--color-muted);
	}

	.consent-card {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 0.8rem;
		padding: 0.95rem 1rem;
		border-radius: 16px;
		background: color-mix(in srgb, var(--color-accent) 8%, var(--surface-1));
		border: 1px solid color-mix(in srgb, var(--color-accent) 16%, var(--surface-border));
	}

	.checkbox-input {
		width: 1.05rem;
		height: 1.05rem;
		margin: 0.2rem 0 0;
		accent-color: var(--color-theme-2);
	}

	.consent-copy {
		font-size: 0.94rem;
		line-height: 1.55;
		color: var(--color-muted);
	}

	.consent-copy a {
		color: var(--color-theme-2);
		text-decoration: none;
		font-weight: 700;
	}

	.consent-copy a:hover {
		text-decoration: underline;
	}

	.text-input {
		width: 100%;
		box-sizing: border-box;
		padding: 0.95rem 1rem;
		border: 1px solid var(--field-border);
		border-radius: 16px;
		background: var(--field-bg);
		color: var(--color-text);
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease;
	}

	.text-input::placeholder {
		color: var(--color-soft);
	}

	.text-input:focus {
		outline: none;
		border-color: var(--color-theme-2);
		box-shadow: 0 0 0 4px var(--focus-ring);
	}

	.error-message {
		margin: 0;
		padding: 0.85rem 1rem;
		border-radius: 14px;
		background: color-mix(in srgb, var(--color-danger) 10%, var(--surface-1));
		color: var(--color-danger);
		font-weight: 600;
	}

	.submit-button {
		width: 100%;
		padding: 0.95rem 1rem;
		border: 0;
		border-radius: 16px;
		background: var(--accent-gradient);
		color: var(--color-accent-contrast);
		font-weight: 800;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		box-shadow: 0 18px 30px color-mix(in srgb, var(--color-accent) 24%, transparent);
	}

	.submit-button:disabled {
		opacity: 0.7;
	}

	@media (max-width: 860px) {
		.auth-shell {
			grid-template-columns: 1fr;
			align-items: start;
		}

		.auth-copy {
			max-width: none;
		}
	}
</style>
