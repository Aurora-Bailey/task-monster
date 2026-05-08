<script>
	import { resolve } from '$app/paths';

	import { session } from '$lib/session';
	import logo from '$lib/images/tm-logo-crop.png';

	const heroPrimaryHref = $derived($session.status === 'authenticated' ? '/active' : '/auth');
	const heroPrimaryLabel = $derived(
		$session.status === 'authenticated' ? 'Open Task Monster' : 'Start free'
	);

	const marketingImages = {
		heroUnderlay: resolve('/images/marketing/hero-board-dark.png'),
		addTask: resolve('/images/marketing/add-task-dark.png'),
		todayMobile: resolve('/images/marketing/mobile-tasks-dark.png'),
		tasks: resolve('/images/marketing/demo-tasks.png'),
		card: resolve('/images/marketing/demo-card.png'),
		stats: resolve('/images/marketing/demo-stats.png')
	};

	const corePoints = ['Add task', 'Track today', 'View stats'];
</script>

<svelte:head>
	<title>Task Monster</title>
	<meta
		name="description"
		content="Task Monster is a focused task system for adding tasks, tracking today's work, and reviewing real completion stats."
	/>
</svelte:head>

<section class="home-shell">
	<nav class="site-nav" aria-label="Primary">
		<a class="brand" href={resolve('/')} aria-label="Task Monster home">
			<img src={logo} alt="" />
			<span>Task Monster</span>
		</a>

		<div class="nav-links">
			<a href="#adhd">ADHD</a>
			<a href="#workflow">Workflow</a>
			<a href="#stats">Stats</a>
			<a class="nav-login" href={resolve('/auth')}>Log in</a>
		</div>
	</nav>

	<header class="hero">
		<figure class="hero-media">
			<img
				src={marketingImages.heroUnderlay}
				alt="Task Monster board in a dark theme showing active work, daymap tasks, and app navigation."
			/>
		</figure>

		<div class="hero-overlay" aria-hidden="true"></div>

		<div class="hero-content">
			<img class="hero-logo" src={logo} alt="" />
			<p class="eyebrow">Add. Track. Review.</p>
			<h1>A task system for today's work.</h1>
			<p class="hero-lede">
				Task Monster keeps the loop small: add the task, choose what belongs today, track the active
				work, then review the record when the day is done.
			</p>

			<div class="hero-actions">
				<a class="primary-action" href={resolve(heroPrimaryHref)}>{heroPrimaryLabel}</a>
			</div>

			<div class="workflow-strip" aria-label="Task Monster workflow">
				{#each corePoints as item}
					<span>{item}</span>
				{/each}
			</div>
		</div>
	</header>

	<section class="section-band adhd-band" id="adhd">
		<p class="eyebrow">ADHD and task systems</p>
		<p class="adhd-copy">
			<a href="https://www.nimh.nih.gov/health/publications/adhd-what-you-need-to-know">
				NIMH describes adult ADHD
			</a>
			as involving difficulty staying on task, staying organized, managing time, and remembering daily
			responsibilities, while
			<a
				href="https://chadd.org/adhd-news/adhd-news-adults/keeping-organized-goes-beyond-a-task-list/"
			>
				CHADD notes
			</a>
			that organization often takes more than a giant task list: systems need to stay simple, relevant,
			and tied to daily planning. Task Monster follows that shape by turning capture, today's table, active
			work, and history into separate surfaces so memory does not have to carry the whole day.
		</p>
	</section>

	<section class="section-band workflow-band" id="workflow">
		<div class="section-heading">
			<p class="eyebrow">Three moves</p>
			<h2>Add task. Track today. View stats.</h2>
		</div>

		<section class="point-section">
			<div class="point-copy">
				<p class="eyebrow">01 Add task</p>
				<h3>Capture the thing before it becomes background noise.</h3>
				<p>
					Add the task with the parts that matter later: category color, repeat behavior, tracking
					type, scheduled weekdays, and notes.
				</p>
			</div>

			<figure class="shot-frame shot-frame--large">
				<img
					src={marketingImages.addTask}
					alt="Task Monster add task page showing task name, color, mode, tracking, and daymap scheduling controls."
					loading="lazy"
				/>
			</figure>
		</section>

		<section class="point-section point-section--reverse">
			<div class="point-copy">
				<p class="eyebrow">02 Track today</p>
				<h3>Keep today's table separate from the backlog.</h3>
				<p>
					Daymap gives the day its own surface, active cards show what is actually running, and
					compact task cards keep notes and controls close.
				</p>
			</div>

			<div class="today-collage" aria-label="Task Monster today tracking screenshots">
				<figure class="shot-frame today-collage__board">
					<img
						src={marketingImages.tasks}
						alt="Task Monster tasks page with active tasks and daymap cards."
						loading="lazy"
					/>
				</figure>

				<figure class="shot-frame today-collage__mobile">
					<img
						src={marketingImages.todayMobile}
						alt="Task Monster mobile task list in a dark theme."
						loading="lazy"
					/>
				</figure>

				<figure class="shot-frame today-collage__card">
					<img
						src={marketingImages.card}
						alt="Task Monster compact task card with note and action controls."
						loading="lazy"
					/>
				</figure>
			</div>
		</section>

		<section class="point-section" id="stats">
			<div class="point-copy">
				<p class="eyebrow">03 View stats</p>
				<h3>Review the work as a record, not a vibe.</h3>
				<p>
					Done history and heatmap stats turn active sessions into visible evidence, including what
					happened today and how the day was divided.
				</p>
			</div>

			<figure class="shot-frame shot-frame--large">
				<img
					src={marketingImages.stats}
					alt="Task Monster dark stats view showing a minute-map heatmap."
					loading="lazy"
				/>
			</figure>
		</section>
	</section>

	<section class="section-band closing-band">
		<p class="eyebrow">Ready</p>
		<h2>Start with one task. Let the table keep score.</h2>

		<div class="closing-actions">
			<a class="primary-action" href={resolve('/auth')}>Sign up / Login</a>
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

	.home-shell {
		--ink: var(--color-heading);
		--muted: var(--color-muted);
		--line: var(--surface-border-strong);
		--marketing-panel: var(--surface-2);
		--marketing-panel-strong: var(--surface-3);
		width: 100%;
		color: var(--color-text);
		background: transparent;
	}

	.site-nav {
		position: relative;
		z-index: 5;
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
	.primary-action {
		text-decoration: none;
		font-weight: 750;
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		color: var(--ink);
		font-size: 1rem;
		letter-spacing: 0.02em;
	}

	.brand img {
		width: 2.6rem;
		height: 2.6rem;
		object-fit: contain;
	}

	.brand span {
		white-space: nowrap;
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

	.hero {
		position: relative;
		display: grid;
		place-items: center;
		width: 100vw;
		min-height: clamp(36rem, 86vh, 48rem);
		margin-left: calc(50% - 50vw);
		overflow: hidden;
		border-top: 1px solid var(--line);
		border-bottom: 1px solid var(--line);
		background: #000;
	}

	.hero-media {
		position: absolute;
		inset: 0;
		margin: 0;
	}

	.hero-media img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center top;
		filter: saturate(1.06) contrast(1.08) brightness(0.88);
	}

	.hero-overlay {
		position: absolute;
		inset: 0;
		background:
			linear-gradient(
				180deg,
				rgba(0, 0, 0, 0.82) 0%,
				rgba(0, 0, 0, 0.54) 34%,
				rgba(0, 0, 0, 0.8) 100%
			),
			linear-gradient(
				90deg,
				rgba(0, 0, 0, 0.8) 0%,
				rgba(0, 0, 0, 0.34) 48%,
				rgba(0, 0, 0, 0.72) 100%
			);
	}

	.hero-content {
		position: relative;
		z-index: 1;
		color: #fff;
		display: grid;
		justify-items: center;
		gap: 1rem;
		width: min(820px, calc(100vw - 2rem));
		padding: 4.8rem 0 9rem;
		text-align: center;
	}

	.hero-logo {
		width: min(13rem, 48vw);
		height: auto;
		margin-bottom: 0.15rem;
		filter: drop-shadow(0 18px 30px rgba(0, 0, 0, 0.64));
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
	h3,
	p,
	figure {
		margin: 0;
	}

	h1 {
		color: #fff;
		font-size: 5.5rem;
		line-height: 0.98;
		letter-spacing: 0;
	}

	h2 {
		font-size: 3rem;
		line-height: 1.05;
		letter-spacing: 0;
	}

	h3 {
		font-size: 2.35rem;
		line-height: 1.08;
		letter-spacing: 0;
	}

	.hero-lede {
		max-width: 44rem;
		color: rgba(255, 255, 255, 0.82);
		font-size: 1.24rem;
		line-height: 1.6;
	}

	.hero-actions,
	.closing-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.75rem;
		padding-top: 0.35rem;
	}

	.primary-action {
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

	.primary-action:hover {
		transform: translateY(-1px);
	}

	.workflow-strip {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.35rem;
		padding-top: 0.55rem;
	}

	.workflow-strip span {
		display: inline-flex;
		align-items: center;
		min-height: 2rem;
		padding: 0 0.72rem;
		border: 1px solid var(--surface-border);
		border-radius: 999px;
		background: var(--surface-1);
		color: var(--color-muted);
		font-size: 0.82rem;
		font-weight: 750;
	}

	.section-band {
		width: min(1120px, calc(100vw - 2rem));
		margin: 0 auto;
		padding: 5.5rem 0;
	}

	.adhd-band {
		display: grid;
		gap: 0.9rem;
		border-bottom: 1px solid var(--line);
	}

	.adhd-copy {
		max-width: 58rem;
		color: var(--color-muted);
		font-size: 1.18rem;
		line-height: 1.72;
	}

	.adhd-copy a {
		color: var(--color-link);
		font-weight: 800;
		text-decoration-thickness: 0.08em;
		text-underline-offset: 0.18em;
	}

	.workflow-band {
		display: grid;
		gap: 5rem;
	}

	.section-heading {
		display: grid;
		gap: 0.7rem;
		max-width: 48rem;
	}

	.point-section {
		display: grid;
		grid-template-columns: minmax(0, 0.78fr) minmax(0, 1.22fr);
		gap: 2rem;
		align-items: center;
		padding-top: 1.2rem;
		border-top: 1px solid var(--line);
	}

	.point-section--reverse {
		grid-template-columns: minmax(0, 1.18fr) minmax(0, 0.82fr);
	}

	.point-section--reverse .point-copy {
		order: 2;
	}

	.point-section--reverse .today-collage {
		order: 1;
	}

	.point-copy {
		display: grid;
		gap: 0.85rem;
	}

	.point-copy p:not(.eyebrow),
	.closing-band {
		color: var(--muted);
		line-height: 1.65;
	}

	.shot-frame {
		overflow: hidden;
		border: 1px solid var(--surface-border);
		border-radius: 8px;
		background: var(--marketing-panel-strong);
		box-shadow: var(--surface-shadow-strong);
	}

	.shot-frame img {
		display: block;
		width: 100%;
		height: auto;
	}

	.shot-frame--large {
		align-self: start;
	}

	.today-collage {
		position: relative;
		min-height: 31rem;
	}

	.today-collage__board {
		width: 84%;
		margin-left: auto;
	}

	.today-collage__mobile {
		position: absolute;
		left: 0;
		top: 2.5rem;
		width: 24%;
		min-width: 8.5rem;
	}

	.today-collage__card {
		position: absolute;
		right: 2rem;
		bottom: 0;
		width: min(24rem, 52%);
	}

	.closing-band {
		display: grid;
		justify-items: center;
		gap: 0.9rem;
		max-width: 760px;
		text-align: center;
		border-top: 1px solid var(--line);
	}

	.closing-band h2 {
		color: var(--ink);
	}

	@media (max-width: 920px) {
		.site-nav {
			align-items: flex-start;
		}

		.nav-links {
			max-width: 26rem;
		}

		.hero {
			min-height: 42rem;
		}

		.hero-content {
			padding: 4rem 0 8rem;
		}

		h1 {
			font-size: 4.6rem;
		}

		h2 {
			font-size: 2.55rem;
		}

		h3 {
			font-size: 2.05rem;
		}

		.point-section,
		.point-section--reverse {
			grid-template-columns: 1fr;
		}

		.point-section--reverse .point-copy,
		.point-section--reverse .today-collage {
			order: initial;
		}
	}

	@media (max-width: 560px) {
		.site-nav {
			display: grid;
		}

		.nav-links {
			justify-content: flex-start;
		}

		.nav-links a {
			padding: 0 0.65rem;
		}

		.hero {
			place-items: start center;
			min-height: 40rem;
		}

		.hero-content {
			justify-items: start;
			padding: 3.2rem 0 8rem;
			text-align: left;
		}

		h1 {
			font-size: 3.25rem;
		}

		h2 {
			font-size: 2.05rem;
		}

		h3 {
			font-size: 1.72rem;
		}

		.hero-lede,
		.adhd-copy {
			font-size: 1.04rem;
		}

		.hero-actions,
		.closing-actions {
			width: 100%;
			justify-content: stretch;
		}

		.primary-action {
			width: 100%;
		}

		.workflow-strip {
			justify-content: flex-start;
		}

		.section-band {
			padding: 4rem 0;
		}

		.workflow-band {
			gap: 3.5rem;
		}

		.today-collage {
			display: grid;
			gap: 0.85rem;
			min-height: auto;
		}

		.today-collage__board,
		.today-collage__mobile,
		.today-collage__card {
			position: static;
			width: 100%;
			min-width: 0;
			margin: 0;
		}
	}
</style>
