<script>
	import { reportOptions, statsOverview, statsReports } from '$lib/task-stats';

	let selectedReportId = $state('today');

	const activeReport = $derived(statsReports[selectedReportId]);
	const maxOverlapMinutes = $derived(
		Math.max(...activeReport.overlapBands.map((band) => band.minutes), 1)
	);
	const maxBreakdownMinutes = $derived(
		Math.max(...activeReport.breakdown.items.map((item) => item.minutes), 1)
	);
	const maxCadenceMinutes = $derived(
		Math.max(...activeReport.cadence.items.map((item) => item.minutes), 1)
	);

	function formatDuration(minutes) {
		if (!minutes) {
			return '0 min';
		}

		const hours = Math.floor(minutes / 60);
		const remainingMinutes = minutes % 60;

		if (!hours) {
			return `${minutes} min`;
		}

		if (!remainingMinutes) {
			return `${hours} hr${hours === 1 ? '' : 's'}`;
		}

		return `${hours}h ${remainingMinutes}m`;
	}
</script>

<svelte:head>
	<title>Stats</title>
	<meta
		name="description"
		content="Daily, weekly, and monthly stats prototypes for task-monster."
	/>
</svelte:head>

<section class="stats-page">
	<div class="hero-shell">
		<div class="hero-copy">
			<p class="eyebrow">{activeReport.eyebrow}</p>
			<h1>{activeReport.title}</h1>
			<p class="lede">{activeReport.subtitle}</p>
		</div>

		<div class="hero-aside">
			<div class="range-switch" role="group" aria-label="Switch stats report window">
				{#each reportOptions as option}
					<button
						type="button"
						class:selected={selectedReportId === option.id}
						aria-pressed={selectedReportId === option.id}
						onclick={() => {
							selectedReportId = option.id;
						}}
					>
						<strong>{option.label}</strong>
						<span>{option.caption}</span>
					</button>
				{/each}
			</div>

			<article class="hero-card">
				<div class="hero-card__top">
					<div>
						<p class="hero-card__label">{activeReport.windowLabel}</p>
						<h2>Dense readout</h2>
					</div>
					<span class="status-pill">{activeReport.status}</span>
				</div>

				<div class="hero-card__body">
					<div class="score-orb" style={`--score: ${activeReport.heroScore.value};`}>
						<div class="score-orb__inner">
							<span>{activeReport.heroScore.label}</span>
							<strong>{activeReport.heroScore.value}</strong>
						</div>
					</div>

					<p class="hero-card__note">{activeReport.heroScore.note}</p>
				</div>

				<div class="score-grid">
					{#each activeReport.scoreCards as score}
						<article class="score-card">
							<div class="score-card__top">
								<span>{score.label}</span>
								<strong>{score.value}%</strong>
							</div>
							<div class="meter-track">
								<div class="meter-fill" style={`width: ${score.value}%;`}></div>
							</div>
							<p>{score.note}</p>
						</article>
					{/each}
				</div>
			</article>
		</div>
	</div>

	<div class="overview-grid">
		{#each statsOverview as card}
			<article class="overview-card">
				<span>{card.label}</span>
				<strong>{card.value}</strong>
				<p>{card.note}</p>
			</article>
		{/each}
	</div>

	<div class="metric-grid">
		{#each activeReport.metricCards as metric}
			<article class={`metric-card tone-${metric.tone ?? 'default'}`}>
				<span>{metric.label}</span>
				<strong>{metric.value}</strong>
				<p>{metric.note}</p>
			</article>
		{/each}
	</div>

	<div class="report-grid">
		<section class="panel panel-wide">
			<div class="panel-header">
				<div>
					<p class="section-label">Overlap</p>
					<h2>Output stack</h2>
				</div>
				<p>Single-task focus still carries the bulk, but the bonus lanes are easy to spot.</p>
			</div>

			<div class="output-grid">
				<div class="overlap-lanes">
					{#each activeReport.overlapBands as band}
						<article class="overlap-lane">
							<div class="overlap-lane__meta">
								<div>
									<strong>{band.label}</strong>
									<p>{band.note}</p>
								</div>
								<span>{formatDuration(band.minutes)}</span>
							</div>

							<div class="overlap-track">
								<div
									class="overlap-fill"
									style={`--band-color: ${band.color}; width: ${(band.minutes / maxOverlapMinutes) * 100}%;`}
								></div>
							</div>
						</article>
					{/each}
				</div>

				<div class="counter-grid">
					{#each activeReport.counters as counter}
						<article class="counter-card">
							<span>{counter.label}</span>
							<strong>{counter.value}</strong>
							<p>{counter.note}</p>
						</article>
					{/each}
				</div>
			</div>
		</section>

		<section class="panel">
			<div class="panel-header">
				<div>
					<p class="section-label">Breakdown</p>
					<h2>{activeReport.breakdown.title}</h2>
				</div>
				<p>{activeReport.breakdown.caption}</p>
			</div>

			<div class="breakdown-list">
				{#each activeReport.breakdown.items as item}
					<article class="breakdown-row">
						<div class="breakdown-row__meta">
							<div>
								<strong>{item.label}</strong>
								<p>{item.note}</p>
							</div>
							<span>{formatDuration(item.minutes)}</span>
						</div>

						<div class="breakdown-track">
							<div
								class="breakdown-fill"
								style={`--breakdown-color: ${item.color}; width: ${(item.minutes / maxBreakdownMinutes) * 100}%;`}
							></div>
						</div>
					</article>
				{/each}
			</div>
		</section>

		<section class="panel">
			<div class="panel-header">
				<div>
					<p class="section-label">Cadence</p>
					<h2>{activeReport.cadence.title}</h2>
				</div>
				<p>{activeReport.cadence.caption}</p>
			</div>

			<div class="cadence-chart">
				{#each activeReport.cadence.items as item}
					<div class="cadence-column">
						<div class="cadence-shell">
							<div
								class="cadence-fill"
								style={`--cadence-color: ${item.color}; height: ${(item.minutes / maxCadenceMinutes) * 100}%;`}
							></div>
						</div>
						<strong>{item.label}</strong>
						<span>{formatDuration(item.minutes)}</span>
						<small>{item.note}</small>
					</div>
				{/each}
			</div>
		</section>

		<section class="panel">
			<div class="panel-header">
				<div>
					<p class="section-label">Stacks</p>
					<h2>Top pairings</h2>
				</div>
				<p>Where multi-tasking actually paid off instead of just sounding efficient.</p>
			</div>

			<div class="combo-list">
				{#each activeReport.combos as combo}
					<article class="combo-card">
						<div class="combo-card__top">
							<strong>{combo.title}</strong>
							<span>{combo.multiplier}</span>
						</div>
						<p>{combo.note}</p>
						<small>{formatDuration(combo.minutes)} of overlapped credit</small>
					</article>
				{/each}
			</div>
		</section>

		<section class="panel">
			<div class="panel-header">
				<div>
					<p class="section-label">Progress</p>
					<h2>Broad progress</h2>
				</div>
				<p>Weekly and monthly sections widen out, but even the daily view benefits from a broader lens.</p>
			</div>

			<div class="progress-list">
				{#each activeReport.progress as item}
					<article class="progress-row">
						<div class="progress-row__meta">
							<strong>{item.label}</strong>
							<span>{item.progress}%</span>
						</div>
						<div class="progress-track">
							<div class="progress-fill" style={`width: ${item.progress}%;`}></div>
						</div>
						<p>{item.note}</p>
					</article>
				{/each}
			</div>
		</section>

		<section class="panel">
			<div class="panel-header">
				<div>
					<p class="section-label">Done</p>
					<h2>Done log</h2>
				</div>
				<p>Quick close ledger. Useful for seeing what really got finished versus just touched.</p>
			</div>

			<div class="done-log">
				{#each activeReport.doneLog as item}
					<article class="done-item">
						<div class="done-item__top">
							<strong>{item.title}</strong>
							<span>{item.time}</span>
						</div>
						<p>{item.note}</p>
					</article>
				{/each}
			</div>
		</section>

		<section class="panel panel-wide">
			<div class="panel-header">
				<div>
					<p class="section-label">Ledger</p>
					<h2>Session log</h2>
				</div>
				<p>Approximate filler timing for each run. This is the shape the real activity ledger can grow into later.</p>
			</div>

			<div class="ledger">
				<div class="ledger-head">
					<span>Window</span>
					<span>Stack</span>
					<span>Minutes</span>
					<span>Overlap</span>
					<span>Outcome</span>
				</div>

				{#each activeReport.sessionLog as row}
					<article class="ledger-row">
						<span>{row.window}</span>
						<strong>{row.stack}</strong>
						<span>{formatDuration(row.minutes)}</span>
						<span class="ledger-chip">{row.overlap}</span>
						<span>{row.outcome}</span>
					</article>
				{/each}
			</div>
		</section>
	</div>
</section>

<style>
	.stats-page {
		display: grid;
		gap: 1.15rem;
		padding: 1.25rem 0 2.8rem;
	}

	.hero-shell {
		display: grid;
		grid-template-columns: minmax(0, 1.1fr) minmax(20rem, 0.9fr);
		gap: 1rem;
		align-items: start;
	}

	.hero-copy,
	.hero-aside,
	.hero-card,
	.score-grid,
	.metric-grid,
	.report-grid,
	.output-grid,
	.overlap-lanes,
	.counter-grid,
	.breakdown-list,
	.combo-list,
	.progress-list,
	.done-log {
		display: grid;
	}

	.hero-copy {
		gap: 0.6rem;
		padding: 1.4rem 1.5rem 1.2rem;
		border-radius: 30px;
		background:
			radial-gradient(circle at top left, rgba(85, 141, 197, 0.24), transparent 40%),
			linear-gradient(160deg, rgba(255, 255, 255, 0.94), rgba(245, 249, 253, 0.86));
		border: 1px solid rgba(255, 255, 255, 0.72);
		box-shadow: 0 26px 52px rgba(38, 56, 74, 0.1);
	}

	.eyebrow,
	.section-label,
	.hero-card__label {
		margin: 0;
		font-size: 0.74rem;
		font-weight: 800;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--color-theme-2) 82%, black);
	}

	h1,
	h2 {
		margin: 0;
		text-align: left;
		letter-spacing: -0.05em;
		color: rgba(12, 20, 30, 0.94);
	}

	h1 {
		font-size: clamp(2.5rem, 6vw, 4.6rem);
		line-height: 0.92;
	}

	h2 {
		font-size: 1.3rem;
	}

	p,
	strong {
		margin: 0;
	}

	.lede {
		max-width: 43rem;
		font-size: 1.02rem;
		line-height: 1.55;
		color: rgba(12, 20, 30, 0.68);
	}

	.hero-aside {
		gap: 0.9rem;
	}

	.range-switch {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.55rem;
		padding: 0.5rem;
		border-radius: 22px;
		background: rgba(255, 255, 255, 0.74);
		border: 1px solid rgba(255, 255, 255, 0.72);
		box-shadow: 0 18px 36px rgba(38, 56, 74, 0.08);
	}

	.range-switch button {
		display: grid;
		gap: 0.18rem;
		padding: 0.8rem 0.9rem;
		border: 0;
		border-radius: 16px;
		background: transparent;
		color: rgba(12, 20, 30, 0.7);
		text-align: left;
		cursor: pointer;
		transition:
			transform 0.15s ease,
			background 0.15s ease,
			box-shadow 0.15s ease;
	}

	.range-switch button strong {
		font-size: 0.9rem;
	}

	.range-switch button span {
		font-size: 0.74rem;
		color: rgba(12, 20, 30, 0.5);
	}

	.range-switch button:hover {
		transform: translateY(-1px);
		background: rgba(64, 117, 166, 0.08);
	}

	.range-switch button.selected {
		background:
			linear-gradient(135deg, rgba(64, 117, 166, 0.16), rgba(255, 255, 255, 0.94)),
			rgba(255, 255, 255, 0.95);
		box-shadow: inset 0 0 0 1px rgba(64, 117, 166, 0.16);
	}

	.hero-card,
	.overview-card,
	.metric-card,
	.panel,
	.score-card,
	.counter-card,
	.combo-card,
	.done-item {
		background: rgba(255, 255, 255, 0.7);
		border: 1px solid rgba(255, 255, 255, 0.76);
		box-shadow: 0 22px 44px rgba(38, 56, 74, 0.08);
	}

	.hero-card {
		gap: 1rem;
		padding: 1.15rem;
		border-radius: 28px;
	}

	.hero-card__top,
	.score-card__top,
	.panel-header,
	.overlap-lane__meta,
	.breakdown-row__meta,
	.combo-card__top,
	.progress-row__meta,
	.done-item__top,
	.ledger-row,
	.ledger-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	.hero-card__top {
		flex-wrap: wrap;
	}

	.status-pill {
		padding: 0.45rem 0.7rem;
		border-radius: 999px;
		background: rgba(64, 117, 166, 0.1);
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--color-theme-2) 78%, black);
	}

	.hero-card__body {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 1rem;
		align-items: center;
	}

	.score-orb {
		display: grid;
		place-items: center;
		width: 9rem;
		aspect-ratio: 1;
		padding: 0.8rem;
		border-radius: 999px;
		background:
			conic-gradient(
				from -90deg,
				color-mix(in srgb, var(--color-theme-2) 90%, white) calc(var(--score) * 1%),
				rgba(12, 20, 30, 0.08) 0
			);
		box-shadow:
			inset 0 0 0 1px rgba(255, 255, 255, 0.86),
			0 20px 34px rgba(64, 117, 166, 0.18);
	}

	.score-orb__inner {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		border-radius: inherit;
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(244, 248, 252, 0.94));
		text-align: center;
	}

	.score-orb__inner span {
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(12, 20, 30, 0.48);
	}

	.score-orb__inner strong {
		font-size: 2.15rem;
		letter-spacing: -0.06em;
		color: rgba(12, 20, 30, 0.92);
	}

	.hero-card__note {
		font-size: 0.98rem;
		line-height: 1.55;
		color: rgba(12, 20, 30, 0.68);
	}

	.score-grid {
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.7rem;
	}

	.score-card {
		gap: 0.5rem;
		padding: 0.85rem 0.95rem;
		border-radius: 18px;
	}

	.score-card__top span,
	.overview-card span,
	.metric-card span,
	.counter-card span {
		font-size: 0.74rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgba(12, 20, 30, 0.48);
	}

	.score-card__top strong,
	.overview-card strong,
	.metric-card strong,
	.counter-card strong {
		font-size: 1.22rem;
		letter-spacing: -0.04em;
		color: rgba(12, 20, 30, 0.9);
	}

	.meter-track,
	.overlap-track,
	.breakdown-track,
	.progress-track {
		height: 0.72rem;
		border-radius: 999px;
		background: rgba(12, 20, 30, 0.08);
		overflow: hidden;
	}

	.meter-fill,
	.progress-fill {
		height: 100%;
		border-radius: inherit;
		background: linear-gradient(90deg, var(--color-theme-2), #9ac0e5);
	}

	.score-card p,
	.overview-card p,
	.metric-card p,
	.panel-header p,
	.counter-card p,
	.overlap-lane__meta p,
	.breakdown-row__meta p,
	.combo-card p,
	.progress-row p,
	.done-item p {
		font-size: 0.92rem;
		line-height: 1.45;
		color: rgba(12, 20, 30, 0.62);
	}

	.overview-grid {
		grid-template-columns: repeat(6, minmax(0, 1fr));
		gap: 0.8rem;
	}

	.metric-grid {
		grid-template-columns: repeat(6, minmax(0, 1fr));
		gap: 0.8rem;
	}

	.overview-card,
	.metric-card,
	.counter-card {
		gap: 0.35rem;
		padding: 0.95rem 1rem;
		border-radius: 20px;
	}

	.tone-ink {
		background: linear-gradient(160deg, rgba(255, 255, 255, 0.76), rgba(240, 245, 250, 0.9));
	}

	.tone-teal {
		background: linear-gradient(160deg, rgba(61, 151, 144, 0.14), rgba(255, 255, 255, 0.9));
	}

	.tone-gold {
		background: linear-gradient(160deg, rgba(215, 178, 61, 0.16), rgba(255, 255, 255, 0.92));
	}

	.tone-rose {
		background: linear-gradient(160deg, rgba(199, 74, 74, 0.14), rgba(255, 255, 255, 0.9));
	}

	.tone-night {
		background: linear-gradient(160deg, rgba(18, 32, 46, 0.14), rgba(255, 255, 255, 0.9));
	}

	.tone-blue {
		background: linear-gradient(160deg, rgba(79, 110, 214, 0.12), rgba(255, 255, 255, 0.92));
	}

	.report-grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.95rem;
	}

	.panel {
		gap: 1rem;
		padding: 1.15rem;
		border-radius: 26px;
	}

	.panel-wide {
		grid-column: span 2;
	}

	.output-grid {
		grid-template-columns: minmax(0, 1.1fr) minmax(19rem, 0.9fr);
		gap: 1rem;
	}

	.overlap-lanes,
	.breakdown-list,
	.combo-list,
	.progress-list,
	.done-log {
		gap: 0.8rem;
	}

	.overlap-lane,
	.breakdown-row,
	.progress-row {
		display: grid;
		gap: 0.4rem;
	}

	.overlap-lane__meta strong,
	.breakdown-row__meta strong,
	.combo-card__top strong,
	.progress-row__meta strong,
	.done-item__top strong,
	.ledger-row strong {
		font-size: 0.98rem;
		color: rgba(12, 20, 30, 0.88);
	}

	.overlap-lane__meta span,
	.breakdown-row__meta span,
	.progress-row__meta span,
	.done-item__top span {
		font-size: 0.86rem;
		font-weight: 700;
		color: rgba(12, 20, 30, 0.6);
	}

	.overlap-fill,
	.breakdown-fill {
		height: 100%;
		border-radius: inherit;
	}

	.overlap-fill {
		background: linear-gradient(
			90deg,
			var(--band-color),
			color-mix(in srgb, var(--band-color) 40%, white)
		);
	}

	.breakdown-fill {
		background: linear-gradient(
			90deg,
			var(--breakdown-color),
			color-mix(in srgb, var(--breakdown-color) 38%, white)
		);
	}

	.counter-grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem;
	}

	.cadence-chart {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(4.2rem, 1fr));
		gap: 0.75rem;
		align-items: end;
		min-height: 15rem;
	}

	.cadence-column {
		display: grid;
		justify-items: center;
		gap: 0.35rem;
	}

	.cadence-shell {
		width: 100%;
		height: 10rem;
		display: flex;
		align-items: end;
		padding: 0.32rem;
		box-sizing: border-box;
		border-radius: 18px;
		background: rgba(12, 20, 30, 0.06);
	}

	.cadence-fill {
		width: 100%;
		min-height: 0.9rem;
		border-radius: 14px;
		background: linear-gradient(
			180deg,
			var(--cadence-color),
			color-mix(in srgb, var(--cadence-color) 35%, white)
		);
	}

	.cadence-column strong {
		font-size: 0.86rem;
		color: rgba(12, 20, 30, 0.88);
	}

	.cadence-column span,
	.cadence-column small,
	.combo-card small {
		color: rgba(12, 20, 30, 0.58);
	}

	.cadence-column span {
		font-size: 0.8rem;
		font-weight: 700;
	}

	.cadence-column small {
		text-align: center;
		font-size: 0.74rem;
		line-height: 1.25;
	}

	.combo-card,
	.done-item {
		gap: 0.55rem;
		padding: 0.95rem 1rem;
		border-radius: 18px;
	}

	.combo-card__top span {
		padding: 0.28rem 0.5rem;
		border-radius: 999px;
		background: rgba(64, 117, 166, 0.1);
		font-size: 0.74rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--color-theme-2) 82%, black);
	}

	.progress-track {
		margin: 0.08rem 0 0.12rem;
	}

	.progress-fill {
		background: linear-gradient(90deg, var(--color-theme-1), #d87474);
	}

	.ledger {
		display: grid;
		gap: 0.55rem;
	}

	.ledger-head,
	.ledger-row {
		display: grid;
		grid-template-columns: 1.05fr 1.6fr 0.8fr 0.8fr 0.8fr;
		align-items: center;
		gap: 0.75rem;
	}

	.ledger-head {
		padding: 0 0.25rem;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba(12, 20, 30, 0.48);
	}

	.ledger-row {
		padding: 0.9rem 1rem;
		border-radius: 18px;
		background: rgba(247, 249, 252, 0.82);
		border: 1px solid rgba(12, 20, 30, 0.06);
	}

	.ledger-row span {
		font-size: 0.86rem;
		color: rgba(12, 20, 30, 0.66);
	}

	.ledger-chip {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: fit-content;
		padding: 0.3rem 0.5rem;
		border-radius: 999px;
		background: rgba(12, 20, 30, 0.08);
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(12, 20, 30, 0.62);
	}

	@media (max-width: 1100px) {
		.hero-shell,
		.output-grid,
		.report-grid {
			grid-template-columns: 1fr;
		}

		.panel-wide {
			grid-column: auto;
		}

		.overview-grid,
		.metric-grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	@media (max-width: 820px) {
		.range-switch {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.hero-card__body,
		.score-grid,
		.counter-grid,
		.ledger-head,
		.ledger-row {
			grid-template-columns: 1fr;
		}

		.score-grid {
			gap: 0.6rem;
		}

		.ledger-head {
			display: none;
		}

		.ledger-row {
			gap: 0.35rem;
		}
	}

	@media (max-width: 640px) {
		.overview-grid,
		.metric-grid {
			grid-template-columns: 1fr;
		}

		.hero-copy,
		.hero-card,
		.panel {
			padding: 1rem;
		}

		.panel-header,
		.overlap-lane__meta,
		.breakdown-row__meta,
		.done-item__top,
		.progress-row__meta {
			flex-direction: column;
		}
	}
</style>
