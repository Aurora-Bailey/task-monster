<script>
	import { resolve } from '$app/paths';

	import { session } from '$lib/session';

	const primaryHref = $derived($session.status === 'authenticated' ? '/active' : '/auth');
	const primaryLabel = $derived(
		$session.status === 'authenticated' ? 'Open Task Monster' : 'Create account'
	);

	const marketingImages = {
		tasks: resolve('/images/marketing/demo-tasks.png'),
		active: resolve('/images/marketing/demo-active.png'),
		add: resolve('/images/marketing/demo-add.png'),
		stats: resolve('/images/marketing/demo-stats.png'),
		profile: resolve('/images/marketing/home-profile.png')
	};

	const tourSections = [
		{
			kicker: 'Daymap',
			title: 'Separate what belongs today from everything else.',
			copy: 'The Tasks board keeps Active work and Daymap work visible without collapsing the backlog into the same mental bucket.',
			image: marketingImages.tasks,
			alt: 'Task Monster tasks page with active tasks above daymap task cards.'
		},
		{
			kicker: 'Active',
			title: 'Run sessions with notes, timers, and completion controls in reach.',
			copy: 'Active cards keep task notes and instance notes apart, then record exact runtime when the work is done.',
			image: marketingImages.active,
			alt: 'Task Monster active page showing two running tasks with notes and timer data.'
		},
		{
			kicker: 'Build',
			title: 'Create the task with its behavior already attached.',
			copy: 'Choose mode, tracking type, color, automatic Daymap weekdays, tally settings, and persistent notes before the task enters the board.',
			image: marketingImages.add,
			alt: 'Task Monster add page showing task setup controls.'
		},
		{
			kicker: 'Review',
			title: 'The stats page turns sessions into a readable day record.',
			copy: 'Minute-map heatmaps make long days scannable and show overlaps by category instead of hiding the evidence in a simple completion count.',
			image: marketingImages.stats,
			alt: 'Task Monster dark stats page showing a colored minute-map heatmap.'
		}
	];
</script>

<svelte:head>
	<title>Task Monster Product Tour</title>
	<meta
		name="description"
		content="A public product tour of Task Monster's Daymap, Active, task creation, stats, and account theme surfaces."
	/>
</svelte:head>

