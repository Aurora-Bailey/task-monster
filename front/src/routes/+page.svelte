<script>
	import { resolve } from '$app/paths';

	import { session } from '$lib/session';

	const heroPrimaryHref = $derived($session.status === 'authenticated' ? '/active' : '/auth');
	const heroPrimaryLabel = $derived(
		$session.status === 'authenticated' ? 'Open your table' : 'Create account'
	);

	const marketingImages = {
		stats: resolve('/images/marketing/landing-stats.png'),
		card: resolve('/images/marketing/landing-card.png'),
		add: resolve('/images/marketing/add-task-builder.svg')
	};
</script>

<svelte:head>
	<title>Task Monster</title>
	<meta
		name="description"
		content="Task Monster is a task board for planning, active work, completion history, and real day-level stats."
	/>
</svelte:head>

<section class="landing-shell">
	<section class="hero-band">
		<div class="band-inner">
			<header class="landing-nav">
				<div class="brand-lockup">
					<p class="brand-kicker">TASK MONSTER</p>
					<p class="brand-name">A task system with a table, not a pile.</p>
				</div>

				<nav aria-label="Primary">
					<a href="#product">Product</a>
					<a href="#screens">Screens</a>
					<a href={resolve('/demo-board')}>Tour</a>
					<a class="nav-cta" href={resolve('/auth')}>Sign up / Login</a>
				</nav>
			</header>

			<div class="hero-grid">
				<div class="hero-copy">
					<p class="section-kicker">Task flow</p>
					<h1>Plan the day. Run the work. Review the record.</h1>
					<p class="hero-lede">
						Task Monster keeps the board narrow on purpose. Tasks live in Daymap, Active, Done, and
						Stats so it is easy to see what belongs today, what is live right now, and what actually
						happened.
					</p>

					<div class="hero-actions">
						<a class="primary-action" href={resolve(heroPrimaryHref)}>{heroPrimaryLabel}</a>
						<a class="secondary-action" href={resolve('/demo-board')}>See the product tour</a>
					</div>

					<div class="hero-track" aria-label="Core task flow">
						<span>Inactive</span>
						<span class="track-divider" aria-hidden="true"></span>
						<span>Daymap</span>
						<span class="track-divider" aria-hidden="true"></span>
						<span>Active</span>
						<span class="track-divider" aria-hidden="true"></span>
						<span>Done</span>
						<span class="track-divider" aria-hidden="true"></span>
						<span>Stats</span>
					</div>
				</div>

				<div class="hero-visual">
					<figure class="shot-panel hero-main-shot">
						<img
							src={marketingImages.stats}
							alt="Task Monster stats view showing a heatmap of completed work across days."
						/>
					</figure>

					<figure class="shot-panel hero-secondary-shot">
						<img
							src={marketingImages.card}
							alt="Task Monster task card showing the compact action controls and note area."
						/>
					</figure>
				</div>
			</div>
		</div>
	</section>

	<section class="proof-band" id="product">
		<div class="band-inner proof-inner">
			<div class="section-heading">
				<p class="section-kicker">What it is</p>
				<h2>One board, four states, and real history underneath.</h2>
				<p>
					Task Monster is built for people who want a small amount of structure with clear evidence.
					The board separates planning from execution, records exact active runs, and keeps a stats
					layer for day-by-day review.
				</p>
			</div>

			<div class="signal-grid">
				<article class="signal-card">
					<p class="card-index">01</p>
					<h3>Daymap</h3>
					<p>Choose what belongs today without mixing it into the rest of the backlog.</p>
				</article>
				<article class="signal-card">
					<p class="card-index">02</p>
					<h3>Active</h3>
					<p>Track live work separately, including timing, tally changes, and instance notes.</p>
				</article>
				<article class="signal-card">
					<p class="card-index">03</p>
					<h3>Done</h3>
					<p>Keep completion history around so the system shows evidence, not just memory.</p>
				</article>
			</div>
		</div>
	</section>

	<section class="screens-band" id="screens">
		<div class="band-inner">
			<div class="section-heading compact">
				<p class="section-kicker">Screens</p>
				<h2>Built to be recognizable at a glance.</h2>
			</div>

			<div class="screen-grid">
				<figure class="shot-panel wide-shot">
					<img
						src={marketingImages.stats}
						alt="Task Monster stats page with stacked color bands and daily summaries."
					/>
					<figcaption>Stats turns the day into a readable heatmap.</figcaption>
				</figure>

				<figure class="shot-panel narrow-shot">
					<img
						src={marketingImages.add}
						alt="Task Monster add-task builder showing the task creation form."
					/>
					<figcaption>Add keeps task creation short and structured.</figcaption>
				</figure>
			</div>
		</div>
	</section>

	<section class="cta-band">
		<div class="band-inner cta-inner">
			<div>
				<p class="section-kicker">Get started</p>
				<h2>Use the app, or tour the surface first.</h2>
				<p>
					The live app is available after sign in, and the public demo board gives a quick look at the
					layout without committing to an account.
				</p>
			</div>

			<div class="cta-actions">
				<a class="primary-action" href={resolve('/auth')}>Sign up / Login</a>
				<a class="ghost-action" href={resolve('/demo-board')}>Open product tour</a>
			</div>
		</div>
	</section>
