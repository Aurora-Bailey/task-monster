<script>
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import github from '$lib/images/github.svg';
	import logo from '$lib/images/tm-logo-crop.png';

	const navLinks = [
		{ href: '/active', label: 'Active' },
		{ href: '/inactive', label: 'Inactive' },
		{ href: '/stats', label: 'Stats' },
		{ href: '/add', label: 'Add' }
	];

	function isCurrent(href) {
		return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
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

	<div class="corner">
		<a class="icon-link" href="https://github.com/aurora-bailey/task-monster" target="_blank" rel="noreferrer">
			<img src={github} alt="GitHub" />
		</a>
	</div>
</header>

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
	.corner:last-child {
		display: flex;
		justify-content: center;
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

	.icon-link {
		width: 2.8rem;
		height: 2.8rem;
		justify-content: center;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.62);
		border: 1px solid rgba(255, 255, 255, 0.72);
		box-shadow: 0 14px 28px rgba(44, 62, 80, 0.08);
	}

	.icon-link:hover {
		transform: translateY(-1px);
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
