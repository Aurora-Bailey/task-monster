<script>
	import { goto } from '$app/navigation';

	import { createAccount, loginAccount } from '$lib/session';

	let mode = 'login';
	let username = '';
	let password = '';
	let confirmPassword = '';
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

		isSubmitting = true;

		try {
			if (mode === 'create') {
				await createAccount({ username, password });
			} else {
				await loginAccount({ username, password });
			}

			await goto('/active', {
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
			Log in to pick up today&apos;s stack, or create a new account and start shaping the board.
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
		color: rgba(10, 20, 30, 0.92);
	}

	.lede {
		margin: 0;
		font-size: 1.05rem;
		color: rgba(10, 20, 30, 0.68);
	}

	.auth-card {
		display: grid;
		gap: 1.2rem;
		padding: 1.6rem;
		border-radius: 28px;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(245, 249, 255, 0.88)),
			radial-gradient(circle at top, rgba(64, 117, 166, 0.12), rgba(255, 255, 255, 0));
		border: 1px solid rgba(255, 255, 255, 0.75);
		box-shadow:
			0 26px 60px rgba(44, 62, 80, 0.12),
			inset 0 1px 0 rgba(255, 255, 255, 0.9);
	}

	.mode-switch {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.35rem;
		padding: 0.35rem;
		border-radius: 999px;
		background: rgba(64, 117, 166, 0.08);
		border: 1px solid rgba(64, 117, 166, 0.12);
	}

	.mode-switch button {
		padding: 0.85rem 1rem;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: rgba(10, 20, 30, 0.54);
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.mode-switch button.active-mode {
		background: white;
		color: var(--color-theme-2);
		box-shadow: 0 12px 24px rgba(44, 62, 80, 0.1);
	}

	.auth-form {
		display: grid;
		gap: 0.9rem;
	}

	.field-label {
		display: block;
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(0, 0, 0, 0.55);
	}

	.text-input {
		width: 100%;
		box-sizing: border-box;
		padding: 0.95rem 1rem;
		border: 1px solid rgba(64, 117, 166, 0.16);
		border-radius: 16px;
		background: rgba(255, 255, 255, 0.88);
		color: var(--color-text);
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease;
	}

	.text-input::placeholder {
		color: rgba(0, 0, 0, 0.34);
	}

	.text-input:focus {
		outline: none;
		border-color: var(--color-theme-2);
		box-shadow: 0 0 0 4px rgba(64, 117, 166, 0.12);
	}

	.error-message {
		margin: 0;
		padding: 0.85rem 1rem;
		border-radius: 14px;
		background: rgba(153, 0, 0, 0.08);
		color: var(--color-theme-1);
		font-weight: 600;
	}

	.submit-button {
		width: 100%;
		padding: 0.95rem 1rem;
		border: 0;
		border-radius: 16px;
		background: linear-gradient(135deg, var(--color-theme-2), #5b93c8);
		color: white;
		font-weight: 800;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		box-shadow: 0 18px 30px rgba(64, 117, 166, 0.24);
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
