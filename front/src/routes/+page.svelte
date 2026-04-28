<script>
	import { resolve } from '$app/paths';

	import { session } from '$lib/session';

	const heroPrimaryHref = $derived($session.status === 'authenticated' ? '/active' : '/auth');
	const heroPrimaryLabel = $derived(
		$session.status === 'authenticated' ? 'Open your table' : 'Create account'
	);

	const screenshots = {
		daymap: '/images/marketing/daymap-board.png',
		active: '/images/marketing/active-run.png',
		add: '/images/marketing/add-task-builder.png',
		notes: '/images/marketing/task-note-surface.png'
	};
</script>

<svelte:head>
	<title>Task Monster</title>
	<meta
		name="description"
		content="Task Monster is a focused task system built around daymapping, active runs, panic tracking, and real completion history."
	/>
</svelte:head>

<section class="landing-shell">
	<section class="band hero-band">
		<div class="band-inner">
			<header class="landing-nav">
				<div class="brand-lockup">
					<p class="brand-kicker">TM // Operating Surface</p>
					<p class="brand-name">Task Monster</p>
				</div>

				<nav aria-label="Primary">
					<a href="#why">Why it works</a>
					<a href="#flow">Flow</a>
					<a href={resolve('/demo-board')}>Product tour</a>
					<a href="#assistant">SMS + AI</a>
					<a class="nav-cta" href={resolve('/auth')}>Sign up / Login</a>
				</nav>
			</header>

			<div class="hero-grid">
				<div class="hero-copy">
					<p class="section-kicker">Focused operating surface</p>
					<h1>Compress the daily table.</h1>
					<p class="hero-lede">
						Task Monster is built around a tighter operating model: choose what belongs today,
						run what is actually live, record real sessions, and review what happened instead of
						what you hoped would happen.
					</p>

					<div class="hero-actions">
						<a class="primary-action" href={resolve(heroPrimaryHref)}>{heroPrimaryLabel}</a>
						<a class="secondary-action" href={resolve('/demo-board')}>Open product tour</a>
					</div>

					<div class="hero-track" aria-label="Core task flow">
						<span>Inactive</span>
						<span class="track-divider" aria-hidden="true"></span>
						<span>Daymap</span>
						<span class="track-divider" aria-hidden="true"></span>
						<span>Active</span>
						<span class="track-divider" aria-hidden="true"></span>
						<span>Done</span>
					</div>
				</div>

				<div class="hero-visual">
					<figure class="shot-panel hero-main-shot">
						<img
							src={screenshots.daymap}
							alt="Task Monster daymap screen showing staged tasks and task cards."
						/>
					</figure>

					<figure class="shot-panel hero-secondary-shot">
						<img
							src={screenshots.active}
							alt="Task Monster active task screen showing pomodoro state, panic time, and done controls."
						/>
					</figure>

					<p class="hero-caption">Real product screens. Daymap behind. Live run in front.</p>
				</div>
			</div>
		</div>
	</section>

	<section class="band proof-band" id="why">
		<div class="band-inner proof-inner">
			<div class="section-heading">
				<p class="section-kicker">Why it works</p>
				<h2>Planning, execution, and history are separate on purpose.</h2>
				<p>
					Most task apps flatten planning, active work, and retrospective data into one endless
					list. Task Monster gives each state its own surface, so the table stays narrow and the
					record stays honest.
				</p>
			</div>

			<div class="signal-grid">
				<article class="signal-card">
					<p class="card-index">01</p>
					<h3>Backlog is not today</h3>
					<p>
						Inactive tasks stay off the table until you deliberately map them into the day.
					</p>
				</article>

				<article class="signal-card">
					<p class="card-index">02</p>
					<h3>Runs create evidence</h3>
					<p>
						Activation opens a real session, so timing, notes, and completion attach to actual work.
					</p>
				</article>

				<article class="signal-card">
					<p class="card-index">03</p>
					<h3>Interruption stays visible</h3>
					<p>
						Panic overlap and effective time stop the day from being rewritten into a cleaner story.
					</p>
				</article>
			</div>
		</div>
	</section>

	<section class="band flow-band" id="flow">
		<div class="band-inner surface-layout">
			<div class="surface-copy">
				<p class="section-kicker">Daymap</p>
				<h2>Shape the day before the timer starts.</h2>
				<p>
					Tasks move from inactive into the daymap first, which gives you a staging layer instead
					of forcing planning and execution into the same pile.
				</p>
				<ul class="surface-points">
					<li>Only today&apos;s work gets mapped in.</li>
					<li>Repeatables can stay locked to the daily loop.</li>
					<li>Color and ordering keep the board readable at a glance.</li>
				</ul>
			</div>

			<figure class="shot-panel wide-shot">
				<img
					src={screenshots.daymap}
					alt="Task Monster daymap page with staged task cards and sort controls."
					loading="eager"
				/>
			</figure>
		</div>
	</section>

	<section class="band runtime-band">
		<div class="band-inner surface-layout reverse">
			<figure class="shot-panel portrait-shot">
				<img
					src={screenshots.active}
					alt="Task Monster active task screen showing notes, timer, pomodoro phase, panic time, and done controls."
					loading="lazy"
				/>
			</figure>

			<div class="surface-copy">
				<p class="section-kicker">Active runtime</p>
				<h2>When a task goes live, it becomes a real session.</h2>
				<p>
					The active screen is where the system earns its keep: duration, pomodoro phase, panic
					overlap, effective time, run notes, and completion all sit on the same surface.
				</p>
				<ul class="surface-points">
					<li>Focus and break cadence stay tied to the active task.</li>
					<li>Run notes do not get mixed into the template note.</li>
					<li>Done closes the session instead of toggling a checkbox.</li>
				</ul>

				<aside class="signal-plate">
					<p class="card-index">04</p>
					<strong>Panic time does not vanish.</strong>
					<p>
						Elapsed time and effective time are both visible, so interruption cost stays on the
						record.
					</p>
				</aside>
			</div>
		</div>
	</section>

	<section class="band builder-band">
		<div class="band-inner builder-layout">
			<div class="builder-copy">
				<p class="section-kicker">Task builder</p>
				<h2>Tasks carry structure, not just names.</h2>
				<p>
					You can define color, type, tracking mode, and pomodoro cadence at creation time so
					the system knows how that task should behave later.
				</p>
				<p>
					Persistent task context stays separate from run-specific notes, which makes review
					cleaner once the day is over.
				</p>
			</div>

			<div class="builder-gallery">
				<figure class="shot-panel builder-shot">
					<img
						src={screenshots.add}
						alt="Task Monster add-task screen showing color choice, task type, tracking mode, and add button."
						loading="lazy"
					/>
				</figure>

				<figure class="shot-panel note-shot">
					<img
						src={screenshots.notes}
						alt="Task Monster task note surface showing a notepad area inside a task card."
						loading="lazy"
					/>
				</figure>
			</div>
		</div>
	</section>

	<section class="band assistant-band" id="assistant">
		<div class="band-inner assistant-layout">
			<div class="section-heading assistant-copy">
				<p class="section-kicker">Last layer</p>
				<h2>SMS and AI sit on top of the workflow, not in place of it.</h2>
				<p>
					The assistant story matters, but only after the underlying system is solid. The plan is
					to let verified users text the system, have an AI layer resolve intent safely, and then
					call the existing backend actions with clarification when a request is ambiguous.
				</p>
			</div>

			<aside class="assistant-plate">
				<p class="card-index">05</p>
				<h3>Bridge stays narrow</h3>
				<p>
					The messaging layer stays separate from the main app and only gets enough authority to
					interpret, confirm, and call the backend API.
				</p>
				<ul class="assistant-points">
					<li>Phone number links stay user-owned.</li>
					<li>Ambiguous commands trigger clarification.</li>
					<li>Backend remains the source of truth.</li>
				</ul>
			</aside>
		</div>
	</section>

	<section class="band final-band">
		<div class="band-inner final-inner">
			<div class="final-copy">
				<p class="section-kicker">Start with the board</p>
				<h2>Build a day that has a shape.</h2>
				<p>
					If you want a task system that distinguishes backlog, today, active work, and actual
					history, Task Monster is built for that job.
				</p>
			</div>

			<div class="cta-actions">
				<a class="primary-action" href={resolve(heroPrimaryHref)}>{heroPrimaryLabel}</a>
				<a class="ghost-action" href={resolve('/demo-board')}>Product tour</a>
			</div>
		</div>
	</section>
