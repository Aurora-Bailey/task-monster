<script>
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { logoutAccount } from '$lib/session';
	import logo from '$lib/images/tm-logo-crop.png';

	let { user = null } = $props();
	let isLoggingOut = $state(false);
	let logoutError = $state('');

	const navLinks = [
		{ href: '/active', label: 'Active' },
		{ href: '/inactive', label: 'Inactive' },
		{ href: '/stats', label: 'Stats' },
		{ href: '/add', label: 'Add' }
	];

	function isCurrent(href) {
		return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
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
</script>

<header>
	<div class="corner">
		<a class="brand" href={resolve('/active')}>
			<img src={logo} alt="task-monster" />
			<span>task monster</span>
		</a>
	</div>

	<nav>
		<ul>
			{#each navLinks as link}
				<li>
					<a href={resolve(link.href)} aria-current={isCurrent(link.href) ? 'page' : undefined}>
						{link.label}
					</a>
				</li>
			{/each}
		</ul>
	</nav>

	<div class="session-tools">
		{#if user}
			<a
				class="user-pill"
				href={resolve('/profile')}
				aria-current={isCurrent('/profile') ? 'page' : undefined}
			>
				{user.username}
			</a>
			<button class="logout-button" type="button" onclick={handleLogout} disabled={isLoggingOut}>
				{isLoggingOut ? 'Logging out...' : 'Log out'}
			</button>
		{/if}
	</div>
</header>

{#if logoutError}
	<p class="logout-error">{logoutError}</p>
{/if}

<style>
	header {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 1rem;
		padding: 0.9rem 1rem;
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0.34));
		backdrop-filter: blur(16px);
		border-bottom: 1px solid rgba(255, 255, 255, 0.5);
		box-shadow: 0 16px 32px rgba(44, 62, 80, 0.08);
	}

	.corner {
		display: flex;
		align-items: center;
	}

	.corner a {
		display: flex;
		align-items: center;
		text-decoration: none;
	}

	.corner img {
		width: 2.3rem;
		height: 2.3rem;
		object-fit: contain;
	}

	.brand {
		gap: 0.75rem;
		font-size: 0.82rem;
		font-weight: 800;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: rgba(13, 24, 36, 0.82);
	}

	nav,
	.session-tools {
		display: flex;
		justify-content: center;
	}

	.session-tools {
		align-items: center;
		gap: 0.65rem;
	}

	ul {
		padding: 0.32rem;
		margin: 0;
		display: flex;
		align-items: stretch;
		gap: 0.2rem;
		list-style: none;
		background: rgba(255, 255, 255, 0.62);
		border: 1px solid rgba(255, 255, 255, 0.72);
		border-radius: 999px;
		box-shadow:
			0 18px 32px rgba(44, 62, 80, 0.08),
			inset 0 1px 0 rgba(255, 255, 255, 0.85);
	}

	nav a {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.72rem 1rem;
		border-radius: 999px;
		color: rgba(13, 24, 36, 0.62);
		font-weight: 800;
		font-size: 0.78rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		text-decoration: none;
		transition:
			color 0.2s ease,
			background-color 0.2s ease,
			transform 0.2s ease,
			box-shadow 0.2s ease;
	}

	nav a:hover {
		transform: translateY(-1px);
		color: var(--color-theme-2);
	}

	nav a[aria-current='page'] {
		background: linear-gradient(135deg, var(--color-theme-2), #5b93c8);
		color: white;
		box-shadow: 0 14px 28px rgba(64, 117, 166, 0.28);
	}

	.user-pill,
	.logout-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.7rem 0.9rem;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.62);
		border: 1px solid rgba(255, 255, 255, 0.72);
		box-shadow: 0 14px 28px rgba(44, 62, 80, 0.08);
		font-size: 0.76rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(13, 24, 36, 0.72);
		text-decoration: none;
	}

	.logout-button {
		cursor: pointer;
	}

	.user-pill[aria-current='page'] {
		background: linear-gradient(135deg, rgba(64, 117, 166, 0.18), rgba(91, 147, 200, 0.12));
		color: var(--color-theme-2);
		box-shadow: 0 14px 28px rgba(64, 117, 166, 0.16);
	}

	.logout-button:hover {
		transform: translateY(-1px);
		color: var(--color-theme-2);
	}

	.logout-button:disabled {
		cursor: wait;
		opacity: 0.72;
	}

	.logout-error {
		margin: 0;
		padding: 0 1rem 0.75rem;
		font-size: 0.78rem;
		font-weight: 700;
		color: #9f2d27;
		text-align: right;
	}

	@media (max-width: 760px) {
		header {
			grid-template-columns: 1fr auto;
		}

		nav {
			grid-column: 1 / -1;
			order: 3;
		}

		.brand span {
			letter-spacing: 0.12em;
		}
	}

	@media (max-width: 520px) {
		.brand span {
			display: none;
		}

		.user-pill {
			display: none;
		}

		ul {
			width: 100%;
		}

		li {
			flex: 1;
		}

		nav a {
			padding-inline: 0.7rem;
		}
	}
</style>