</section>

<style>
	:global(body) {
		background:
			radial-gradient(circle at top left, rgba(255, 190, 223, 0.34), transparent 34%),
			radial-gradient(circle at top right, rgba(186, 176, 255, 0.28), transparent 28%),
			linear-gradient(180deg, #fff7fb 0%, #f8f4ff 52%, #f7f4ef 100%);
	}

	.landing-shell {
		--ink: #33263f;
		--muted: #665872;
		--accent: #b651d5;
		--frame: rgba(104, 69, 125, 0.18);
		--panel: rgba(255, 255, 255, 0.72);
		color: var(--ink);
	}

	.hero-band,
	.proof-band,
	.screens-band,
	.cta-band {
		padding: 3.5rem 0;
	}

	.band-inner {
		width: min(1180px, calc(100vw - 2rem));
		margin: 0 auto;
	}

	.landing-nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding-bottom: 2.1rem;
	}

	.brand-lockup {
		display: grid;
		gap: 0.15rem;
	}

	.brand-kicker,
	.section-kicker {
		margin: 0;
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: 0.24em;
		text-transform: uppercase;
		color: rgba(134, 87, 156, 0.82);
	}

	.brand-name {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 700;
	}

	.landing-nav nav {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		flex-wrap: wrap;
		justify-content: flex-end;
	}

	.landing-nav a,
	.primary-action,
	.secondary-action,
	.ghost-action {
		border-radius: 999px;
		text-decoration: none;
		font-weight: 700;
		transition:
			transform 0.18s ease,
			box-shadow 0.18s ease,
			background 0.18s ease;
	}

	.landing-nav a {
		padding: 0.72rem 1rem;
		color: var(--ink);
	}

	.nav-cta,
	.primary-action {
		background: linear-gradient(135deg, #eb70c3, #8d67f1);
		color: white;
		box-shadow: 0 16px 32px rgba(152, 88, 186, 0.22);
	}

	.hero-grid {
		display: grid;
		grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
		gap: 2rem;
		align-items: center;
	}

	h1,
	h2,
	h3,
	p {
		margin: 0;
	}

	h1 {
		max-width: 14ch;
		font-size: clamp(2.7rem, 5vw, 4.9rem);
		line-height: 0.94;
		letter-spacing: -0.03em;
	}

	.hero-lede,
	.section-heading p,
	.signal-card p,
	figcaption {
		color: var(--muted);
		line-height: 1.65;
	}

	.hero-lede {
		max-width: 38rem;
		font-size: 1.05rem;
		padding-top: 1rem;
	}

	.hero-actions,
	.cta-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.85rem;
		padding-top: 1.2rem;
	}

	.primary-action,
	.secondary-action,
	.ghost-action {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 3rem;
		padding: 0.85rem 1.15rem;
	}

	.secondary-action,
	.ghost-action {
		border: 1px solid var(--frame);
		background: rgba(255, 255, 255, 0.55);
		color: var(--ink);
	}

	.hero-track {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.8rem;
		padding-top: 1.2rem;
		font-size: 0.76rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba(94, 73, 110, 0.72);
	}

	.track-divider {
		width: 2rem;
		height: 1px;
		background: linear-gradient(90deg, transparent, rgba(150, 103, 191, 0.9), transparent);
	}

	.hero-visual {
		position: relative;
		min-height: 35rem;
	}

	.shot-panel {
		margin: 0;
		padding: 0.45rem;
		border-radius: 24px;
		border: 1px solid var(--frame);
		background: var(--panel);
		box-shadow: 0 24px 50px rgba(103, 74, 125, 0.14);
	}

	.shot-panel img {
		display: block;
		width: 100%;
		height: auto;
		border-radius: 18px;
	}

	.hero-main-shot {
		width: min(100%, 48rem);
		margin-left: auto;
		transform: perspective(1700px) rotateY(-10deg) rotateX(3deg);
		transform-origin: right center;
	}

	.hero-secondary-shot {
		position: absolute;
		left: 0;
		bottom: 2.2rem;
		width: min(19rem, 37vw);
	}

	.proof-inner {
		display: grid;
		gap: 1.8rem;
	}

	.section-heading {
		max-width: 46rem;
	}

	.section-heading h2 {
		padding-top: 0.4rem;
		font-size: clamp(1.8rem, 3vw, 2.8rem);
		line-height: 1.05;
	}

	.section-heading p {
		padding-top: 0.8rem;
		font-size: 1.02rem;
	}

	.signal-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1rem;
	}

	.signal-card {
		padding: 1.3rem;
		border-radius: 22px;
		background: rgba(255, 255, 255, 0.7);
		border: 1px solid rgba(122, 90, 150, 0.14);
		box-shadow: 0 18px 34px rgba(95, 67, 118, 0.08);
	}

	.card-index {
		color: var(--accent);
		font-size: 0.82rem;
		font-weight: 900;
		letter-spacing: 0.18em;
	}

	.signal-card h3 {
		padding-top: 0.55rem;
		font-size: 1.2rem;
	}

	.signal-card p {
		padding-top: 0.6rem;
	}

	.screen-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.35fr) minmax(0, 0.65fr);
		gap: 1rem;
		align-items: start;
		padding-top: 1.2rem;
	}

	.wide-shot,
	.narrow-shot {
		display: grid;
		gap: 0.75rem;
	}

	.wide-shot figcaption,
	.narrow-shot figcaption {
		padding: 0 0.35rem;
		font-size: 0.92rem;
	}

	.cta-band {
		padding-bottom: 4.8rem;
	}

	.cta-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.5rem;
		padding: 1.4rem 1.5rem;
		border-radius: 26px;
		border: 1px solid rgba(122, 90, 150, 0.16);
		background: rgba(255, 255, 255, 0.64);
		box-shadow: 0 20px 40px rgba(94, 66, 114, 0.1);
	}

	.cta-inner h2 {
		padding-top: 0.35rem;
	}

	@media (max-width: 1040px) {
		.hero-grid,
		.screen-grid,
		.cta-inner {
			grid-template-columns: 1fr;
		}

		.cta-inner {
			display: grid;
		}

		.signal-grid {
			grid-template-columns: 1fr;
		}

		.hero-visual {
			min-height: auto;
			padding-bottom: 7.5rem;
		}

		.hero-secondary-shot {
			left: 1rem;
			bottom: 3rem;
			width: min(16rem, 45vw);
		}
	}

	@media (max-width: 760px) {
		.hero-band,
		.proof-band,
		.screens-band,
		.cta-band {
			padding: 3rem 0;
		}

		.landing-nav {
			flex-direction: column;
			align-items: start;
		}

		.landing-nav nav {
			justify-content: flex-start;
		}

		h1 {
			max-width: none;
		}

		.hero-main-shot {
			transform: none;
		}

		.hero-secondary-shot {
			position: relative;
			left: auto;
			bottom: auto;
			width: 72%;
			margin-top: -2rem;
		}

		.hero-visual {
			padding-bottom: 0;
		}
	}

	@media (max-width: 560px) {
		.hero-actions,
		.cta-actions {
			flex-direction: column;
		}

		.primary-action,
		.secondary-action,
		.ghost-action {
			width: 100%;
		}
	}
</style>