</section>

<style>
	.landing-shell {
		display: grid;
		gap: 0;
		padding: 0 0 2.6rem;
		--marketing-display: 'Avenir Next', 'Helvetica Neue', 'Segoe UI', sans-serif;
	}

	.band {
		position: relative;
		left: 50%;
		width: 100vw;
		margin-left: -50vw;
		margin-right: -50vw;
		padding: clamp(4.75rem, 11vw, 8.25rem) 0;
		overflow: hidden;
		color: var(--band-ink);
	}

	.band::before {
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		opacity: 0.5;
	}

	.band-inner {
		position: relative;
		z-index: 1;
		width: min(61rem, calc(100vw - clamp(3rem, 11vw, 9rem)));
		margin: 0 auto;
	}

	.hero-band .band-inner {
		width: min(76rem, calc(100vw - clamp(2rem, 7vw, 5rem)));
	}

	.hero-band {
		--accent: #99d5ff;
		--band-ink: rgba(240, 247, 255, 0.95);
		--muted: rgba(220, 234, 247, 0.76);
		--frame-bg: linear-gradient(180deg, rgba(34, 45, 58, 0.96), rgba(13, 18, 26, 0.94));
		--frame-border: rgba(170, 214, 244, 0.22);
		background:
			radial-gradient(circle at top left, rgba(71, 121, 171, 0.34), transparent 38%),
			radial-gradient(circle at right, rgba(120, 193, 255, 0.15), transparent 28%),
			linear-gradient(145deg, rgba(8, 14, 22, 0.99), rgba(13, 22, 34, 0.96));
		border-top: 1px solid rgba(174, 205, 230, 0.16);
		border-bottom: 1px solid rgba(174, 205, 230, 0.16);
	}

	.hero-band::before,
	.runtime-band::before,
	.assistant-band::before {
		background-image:
			linear-gradient(rgba(122, 160, 196, 0.12) 1px, transparent 1px),
			linear-gradient(90deg, rgba(122, 160, 196, 0.12) 1px, transparent 1px);
		background-size: 34px 34px;
	}

	.proof-band {
		--accent: #da7b52;
		--band-ink: rgba(16, 24, 31, 0.94);
		--muted: rgba(16, 24, 31, 0.7);
		background:
			linear-gradient(180deg, rgba(238, 230, 223, 0.98), rgba(230, 221, 214, 0.94)),
			linear-gradient(90deg, rgba(218, 123, 82, 0.1), transparent 35%);
		border-top: 1px solid rgba(131, 97, 78, 0.12);
	}

	.flow-band {
		--accent: #3f9e95;
		--band-ink: rgba(10, 19, 24, 0.94);
		--muted: rgba(10, 19, 24, 0.7);
		--frame-bg: linear-gradient(180deg, rgba(245, 252, 250, 0.98), rgba(229, 242, 238, 0.95));
		--frame-border: rgba(63, 158, 149, 0.2);
		background:
			linear-gradient(180deg, rgba(219, 236, 232, 0.98), rgba(209, 227, 222, 0.94)),
			linear-gradient(90deg, rgba(63, 158, 149, 0.08), transparent 40%);
		border-top: 1px solid rgba(65, 109, 103, 0.1);
	}

	.runtime-band {
		--accent: #78b8ff;
		--band-ink: rgba(239, 246, 252, 0.95);
		--muted: rgba(214, 228, 240, 0.76);
		--frame-bg: linear-gradient(180deg, rgba(20, 31, 43, 0.96), rgba(10, 15, 22, 0.94));
		--frame-border: rgba(120, 184, 255, 0.22);
		background:
			radial-gradient(circle at left, rgba(64, 110, 170, 0.22), transparent 34%),
			linear-gradient(160deg, rgba(11, 19, 29, 0.99), rgba(18, 31, 45, 0.96));
		border-top: 1px solid rgba(126, 163, 199, 0.16);
	}

	.builder-band {
		--accent: #7fae61;
		--band-ink: rgba(14, 21, 27, 0.94);
		--muted: rgba(14, 21, 27, 0.7);
		--frame-bg: linear-gradient(180deg, rgba(248, 250, 244, 0.98), rgba(233, 241, 225, 0.95));
		--frame-border: rgba(127, 174, 97, 0.22);
		background:
			linear-gradient(180deg, rgba(229, 238, 223, 0.98), rgba(218, 230, 211, 0.94)),
			linear-gradient(90deg, rgba(127, 174, 97, 0.08), transparent 40%);
		border-top: 1px solid rgba(92, 123, 70, 0.1);
	}

	.assistant-band {
		--accent: #ffbe6c;
		--band-ink: rgba(245, 239, 229, 0.95);
		--muted: rgba(229, 220, 204, 0.78);
		background:
			radial-gradient(circle at right, rgba(255, 190, 108, 0.08), transparent 32%),
			linear-gradient(155deg, rgba(23, 21, 18, 0.99), rgba(37, 31, 24, 0.96));
		border-top: 1px solid rgba(163, 138, 100, 0.14);
	}

	.final-band {
		--accent: #7d96cb;
		--band-ink: rgba(13, 20, 28, 0.94);
		--muted: rgba(13, 20, 28, 0.7);
		background:
			linear-gradient(180deg, rgba(228, 234, 245, 0.98), rgba(216, 225, 240, 0.94)),
			linear-gradient(90deg, rgba(125, 150, 203, 0.08), transparent 40%);
		border-top: 1px solid rgba(95, 112, 148, 0.12);
	}

	.landing-nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.25rem;
		padding-bottom: clamp(2.8rem, 6vw, 4.4rem);
	}

	.brand-lockup,
	.hero-copy,
	.section-heading,
	.surface-copy,
	.builder-copy,
	.final-copy {
		display: grid;
		gap: 1rem;
	}

	.brand-kicker,
	.brand-name,
	.section-kicker,
	.card-index,
	.hero-track,
	.assistant-points li::before,
	.surface-points li::before {
		font-family: var(--font-mono);
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	.brand-kicker,
	.section-kicker,
	.card-index,
	.surface-points li::before,
	.assistant-points li::before {
		margin: 0;
		font-size: 0.76rem;
		font-weight: 700;
		color: var(--accent);
	}

	.brand-name {
		margin: 0;
		font-family: var(--marketing-display);
		font-size: 1rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		color: var(--band-ink);
	}

	.landing-nav nav {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 0.95rem;
	}

	.landing-nav a {
		color: rgba(226, 239, 249, 0.78);
		text-decoration: none;
		font-size: 0.92rem;
		font-weight: 700;
	}

	.landing-nav a:hover {
		color: rgba(244, 249, 255, 0.96);
	}

	.nav-cta {
		padding: 0.7rem 0.98rem;
		border-radius: 999px;
		border: 1px solid rgba(166, 210, 242, 0.24);
		background: rgba(255, 255, 255, 0.04);
	}

	.hero-grid,
	.surface-layout,
	.builder-layout,
	.assistant-layout,
	.final-inner {
		display: grid;
		gap: clamp(1.5rem, 4vw, 3rem);
		align-items: center;
	}

	.hero-grid {
		grid-template-columns: minmax(0, 0.9fr) minmax(24rem, 1.1fr);
	}

	.hero-copy {
		padding-block: 0.4rem;
	}

	.section-heading {
		max-width: 46rem;
	}

	h1,
	h2,
	h3,
	strong {
		margin: 0;
		font-family: var(--marketing-display);
		letter-spacing: -0.06em;
		color: var(--band-ink);
	}

	h1 {
		font-size: clamp(3.8rem, 10vw, 7.25rem);
		line-height: 0.84;
		max-width: 8ch;
		padding: 0.35rem 0 0.7rem;
	}

	h2 {
		font-size: clamp(2.1rem, 4.8vw, 3.85rem);
		line-height: 0.92;
	}

	h3,
	.signal-plate strong {
		font-size: 1.16rem;
		line-height: 1.1;
	}

	.hero-lede,
	.section-heading p,
	.surface-copy p,
	.builder-copy p,
	.final-copy p,
	.signal-card p,
	.signal-plate p,
	.assistant-plate p {
		margin: 0;
		line-height: 1.72;
		color: var(--muted);
	}

	.signal-card .card-index,
	.signal-plate .card-index,
	.assistant-plate .card-index {
		color: var(--accent);
	}

	.hero-lede {
		max-width: 34rem;
		font-size: 1.08rem;
	}

	.hero-actions,
	.cta-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.9rem;
		padding-top: 0.55rem;
	}

	.primary-action,
	.secondary-action,
	.ghost-action {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 3rem;
		padding: 0.9rem 1.2rem;
		border-radius: 999px;
		text-decoration: none;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		transition:
			transform 0.18s ease,
			box-shadow 0.18s ease,
			border-color 0.18s ease;
	}

	.primary-action {
		background: linear-gradient(135deg, var(--accent), rgba(79, 123, 172, 0.98));
		color: rgba(7, 14, 22, 0.94);
		box-shadow: 0 18px 36px rgba(0, 0, 0, 0.2);
	}

	.secondary-action,
	.ghost-action {
		border: 1px solid rgba(184, 217, 241, 0.24);
		background: rgba(255, 255, 255, 0.04);
		color: var(--band-ink);
	}

	.final-band .primary-action {
		background: linear-gradient(135deg, #9eb2df, #738cc4);
		box-shadow: none;
	}

	.final-band .ghost-action {
		border-color: rgba(97, 115, 153, 0.22);
		background: rgba(255, 255, 255, 0.22);
		color: rgba(13, 20, 28, 0.82);
	}

	.primary-action:hover,
	.secondary-action:hover,
	.ghost-action:hover,
	.nav-cta:hover {
		transform: translateY(-1px);
		text-decoration: none;
	}

	.hero-track {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.8rem;
		padding-top: 1.1rem;
		font-size: 0.74rem;
		font-weight: 700;
		color: rgba(210, 224, 237, 0.72);
	}

	.track-divider {
		width: 2.5rem;
		height: 1px;
		background: linear-gradient(90deg, transparent, var(--accent), transparent);
	}

	.hero-visual {
		position: relative;
		min-height: 39rem;
	}

	.shot-panel {
		margin: 0;
		padding: 0.45rem;
		border-radius: 22px;
		border: 1px solid var(--frame-border, rgba(255, 255, 255, 0.18));
		background: var(--frame-bg, rgba(255, 255, 255, 0.08));
	}

	.shot-panel img {
		display: block;
		width: 100%;
		height: auto;
		border-radius: 16px;
	}

	.hero-main-shot {
		width: min(100%, 47rem);
		margin-left: auto;
		transform: perspective(1800px) rotateY(-10deg) rotateX(3deg);
		transform-origin: right center;
	}

	.hero-secondary-shot {
		position: absolute;
		left: 0;
		bottom: 2.5rem;
		width: min(18rem, 36vw);
	}

	.hero-caption {
		position: absolute;
		right: 0;
		bottom: 0;
		margin: 0;
		max-width: 19rem;
		font-size: 0.78rem;
		line-height: 1.7;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: rgba(202, 219, 233, 0.66);
	}

	.proof-inner {
		display: grid;
		gap: 2.2rem;
	}

	.signal-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1rem;
	}

	.signal-card,
	.signal-plate,
	.assistant-plate {
		display: grid;
		gap: 0.75rem;
		padding: 1.35rem;
		border-radius: 24px;
	}

	.signal-card {
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(246, 239, 234, 0.92));
		border: 1px solid rgba(166, 121, 93, 0.16);
		box-shadow: 0 26px 52px rgba(76, 51, 37, 0.12);
	}

	.surface-layout {
		grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
	}

	.surface-layout.reverse .surface-copy {
		order: 2;
	}

	.surface-layout.reverse .portrait-shot {
		order: 1;
	}

	.surface-copy {
		max-width: 31rem;
	}

	.surface-points,
	.assistant-points {
		display: grid;
		gap: 0.7rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.surface-points li,
	.assistant-points li {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.7rem;
		align-items: start;
		line-height: 1.65;
		color: var(--muted);
	}

	.surface-points li::before {
		content: '::';
		padding-top: 0.12rem;
	}

	.assistant-points li::before {
		content: '//';
		padding-top: 0.12rem;
	}

	.wide-shot {
		align-self: stretch;
	}

	.portrait-shot {
		max-width: 30rem;
		margin-left: auto;
	}

	.signal-plate {
		max-width: 18rem;
		margin-top: 0.5rem;
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.08));
		border: 1px solid rgba(120, 184, 255, 0.24);
		box-shadow: 0 26px 56px rgba(0, 0, 0, 0.24);
	}

	.builder-layout {
		grid-template-columns: minmax(0, 0.88fr) minmax(0, 1.12fr);
		align-items: start;
	}

	.builder-copy {
		max-width: 31rem;
	}

	.builder-gallery {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
		align-items: start;
	}

	.note-shot {
		margin-top: clamp(1.2rem, 4vw, 4rem);
	}

	.assistant-layout {
		grid-template-columns: minmax(0, 1fr) minmax(18rem, 0.86fr);
		align-items: start;
	}

	.assistant-copy {
		max-width: 40rem;
	}

	.assistant-plate {
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.11), rgba(255, 255, 255, 0.07));
		border: 1px solid rgba(255, 190, 108, 0.24);
		box-shadow: 0 26px 56px rgba(0, 0, 0, 0.24);
	}

	.final-inner {
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: end;
	}

	.final-copy {
		max-width: 42rem;
	}

	@media (max-width: 1040px) {
		.hero-grid,
		.surface-layout,
		.builder-layout,
		.assistant-layout,
		.final-inner {
			grid-template-columns: 1fr;
		}

		.signal-grid,
		.builder-gallery {
			grid-template-columns: 1fr;
		}

		.surface-layout.reverse .surface-copy,
		.surface-layout.reverse .portrait-shot {
			order: initial;
		}

		.signal-plate,
		.portrait-shot {
			max-width: none;
			margin-left: 0;
		}

		.note-shot {
			margin-top: 0;
		}
	}

	@media (max-width: 760px) {
		.band {
			padding: 4.5rem 0;
		}

		.landing-nav {
			flex-direction: column;
			align-items: start;
		}

		.landing-nav nav {
			justify-content: flex-start;
		}

		.hero-visual {
			min-height: auto;
			padding-bottom: 8rem;
		}

		.hero-main-shot {
			transform: none;
		}

		.hero-secondary-shot {
			left: 1rem;
			bottom: 3.5rem;
			width: min(15rem, 48vw);
		}

		.hero-caption {
			left: 0;
			right: auto;
			bottom: 0;
			max-width: 14rem;
		}

		h1 {
			max-width: none;
		}

		.signal-grid {
			grid-template-columns: 1fr;
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

		.hero-track {
			gap: 0.55rem;
		}

		.track-divider {
			width: 1.4rem;
		}

		.hero-secondary-shot {
			position: relative;
			left: auto;
			bottom: auto;
			width: 70%;
			margin-top: -2.2rem;
		}

		.hero-visual {
			padding-bottom: 0;
		}

		.hero-caption {
			position: relative;
			margin-top: 1rem;
			max-width: 100%;
		}
	}
</style>
