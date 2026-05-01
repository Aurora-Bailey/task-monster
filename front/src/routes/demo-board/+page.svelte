<script>
	import { resolve } from '$app/paths';

	import { session } from '$lib/session';

	const primaryHref = $derived($session.status === 'authenticated' ? '/active' : '/auth');
	const primaryLabel = $derived(
		$session.status === 'authenticated' ? 'Open your table' : 'Create account'
	);

	const screenshots = {
		daymap: resolve('/images/marketing/daymap-board.png'),
		active: resolve('/images/marketing/active-run.png'),
		add: resolve('/images/marketing/add-task-builder.png'),
		notes: resolve('/images/marketing/task-note-surface.png')
	};
</script>

<svelte:head>
	<title>Task Monster Product Tour</title>
	<meta
		name="description"
		content="Public product tour of Task Monster, including daymap, active runtime, task building, and note surfaces."
	/>
</svelte:head>

<section class="demo-shell">
	<div class="demo-hero">
		<p class="eyebrow">Public product tour</p>
		<h1>See the actual surfaces that make the system work.</h1>
		<p class="lede">
			This page is a quick visual walkthrough of the core product: daymapping, active runtime,
			task setup, and note structure. These are real screenshots from the app, not marketing mockups.
		</p>

		<div class="hero-actions">
			<a class="primary-action" href={resolve(primaryHref)}>{primaryLabel}</a>
			<a class="secondary-action" href={resolve('/')}>Back to home</a>
		</div>
	</div>

	<figure class="shot-frame hero-shot">
		<img
			src={screenshots.daymap}
			alt="Task Monster daymap screen showing staged task cards and sort controls."
		/>
	</figure>

	<div class="tour-grid">
		<article class="tour-card wide">
			<div class="tour-copy">
				<p class="card-index">I</p>
				<h2>Daymap is the staging layer between backlog and action.</h2>
				<p>
					Instead of activating directly from an endless list, Task Monster gives today its own
					surface. That keeps planning visible without pretending every captured task is already live.
				</p>
			</div>
		</article>

		<article class="tour-card">
			<figure class="shot-frame">
				<img
					src={screenshots.active}
					alt="Task Monster active task screen showing timer, notes, pomodoro phase, panic time, and done controls."
					loading="lazy"
				/>
			</figure>
			<div class="tour-copy">
				<p class="card-index">II</p>
				<h2>Active runtime keeps the session honest.</h2>
				<p>
					Pomodoro phase, panic overlap, effective time, and run notes all stay attached to the
					live task instead of being scattered into separate utilities.
				</p>
			</div>
		</article>

		<article class="tour-card">
			<figure class="shot-frame">
				<img
					src={screenshots.add}
					alt="Task Monster add-task builder showing color selection, task type, and tracking mode."
					loading="lazy"
				/>
			</figure>
			<div class="tour-copy">
				<p class="card-index">III</p>
				<h2>Tasks are configured for the workflow they belong to.</h2>
				<p>
					You can define type, color, tracking mode, and pomodoro cadence up front so the
					system behaves differently for different categories of work.
				</p>
			</div>
		</article>

		<article class="tour-card">
			<figure class="shot-frame">
				<img
					src={screenshots.notes}
					alt="Task Monster task note surface showing a persistent note area."
					loading="lazy"
				/>
			</figure>
			<div class="tour-copy">
				<p class="card-index">IV</p>
				<h2>Notes live where they make sense later.</h2>
				<p>
					Persistent task context belongs on the task itself, while session detail can live on the
					run. The distinction sounds small, but it makes history much easier to trust.
				</p>
			</div>
		</article>
	</div>
</section>

<style>
	.demo-shell {
		display: grid;
		gap: 1.4rem;
		padding: 1rem 0 2.6rem;
		--marketing-display: 'Avenir Next', 'Helvetica Neue', 'Segoe UI', sans-serif;
	}

	.demo-hero {
		display: grid;
		gap: 0.8rem;
		max-width: 48rem;
	}

	.eyebrow,
	.card-index {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: rgba(88, 123, 154, 0.88);
	}

	h1,
	h2 {
		margin: 0;
		text-align: left;
		font-family: var(--marketing-display);
		letter-spacing: -0.05em;
		color: rgba(8, 18, 28, 0.92);
	}

	h1 {
		font-size: clamp(2.7rem, 6vw, 4.6rem);
		line-height: 0.94;
		max-width: 11ch;
	}

	h2 {
		font-size: 1.12rem;
		line-height: 1.1;
	}

	.lede {
		margin: 0;
		line-height: 1.65;
		color: rgba(10, 20, 30, 0.68);
	}

	.lede {
		max-width: 42rem;
		font-size: 1.03rem;
	}

	.hero-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.8rem;
		padding-top: 0.25rem;
	}

	.primary-action,
	.secondary-action {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 2.9rem;
		padding: 0.85rem 1.15rem;
		border-radius: 999px;
		text-decoration: none;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.primary-action {
		background: linear-gradient(135deg, #3c6d9d, #8bc0f2);
		color: rgba(247, 251, 255, 0.96);
		box-shadow: 0 16px 32px rgba(58, 109, 159, 0.24);
	}

	.secondary-action {
		border: 1px solid rgba(64, 117, 166, 0.18);
		background: rgba(255, 255, 255, 0.56);
		color: rgba(8, 18, 28, 0.78);
	}

	.shot-frame {
		margin: 0;
		overflow: hidden;
		border-radius: 26px;
		border: 1px solid rgba(177, 208, 232, 0.2);
		background: rgba(255, 255, 255, 0.92);
		box-shadow:
			0 26px 56px rgba(43, 61, 80, 0.12),
			inset 0 1px 0 rgba(255, 255, 255, 0.94);
	}

	.shot-frame img {
		display: block;
		width: 100%;
		height: auto;
	}

	.hero-shot {
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(241, 247, 252, 0.9)),
			radial-gradient(circle at top, rgba(96, 152, 206, 0.08), transparent 55%);
	}

	.tour-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
	}

	.tour-card {
		display: grid;
		gap: 0.7rem;
		padding: 1.15rem;
		border-radius: 18px;
		border: 1px solid rgba(177, 208, 232, 0.18);
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.86), rgba(242, 247, 252, 0.78)),
			radial-gradient(circle at top, rgba(96, 152, 206, 0.08), transparent 55%);
		box-shadow:
			0 20px 40px rgba(43, 61, 80, 0.08),
			inset 0 1px 0 rgba(255, 255, 255, 0.92);
	}

	.tour-card.wide {
		grid-column: 1 / -1;
	}

	.tour-copy {
		display: grid;
		gap: 0.7rem;
	}

	@media (max-width: 760px) {
		h1 {
			max-width: none;
		}

		.tour-grid {
			grid-template-columns: 1fr;
		}

		.tour-card.wide {
			grid-column: auto;
		}
	}

	@media (max-width: 520px) {
		.hero-actions {
			flex-direction: column;
		}

		.primary-action,
		.secondary-action {
			width: 100%;
		}
	}
</style>