<section class="tour-shell">
	<nav class="tour-nav" aria-label="Primary">
		<a class="brand" href={resolve('/')}>Task Monster</a>

		<div class="nav-links">
			<a href={resolve('/')}>Home</a>
			<a href="#tour">Tour</a>
			<a href="#account">Account</a>
			<a class="nav-login" href={resolve('/auth')}>Log in</a>
		</div>
	</nav>

	<header class="tour-hero">
		<div class="hero-copy">
			<p class="eyebrow">Product tour</p>
			<h1>See the board before you sign in.</h1>
			<p>
				Task Monster is built around a few durable surfaces: Daymap, Active, Done, Stats, and
				account-backed theme controls.
			</p>

			<div class="hero-actions">
				<a class="primary-action" href={resolve(primaryHref)}>{primaryLabel}</a>
				<a class="secondary-action" href={resolve('/')}>Back to home</a>
			</div>
		</div>

		<figure class="hero-shot">
			<img
				src={marketingImages.tasks}
				alt="Task Monster overview showing active and daymap task cards."
			/>
		</figure>
	</header>

	<div class="tour-list" id="tour">
		{#each tourSections as section, index}
			<section class:reverse={index % 2 === 1} class="tour-section">
				<div class="section-copy">
					<p class="eyebrow">{section.kicker}</p>
					<h2>{section.title}</h2>
					<p>{section.copy}</p>
				</div>

				<figure class="product-shot">
					<img src={section.image} alt={section.alt} loading="lazy" />
				</figure>
			</section>
		{/each}
	</div>

	<section class="account-section" id="account">
		<div class="section-copy">
			<p class="eyebrow">Account</p>
			<h2>The theme follows the account, not just the browser.</h2>
			<p>
				Profile keeps live sessions, recent login activity, and the account theme picker in one
				place. Stored local accounts can switch without losing their saved skin.
			</p>
		</div>

		<figure class="product-shot">
			<img
				src={marketingImages.profile}
				alt="Task Monster profile page showing account session and theme controls."
				loading="lazy"
			/>
		</figure>
	</section>

	<section class="tour-cta">
		<p class="eyebrow">Next</p>
		<h2>Use the app or return to the homepage.</h2>

		<div class="hero-actions">
			<a class="primary-action" href={resolve(primaryHref)}>{primaryLabel}</a>
			<a class="secondary-action" href={resolve('/')}>Home</a>
		</div>
	</section>
</section>

<style>
	:global(body) {
		background-color: var(--app-bg-color);
		background-image: var(--app-bg-image);
	}

	:global(.marketing-main) {
		max-width: none;
		padding-right: 0;
		padding-left: 0;
	}

	.tour-shell {
		--ink: var(--color-heading);
		--muted: var(--color-muted);
		--line: var(--surface-border-strong);
		--marketing-panel: var(--surface-2);
		--marketing-panel-strong: var(--surface-3);
		width: 100%;
		color: var(--color-text);
		background: transparent;
	}

	.tour-nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		width: min(1120px, calc(100vw - 2rem));
		margin: 0 auto;
		padding: 1rem 0;
	}

	.brand,
	.nav-links a,
	.primary-action,
	.secondary-action {
		text-decoration: none;
		font-weight: 750;
	}

	.brand {
		color: var(--ink);
		font-size: 1rem;
		letter-spacing: 0.02em;
	}

	.nav-links {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.25rem;
		flex-wrap: wrap;
	}

	.nav-links a {
		display: inline-flex;
		align-items: center;
		min-height: 2.4rem;
		padding: 0 0.75rem;
		border-radius: 999px;
		color: var(--color-muted);
	}

	.nav-links a:hover {
		background: var(--surface-muted);
		color: var(--ink);
	}

	.nav-links .nav-login {
		border: 1px solid var(--line);
		background: var(--surface-2);
		color: var(--ink);
	}

	.tour-hero {
		display: grid;
		grid-template-columns: minmax(22rem, 0.9fr) minmax(0, 1.1fr);
		gap: 2rem;
		align-items: center;
		width: min(1120px, calc(100vw - 2rem));
		margin: 0 auto;
		padding: 4rem 0 5rem;
		border-top: 1px solid var(--line);
	}

	.hero-copy,
	.section-copy,
	.tour-cta {
		display: grid;
		gap: 0.9rem;
	}

	.eyebrow {
		margin: 0;
		color: var(--color-accent);
		font-size: 0.74rem;
		font-weight: 850;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	h1,
	h2,
	p,
	figure {
		margin: 0;
	}

	h1 {
		max-width: 17ch;
		font-size: 3.15rem;
		line-height: 1.1;
		letter-spacing: 0;
	}

	h2 {
		font-size: 2.45rem;
		line-height: 1.08;
		letter-spacing: 0;
	}

	.hero-copy p,
	.section-copy p,
	.tour-cta {
		color: var(--muted);
		line-height: 1.62;
	}

	.hero-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		padding-top: 0.2rem;
	}

	.primary-action,
	.secondary-action {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 3rem;
		padding: 0 1.2rem;
		border-radius: 999px;
		transition:
			transform 0.16s ease,
			box-shadow 0.16s ease,
			background 0.16s ease;
	}

	.primary-action {
		background: var(--accent-gradient);
		color: var(--color-accent-contrast);
		box-shadow: var(--surface-shadow);
	}

	.secondary-action {
		border: 1px solid var(--line);
		background: var(--marketing-panel);
		color: var(--ink);
	}

	.primary-action:hover,
	.secondary-action:hover {
		transform: translateY(-1px);
	}

	.hero-shot,
	.product-shot {
		overflow: hidden;
		border: 1px solid var(--surface-border);
		border-radius: 8px;
		background: var(--marketing-panel-strong);
		box-shadow: var(--surface-shadow-strong);
	}

	.hero-shot img,
	.product-shot img {
		display: block;
		width: 100%;
		height: auto;
	}

	.tour-list {
		display: grid;
		gap: 0;
		border-top: 1px solid var(--line);
	}

	.tour-section,
	.account-section {
		display: grid;
		grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
		gap: 2rem;
		align-items: center;
		width: min(1120px, calc(100vw - 2rem));
		margin: 0 auto;
		padding: 5.5rem 0;
		border-bottom: 1px solid var(--line);
	}

	.tour-section.reverse {
		grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);
	}

	.tour-section.reverse .section-copy {
		order: 2;
	}

	.tour-section.reverse .product-shot {
		order: 1;
	}

	.product-shot {
		align-self: start;
	}

	.account-section {
		border-top: 1px solid var(--line);
	}

	.tour-cta {
		justify-items: center;
		width: min(760px, calc(100vw - 2rem));
		margin: 0 auto;
		padding: 5.5rem 0;
		text-align: center;
	}

	.tour-cta h2 {
		color: var(--ink);
	}

	@media (max-width: 860px) {
		.tour-nav {
			align-items: flex-start;
		}

		.tour-hero,
		.tour-section,
		.tour-section.reverse,
		.account-section {
			grid-template-columns: 1fr;
		}

		.tour-section.reverse .section-copy,
		.tour-section.reverse .product-shot {
			order: initial;
		}

		h1 {
			font-size: 3rem;
		}

		h2 {
			font-size: 2.25rem;
		}
	}

	@media (max-width: 560px) {
		.tour-nav {
			display: grid;
		}

		.nav-links {
			justify-content: flex-start;
		}

		.nav-links a {
			padding: 0 0.65rem;
		}

		.tour-hero {
			padding: 3.2rem 0 4rem;
		}

		.tour-section,
		.account-section,
		.tour-cta {
			padding: 4rem 0;
		}

		.hero-actions {
			width: 100%;
		}

		h1 {
			font-size: 2.55rem;
		}

		h2 {
			font-size: 2.05rem;
		}

		.primary-action,
		.secondary-action {
			width: 100%;
		}
	}
</style>
