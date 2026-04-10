<script>
	import { formatMinutes } from '$lib/task-catalog';
	import { dailyStats, dailyTimeline, statsOverview, weeklyStats } from '$lib/task-stats';

	const maxDailyTaskMinutes = Math.max(...dailyStats.byTask.map((task) => task.minutes));
	const maxWeeklyMinutes = Math.max(...weeklyStats.dailyRollup.map((day) => day.minutes));
</script>

<svelte:head>
	<title>Stats</title>
	<meta name="description" content="Placeholder daily and weekly stats for task-monster." />
</svelte:head>

<section class="stats-page">
	<div class="hero">
		<p class="eyebrow">Stats</p>
		<h1>Daily receipts and weekly drift</h1>
		<p class="lede">
			Placeholder numbers for now, just enough structure to prove out the bones before real task
			data starts driving the page.
		</p>
	</div>

	<div class="overview-grid">
		<article class="overview-card">
			<span>Tracked tasks</span>
			<strong>{statsOverview.trackedTasks}</strong>
			<p>Total catalog items currently wired into the app.</p>
		</article>
		<article class="overview-card">
			<span>Active now</span>
			<strong>{statsOverview.activeNow}</strong>
			<p>Tasks currently sitting on the day&apos;s table.</p>
		</article>
		<article class="overview-card">
			<span>Average task</span>
			<strong>{statsOverview.averageTaskMinutes} min</strong>
			<p>Baseline duration for the current filler task set.</p>
		</article>
	</div>

	<div class="section-grid">
		<section class="panel">
			<div class="panel-header">
				<div>
					<p class="section-label">Daily</p>
					<h2>{dailyStats.dateLabel}</h2>
				</div>
				<span class="pill">{dailyStats.completionRate}% complete</span>
			</div>

			<div class="metric-grid">
				<article class="metric-card">
					<span>Time spent</span>
					<strong>{formatMinutes(dailyStats.totalMinutes)}</strong>
				</article>
				<article class="metric-card">
					<span>Tasks done</span>
					<strong>{dailyStats.tasksAccomplished}</strong>
				</article>
				<article class="metric-card accent-card">
					<span>Overlap bonus</span>
					<strong>+{dailyStats.overlapBonus}</strong>
				</article>
			</div>

			<div class="subsection">
				<div class="subsection-header">
					<h3>Time spent by task</h3>
					<p>{dailyStats.recoveries} snooze recoveries landed cleanly.</p>
				</div>

				<div class="task-bars">
					{#each dailyStats.byTask as task}
						<div class="task-bar-row">
							<div class="task-bar-meta">
								<div>
									<strong>{task.name}</strong>
									<p>{task.completed ? 'Completed' : 'In progress'}</p>
								</div>
								<span>{task.minutes} min</span>
							</div>
							<div class="task-bar-track">
								<div
									class="task-bar-fill"
									style={`--task-color: ${task.color}; width: ${(task.minutes / maxDailyTaskMinutes) * 100}%;`}
								></div>
							</div>
							{#if task.overlap}
								<p class="bar-note">Overlap bonus counted on this block.</p>
							{/if}
						</div>
					{/each}
				</div>
			</div>

			<div class="subsection">
				<div class="subsection-header">
					<h3>Day flow</h3>
					<p>Filler timeline showing where multitask credit got picked up.</p>
				</div>

				<div class="timeline">
					{#each dailyTimeline as block}
						<article class="timeline-card">
							<div>
								<strong>{block.label}</strong>
								<p>{block.window}</p>
							</div>
							<div class="timeline-bar">
								<div class="timeline-fill" style={`width: ${block.intensity}%;`}></div>
							</div>
							<p>{block.primary}</p>
							<small>{block.secondary}</small>
						</article>
					{/each}
				</div>
			</div>
		</section>

		<section class="panel weekly-panel">
			<div class="panel-header">
				<div>
					<p class="section-label">Weekly</p>
					<h2>{weeklyStats.weekLabel}</h2>
				</div>
				<span class="pill warm-pill">{weeklyStats.weeklyGoalProgress}% toward weekly goals</span>
			</div>

			<div class="metric-grid">
				<article class="metric-card">
					<span>Weekly minutes</span>
					<strong>{formatMinutes(weeklyStats.totalMinutes)}</strong>
				</article>
				<article class="metric-card">
					<span>Tasks closed</span>
					<strong>{weeklyStats.tasksCompleted}</strong>
				</article>
				<article class="metric-card accent-card warm-card">
					<span>Overlap bonus</span>
					<strong>+{weeklyStats.overlapBonus}</strong>
				</article>
			</div>

			<div class="subsection">
				<div class="subsection-header">
					<h3>Broad progress</h3>
					<p>Weekly tracking stays intentionally wide, not task-by-task obsessive.</p>
				</div>

				<div class="broad-progress">
					{#each weeklyStats.broadProgress as item}
						<article class="broad-card">
							<div class="broad-card-header">
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
			</div>

			<div class="subsection">
				<div class="subsection-header">
					<h3>Week rollup</h3>
					<p>{weeklyStats.consistencyScore}% consistency across the last seven days.</p>
				</div>

				<div class="day-columns">
					{#each weeklyStats.dailyRollup as day}
						<div class="day-column">
							<div class="day-bar-shell">
								<div class="day-bar-fill" style={`height: ${(day.minutes / maxWeeklyMinutes) * 100}%;`}></div>
							</div>
							<strong>{day.day}</strong>
							<span>{day.tasks} tasks</span>
							<small>{day.minutes} min</small>
						</div>
					{/each}
				</div>
			</div>
		</section>
	</div>
</section>

<style>
	.stats-page {
		display: grid;
		gap: 1.4rem;
		padding: 1.4rem 0 2.6rem;
	}

	.hero {
		display: grid;
		gap: 0.5rem;
		max-width: 44rem;
	}

	.eyebrow,
	.section-label {
		margin: 0;
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--color-theme-2);
	}

	h1 {
		margin: 0;
		text-align: left;
		font-size: clamp(2.2rem, 5vw, 3.8rem);
		line-height: 0.95;
		letter-spacing: -0.05em;
		color: rgba(10, 20, 30, 0.92);
	}

	h2,
	h3 {
		margin: 0;
		text-align: left;
	}

	.lede {
		margin: 0;
		font-size: 1.05rem;
		color: rgba(10, 20, 30, 0.7);
	}

	.overview-grid,
	.metric-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.9rem;
	}

	.overview-card,
	.metric-card,
	.panel,
	.timeline-card,
	.broad-card {
		background: rgba(255, 255, 255, 0.62);
		border: 1px solid rgba(255, 255, 255, 0.72);
		box-shadow: 0 18px 36px rgba(44, 62, 80, 0.08);
	}

	.overview-card,
	.metric-card {
		display: grid;
		gap: 0.35rem;
		padding: 1rem 1.05rem;
		border-radius: 18px;
	}

	.overview-card span,
	.metric-card span {
		font-size: 0.76rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba(10, 20, 30, 0.45);
	}

	.overview-card strong,
	.metric-card strong {
		font-size: 1.25rem;
		color: rgba(10, 20, 30, 0.86);
		letter-spacing: -0.03em;
	}

	.overview-card p {
		margin: 0;
		color: rgba(10, 20, 30, 0.62);
	}

	.section-grid {
		display: grid;
		grid-template-columns: 1.05fr 0.95fr;
		gap: 1rem;
	}

	.panel {
		display: grid;
		gap: 1.2rem;
		padding: 1.2rem;
		border-radius: 24px;
	}

	.weekly-panel .section-label {
		color: var(--color-theme-1);
	}

	.panel-header,
	.subsection-header,
	.broad-card-header,
	.task-bar-meta {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	.subsection {
		display: grid;
		gap: 0.8rem;
	}

	.subsection-header p,
	.task-bar-meta p,
	.timeline-card p,
	.broad-card p {
		margin: 0;
		color: rgba(10, 20, 30, 0.62);
	}

	.pill {
		padding: 0.5rem 0.75rem;
		border-radius: 999px;
		background: rgba(64, 117, 166, 0.12);
		color: var(--color-theme-2);
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.warm-pill {
		background: rgba(153, 0, 0, 0.1);
		color: var(--color-theme-1);
	}

	.accent-card {
		background: linear-gradient(135deg, rgba(64, 117, 166, 0.16), rgba(255, 255, 255, 0.78));
	}

	.warm-card {
		background: linear-gradient(135deg, rgba(153, 0, 0, 0.12), rgba(255, 255, 255, 0.78));
	}

	.task-bars,
	.broad-progress,
	.timeline {
		display: grid;
		gap: 0.8rem;
	}

	.task-bar-row {
		display: grid;
		gap: 0.35rem;
	}

	.task-bar-track,
	.progress-track,
	.timeline-bar {
		height: 0.7rem;
		border-radius: 999px;
		background: rgba(13, 24, 36, 0.08);
		overflow: hidden;
	}

	.task-bar-fill,
	.progress-fill,
	.timeline-fill {
		height: 100%;
		border-radius: inherit;
	}

	.task-bar-fill {
		background: linear-gradient(90deg, var(--task-color), color-mix(in srgb, var(--task-color) 40%, white));
	}

	.progress-fill {
		background: linear-gradient(90deg, var(--color-theme-1), #d87474);
	}

	.timeline-fill {
		background: linear-gradient(90deg, var(--color-theme-2), #80b1de);
	}

	.bar-note,
	small {
		margin: 0;
		font-size: 0.8rem;
		color: rgba(10, 20, 30, 0.52);
	}

	.timeline-card,
	.broad-card {
		display: grid;
		gap: 0.55rem;
		padding: 0.95rem 1rem;
		border-radius: 18px;
	}

	.day-columns {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: 0.75rem;
		align-items: end;
		min-height: 14rem;
	}

	.day-column {
		display: grid;
		justify-items: center;
		gap: 0.45rem;
	}

	.day-bar-shell {
		width: 100%;
		height: 9rem;
		display: flex;
		align-items: end;
		padding: 0.35rem;
		box-sizing: border-box;
		border-radius: 18px;
		background: rgba(13, 24, 36, 0.06);
	}

	.day-bar-fill {
		width: 100%;
		border-radius: 14px;
		background: linear-gradient(180deg, var(--color-theme-1), #d87474);
		min-height: 0.8rem;
	}

	.day-column strong {
		font-size: 0.88rem;
	}

	.day-column span {
		font-size: 0.8rem;
		color: rgba(10, 20, 30, 0.62);
	}

	@media (max-width: 900px) {
		.section-grid {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 760px) {
		.overview-grid,
		.metric-grid {
			grid-template-columns: 1fr;
		}

		.day-columns {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}

	@media (max-width: 560px) {
		.panel-header,
		.subsection-header,
		.broad-card-header,
		.task-bar-meta {
			flex-direction: column;
		}

		.day-columns {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
