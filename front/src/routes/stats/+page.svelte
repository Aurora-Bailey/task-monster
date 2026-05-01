<script>
	import { onMount } from 'svelte';

	import { ASSISTANT_REFRESH_EVENT } from '$lib/assistant-client';
	import { PANIC_UPDATED_EVENT } from '$lib/panic-client';
	import { formatElapsedDuration, formatTallyCount } from '$lib/task-format';
	import { loadDailyStats } from '$lib/stats-client';

	const overlapColors = {
		solo: '#6f7d8b',
		double: '#3d9790',
		triple: '#d7b23d',
		quadPlus: '#c74a4a'
	};
	const HOUR_TIER_MS = 60 * 60 * 1000;
	const dayLabelFormatter = new Intl.DateTimeFormat(undefined, {
		month: 'long',
		day: 'numeric'
	});
	const timeLabelFormatter = new Intl.DateTimeFormat(undefined, {
		hour: 'numeric',
		minute: '2-digit'
	});

	let selectedDay = $state(null);
	let summary = $state(null);
	let overlapBands = $state([]);
	let breakdown = $state([]);
	let cadence = $state([]);
	let panicLog = $state([]);
	let doneLog = $state([]);
	let sessionLog = $state([]);
	let isLoading = $state(true);
	let loadError = $state('');
	let timezoneOffsetMinutes = 0;

	function formatDayLabel(day) {
		const [year, month, date] = day.split('-').map((part) => Number.parseInt(part, 10));
		return dayLabelFormatter.format(new Date(year, month - 1, date));
	}

	function formatClock(value) {
		return timeLabelFormatter.format(new Date(value));
	}

	function formatWindow(startedAt, endedAt) {
		return `${formatClock(startedAt)} - ${formatClock(endedAt)}`;
	}

	function formatPanicCharge(value) {
		return `${value}/10 pull`;
	}

	function formatBreakdownMeta(item) {
		const parts = [`${item.runCount} runs`];

		if (item.completedCount) {
			parts.push(`${item.completedCount} done`);
		}

		if (item.totalTallyCount > 0) {
			parts.push(`${formatTallyCount(item.totalTallyCount, item.tallyUnit || 'units')} total`);
		}

		return parts.join(', ');
	}

	function formatDoneValue(item) {
		if (item.trackingType === 'tally') {
			return formatTallyCount(item.tallyCount ?? 0, item.tallyUnit || 'units');
		}

		return formatElapsedDuration(item.spentMilliseconds);
	}

	function formatLedgerValue(row) {
		if (row.trackingType === 'tally') {
			return formatTallyCount(row.tallyCount ?? 0, row.tallyUnit || 'units');
		}

		return formatElapsedDuration(row.spentMilliseconds);
	}

	function getCadenceTierPercent(milliseconds, tierIndex) {
		const tierStart = tierIndex * HOUR_TIER_MS;
		const tierMilliseconds = Math.min(Math.max(milliseconds - tierStart, 0), HOUR_TIER_MS);

		return (tierMilliseconds / HOUR_TIER_MS) * 100;
	}

	function formatOutcome(outcome) {
		if (outcome === 'done') {
			return 'Done';
		}

		if (outcome === 'inactive') {
			return 'Paused';
		}

		return 'Active';
	}

	function getTodayDay() {
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, '0');
		const date = String(now.getDate()).padStart(2, '0');

		return `${year}-${month}-${date}`;
	}

	function shiftDay(day, deltaDays) {
		const [year, month, date] = day.split('-').map((part) => Number.parseInt(part, 10));
		const shifted = new Date(year, month - 1, date + deltaDays);

		return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}-${String(shifted.getDate()).padStart(2, '0')}`;
	}

	async function loadStats(day = selectedDay) {
		isLoading = true;
		loadError = '';

		try {
			const stats = await loadDailyStats({
				day,
				tzOffsetMinutes: timezoneOffsetMinutes
			});

			selectedDay = stats.selectedDay || getTodayDay();
			summary = stats.summary;
			overlapBands = stats.overlapBands ?? [];
			breakdown = stats.breakdown ?? [];
			cadence = stats.cadence ?? [];
			panicLog = stats.panicLog ?? [];
			doneLog = stats.doneLog ?? [];
			sessionLog = stats.sessionLog ?? [];
		} catch (error) {
			loadError = error.message;
		} finally {
			isLoading = false;
		}
	}

	async function selectDay(day) {
		if (!day || day === selectedDay || isLoading) {
			return;
		}

		await loadStats(day);
	}

	async function showNewerDay() {
		if (!canGoNewer) {
			return;
		}

		await loadStats(shiftDay(selectedDay, 1));
	}

	async function showOlderDay() {
		if (!selectedDay) {
			return;
		}

		await loadStats(shiftDay(selectedDay, -1));
	}

	const todayDay = $derived(getTodayDay());
	const visibleDays = $derived(
		selectedDay ? [selectedDay, shiftDay(selectedDay, -1), shiftDay(selectedDay, -2)] : []
	);
	const canGoNewer = $derived(selectedDay !== null && selectedDay < todayDay);
	const canGoOlder = $derived(selectedDay !== null);
	const hasStats = $derived(Boolean(summary) && (summary.runCount > 0 || summary.panicCount > 0));
	const maxOverlapMilliseconds = $derived(
		Math.max(...overlapBands.map((band) => band.milliseconds), 1)
	);
	const maxBreakdownMilliseconds = $derived(
		Math.max(...breakdown.map((item) => item.totalMilliseconds), 1)
	);
	const summaryCards = $derived(
		summary
			? [
					{
						label: 'Focused time',
						value: formatElapsedDuration(summary.effectiveTrackedMilliseconds),
						note: 'Tracked task time after subtracting panic overlap across active runs.'
					},
					{
						label: 'Tracked time',
						value: formatElapsedDuration(summary.trackedMilliseconds),
						note: 'Summed run time for the day. Overlap counts fully.'
					},
					{
						label: 'On-table time',
						value: formatElapsedDuration(summary.wallClockMilliseconds),
						note: 'Unique clock time with at least one active task.'
					},
					{
						label: 'Overlap bonus',
						value: formatElapsedDuration(summary.overlapMilliseconds),
						note: 'Additional tracked time created by concurrent runs.'
					},
					{
						label: 'Done',
						value: `${summary.completedCount}`,
						note: 'Runs that closed with a done outcome on this day.'
					},
					{
						label: 'Paused',
						value: `${summary.pausedCount}`,
						note: 'Runs moved back off the table without being finished.'
					},
					...(summary.panicCount > 0
						? [
								{
									label: 'On-task panic',
									value: formatElapsedDuration(summary.taskPanicMilliseconds),
									note: 'Tracked task time that overlapped with panic mode.'
								},
								{
									label: 'Off rails',
									value: formatElapsedDuration(summary.panicMilliseconds),
									note: 'Time logged in panic mode on the selected day.'
								},
								{
									label: 'Panic hits',
									value: `${summary.panicCount}`,
									note: 'Separate panic sessions started on this day.'
								},
								{
									label: 'Longest panic',
									value: formatElapsedDuration(summary.longestPanicMilliseconds),
									note: 'Longest single off-the-rails stretch.'
								}
							]
						: []),
					...(summary.tallyUnits > 0
						? [
								{
									label: 'Tallied',
									value: formatTallyCount(summary.tallyUnits),
									note: 'Units captured by tally sessions that closed on this day.'
								}
							]
						: []),
					{
						label: 'Longest run',
						value: formatElapsedDuration(summary.longestRunMilliseconds),
						note: 'Longest single clipped run inside the selected day.'
					}
				]
			: []
	);

	onMount(() => {
		timezoneOffsetMinutes = new Date().getTimezoneOffset();
		void loadStats();

		if (typeof window === 'undefined') {
			return;
		}

		const handlePanicUpdated = async () => {
			try {
				await loadStats(selectedDay);
			} catch (error) {
				loadError = error.message;
			}
		};
		const handleAssistantRefresh = async (event) => {
			if (
				event.detail?.refresh?.tasks !== true &&
				event.detail?.refresh?.stats !== true &&
				event.detail?.refresh?.panic !== true
			) {
				return;
			}

			try {
				await loadStats(selectedDay);
			} catch (error) {
				loadError = error.message;
			}
		};

		window.addEventListener(ASSISTANT_REFRESH_EVENT, handleAssistantRefresh);
		window.addEventListener(PANIC_UPDATED_EVENT, handlePanicUpdated);

		return () => {
			window.removeEventListener(ASSISTANT_REFRESH_EVENT, handleAssistantRefresh);
			window.removeEventListener(PANIC_UPDATED_EVENT, handlePanicUpdated);
		};
	});
</script>

<svelte:head>
	<title>Stats</title>
	<meta
		name="description"
		content="Real daily stats built from completed, paused, and currently active task runs."
	/>
</svelte:head>

<section class="stats-page">
	{#if selectedDay}
		<nav class="day-pager" aria-label="Stats days">
			<button
				class="pager-arrow"
				type="button"
				disabled={!canGoNewer || isLoading}
				onclick={showNewerDay}
			>
				&lt;&lt;
			</button>

			<div class="day-pill-row">
				{#each visibleDays as day}
					<button
						class:selected-day={day === selectedDay}
						class="day-pill"
						type="button"
						disabled={isLoading && day !== selectedDay}
						aria-pressed={day === selectedDay}
						onclick={() => selectDay(day)}
					>
						{formatDayLabel(day)}
					</button>
				{/each}
			</div>

			<button
				class="pager-arrow"
				type="button"
				disabled={!canGoOlder || isLoading}
				onclick={showOlderDay}
			>
				&gt;&gt;
			</button>
		</nav>
	{/if}

	<header class="stats-header">
		<div>
			<p class="eyebrow">Stats</p>
			<h1>{selectedDay ? formatDayLabel(selectedDay) : 'Daily stats'}</h1>
			<p class="lede">
				Everything on this page is computed from real task-run data in the database.
			</p>
		</div>
	</header>

	{#if loadError}
		<div class="message-card error-card">
			<strong>Could not load stats</strong>
			<p>{loadError}</p>
		</div>
	{/if}

	{#if isLoading}
		<div class="message-card">
			<strong>Loading stats</strong>
			<p>Pulling task runs, clipping them to the selected day, and computing the report.</p>
		</div>
	{:else if !hasStats}
		<div class="message-card">
			<strong
				>{selectedDay
					? `No tracked activity on ${formatDayLabel(selectedDay)}`
					: 'No tracked activity yet'}</strong
			>
			<p>Stats appear after a task creates a real run or panic mode logs time for that day.</p>
		</div>
	{:else}
		<div class="summary-grid">
			{#each summaryCards as card}
				<article class="summary-card">
					<span>{card.label}</span>
					<strong>{card.value}</strong>
					<p>{card.note}</p>
				</article>
			{/each}
		</div>

		<div class="report-grid">
			<section class="panel">
				<div class="panel-header">
					<div>
						<p class="section-label">Overlap</p>
						<h2>Concurrent time</h2>
					</div>
					<p>Wall-clock time split by how many tasks were active at once.</p>
				</div>

				<div class="metric-list">
					{#each overlapBands as band}
						<article class="metric-row">
							<div class="metric-row__meta">
								<strong>{band.label}</strong>
								<span>{formatElapsedDuration(band.milliseconds)}</span>
							</div>
							<div class="metric-track">
								<div
									class="metric-fill"
									style={`--fill-color: ${overlapColors[band.key]}; width: ${(band.milliseconds / maxOverlapMilliseconds) * 100}%;`}
								></div>
							</div>
						</article>
					{/each}
				</div>
			</section>

			<section class="panel">
				<div class="panel-header">
					<div>
						<p class="section-label">Breakdown</p>
						<h2>Time by task</h2>
					</div>
					<p>The heaviest tasks for the selected day, using tracked task time.</p>
				</div>

				<div class="metric-list">
					{#each breakdown as item}
						<article class="metric-row">
							<div class="metric-row__meta">
								<div>
									<strong>{item.name}</strong>
									<p>{formatBreakdownMeta(item)}</p>
								</div>
								<span>{formatElapsedDuration(item.totalMilliseconds)}</span>
							</div>
							<div class="metric-track">
								<div
									class="metric-fill"
									style={`--fill-color: ${item.color}; width: ${(item.totalMilliseconds / maxBreakdownMilliseconds) * 100}%;`}
								></div>
							</div>
						</article>
					{/each}
				</div>
			</section>

			<section class="panel panel-wide">
				<div class="panel-header">
					<div>
						<p class="section-label">Cadence</p>
						<h2>Hour by hour</h2>
					</div>
					<p>
						Each stacked tier represents another 60 minutes of tracked time inside the same hour.
					</p>
				</div>

				<div class="cadence-legend" aria-hidden="true">
					<span class="legend-pill legend-pill-blue">0-60m</span>
					<span class="legend-pill legend-pill-orange">60-120m</span>
					<span class="legend-pill legend-pill-purple">120m+</span>
				</div>

				<div class="cadence-chart">
					{#each cadence as item}
						<div class="cadence-column">
							<div class="cadence-shell">
								<div class="cadence-tier">
									<div
										class="cadence-fill cadence-fill-purple"
										style={`height: ${getCadenceTierPercent(item.milliseconds, 2)}%;`}
									></div>
								</div>
								<div class="cadence-tier">
									<div
										class="cadence-fill cadence-fill-orange"
										style={`height: ${getCadenceTierPercent(item.milliseconds, 1)}%;`}
									></div>
								</div>
								<div class="cadence-tier">
									<div
										class="cadence-fill cadence-fill-blue"
										style={`height: ${getCadenceTierPercent(item.milliseconds, 0)}%;`}
									></div>
								</div>
							</div>
							<strong>{item.label}</strong>
							<span>{item.milliseconds ? formatElapsedDuration(item.milliseconds) : '0s'}</span>
						</div>
					{/each}
				</div>
			</section>

			<section class="panel">
				<div class="panel-header">
					<div>
						<p class="section-label">Off Rails</p>
						<h2>Panic log</h2>
					</div>
					<p>Every panic window recorded for the selected local day.</p>
				</div>

				<div class="done-log">
					{#if panicLog.length === 0}
						<p class="empty-note">No panic recorded on this day.</p>
					{:else}
						{#each panicLog as item}
							<article class="panic-item">
								<div class="done-item__top">
									<strong>{formatWindow(item.startedAt, item.endedAt)}</strong>
									<span>{formatElapsedDuration(item.milliseconds)}</span>
								</div>
								{#if item.emotionalCharge !== null}
									<p class="panic-item__charge">{formatPanicCharge(item.emotionalCharge)}</p>
								{/if}
								{#if item.note}
									<p class="panic-item__note">{item.note}</p>
								{/if}
							</article>
						{/each}
					{/if}
				</div>
			</section>

			<section class="panel">
				<div class="panel-header">
					<div>
						<p class="section-label">Done</p>
						<h2>Completion log</h2>
					</div>
					<p>Runs that actually closed with a done result on this day.</p>
				</div>

				<div class="done-log">
					{#if doneLog.length === 0}
						<p class="empty-note">Nothing finished on this day.</p>
					{:else}
						{#each doneLog as item}
							<article class="done-item" style={`--task-accent: ${item.color};`}>
								<div class="done-item__top">
									<strong>{item.name}</strong>
									<span>{formatClock(item.completedAt)}</span>
								</div>
								<p>{formatDoneValue(item)}</p>
								{#if item.instanceNote}
									<p class="done-item__instance-note">{item.instanceNote}</p>
								{/if}
								{#if item.taskPanicLog?.length}
									<div class="task-panic-log">
										{#each item.taskPanicLog as panicItem}
											<article class="task-panic-entry">
												<div class="task-panic-entry__top">
													<strong>{formatWindow(panicItem.startedAt, panicItem.endedAt)}</strong>
													<span>{formatElapsedDuration(panicItem.milliseconds)}</span>
												</div>
												{#if panicItem.emotionalCharge !== null}
													<p class="panic-item__charge">
														{formatPanicCharge(panicItem.emotionalCharge)}
													</p>
												{/if}
												{#if panicItem.note}
													<p class="task-panic-entry__note">{panicItem.note}</p>
												{/if}
											</article>
										{/each}
									</div>
								{/if}
							</article>
						{/each}
					{/if}
				</div>
			</section>

			<section class="panel panel-wide">
				<div class="panel-header">
					<div>
						<p class="section-label">Ledger</p>
						<h2>Session log</h2>
					</div>
					<p>Every run that touched the selected day, clipped to the local day window.</p>
				</div>

				<div class="ledger">
					<div class="ledger-head">
						<span>Window</span>
						<span>Task</span>
						<span>Tracked / tally</span>
						<span>Outcome</span>
					</div>

					{#each sessionLog as row}
						<article class="ledger-row">
							<span>{formatWindow(row.startedAt, row.endedAt)}</span>
							<strong>{row.name}</strong>
							<span>{formatLedgerValue(row)}</span>
							<span class={`outcome-pill outcome-${row.outcome}`}>{formatOutcome(row.outcome)}</span
							>
							{#if row.instanceNote}
								<p class="ledger-note">{row.instanceNote}</p>
							{/if}
							{#if row.taskPanicLog?.length}
								<div class="task-panic-log ledger-panic-log">
									{#each row.taskPanicLog as panicItem}
										<article class="task-panic-entry">
											<div class="task-panic-entry__top">
												<strong>{formatWindow(panicItem.startedAt, panicItem.endedAt)}</strong>
												<span>{formatElapsedDuration(panicItem.milliseconds)}</span>
											</div>
											{#if panicItem.emotionalCharge !== null}
												<p class="panic-item__charge">
													{formatPanicCharge(panicItem.emotionalCharge)}
												</p>
											{/if}
											{#if panicItem.note}
												<p class="task-panic-entry__note">{panicItem.note}</p>
											{/if}
										</article>
									{/each}
								</div>
							{/if}
						</article>
					{/each}
				</div>
			</section>
		</div>
	{/if}
</section>

<style>
	.stats-page {
		display: grid;
		gap: 1rem;
		padding: 1.4rem 0 2.4rem;
	}

	.day-pager {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.75rem;
	}

	.day-pill-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
	}

	.day-pill,
	.pager-arrow {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 2.9rem;
		padding: 0.75rem 1rem;
		border: 1px solid var(--surface-border);
		border-radius: 999px;
		background: var(--surface-1);
		box-shadow: var(--surface-shadow);
		font-size: 0.8rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		color: var(--color-muted);
		cursor: pointer;
	}

	.day-pill.selected-day {
		background: var(--accent-gradient);
		color: var(--color-accent-contrast);
		box-shadow: 0 14px 28px color-mix(in srgb, var(--color-accent) 28%, transparent);
	}

	.day-pill:disabled,
	.pager-arrow:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.stats-header {
		display: grid;
		gap: 0.4rem;
		padding: 1.4rem 1.5rem;
		border-radius: 24px;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(245, 249, 255, 0.88)),
			radial-gradient(circle at top, rgba(64, 117, 166, 0.12), rgba(255, 255, 255, 0));
		border: 1px solid rgba(255, 255, 255, 0.75);
		box-shadow:
			0 26px 60px rgba(44, 62, 80, 0.12),
			inset 0 1px 0 rgba(255, 255, 255, 0.9);
	}

	.eyebrow {
		margin: 0;
		font-size: 0.8rem;
		font-weight: 800;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--color-theme-2);
	}

	h1,
	h2,
	strong,
	p,
	span {
		margin: 0;
	}

	h1 {
		font-size: clamp(2.3rem, 5vw, 3.8rem);
		line-height: 0.95;
		letter-spacing: -0.05em;
		color: rgba(10, 20, 30, 0.92);
	}

	h2 {
		font-size: 1.35rem;
		letter-spacing: -0.03em;
		color: rgba(10, 20, 30, 0.88);
	}

	.lede,
	.message-card p,
	.panel-header p,
	.metric-row__meta p,
	.summary-card p,
	.done-item p,
	.empty-note {
		color: rgba(10, 20, 30, 0.66);
	}

	.message-card,
	.panel,
	.summary-card {
		background: rgba(255, 255, 255, 0.58);
		border: 1px solid rgba(255, 255, 255, 0.66);
		box-shadow: 0 14px 32px rgba(44, 62, 80, 0.08);
	}

	.message-card {
		display: grid;
		gap: 0.4rem;
		padding: 1rem 1.1rem;
		border-radius: 18px;
	}

	.error-card {
		border-color: rgba(159, 45, 39, 0.18);
		background: rgba(255, 245, 244, 0.92);
	}

	.summary-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1rem;
	}

	.summary-card {
		display: grid;
		gap: 0.45rem;
		padding: 1.1rem 1.15rem;
		border-radius: 20px;
	}

	.summary-card span,
	.section-label {
		font-size: 0.74rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba(10, 20, 30, 0.48);
	}

	.summary-card strong {
		font-size: 1.3rem;
		letter-spacing: -0.03em;
		color: rgba(10, 20, 30, 0.88);
	}

	.report-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
	}

	.panel {
		display: grid;
		gap: 1rem;
		padding: 1.2rem;
		border-radius: 22px;
	}

	.panel-wide {
		grid-column: 1 / -1;
	}

	.panel-header {
		display: grid;
		gap: 0.3rem;
	}

	.metric-list,
	.done-log {
		display: grid;
		gap: 0.85rem;
	}

	.metric-row {
		display: grid;
		gap: 0.45rem;
	}

	.metric-row__meta {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.8rem;
	}

	.metric-track {
		height: 0.7rem;
		border-radius: 999px;
		background: rgba(20, 28, 38, 0.08);
		overflow: hidden;
	}

	.metric-fill {
		height: 100%;
		min-width: 0.35rem;
		border-radius: 999px;
		background: linear-gradient(
			135deg,
			var(--fill-color),
			color-mix(in srgb, var(--fill-color) 62%, white)
		);
	}

	.cadence-chart {
		display: grid;
		grid-template-columns: repeat(24, minmax(2.6rem, 1fr));
		gap: 0.6rem;
		overflow-x: auto;
		overflow-y: hidden;
		padding-bottom: 0.2rem;
	}

	.cadence-legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
	}

	.legend-pill {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem 0.75rem;
		border-radius: 999px;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.legend-pill-blue {
		background: rgba(79, 110, 214, 0.14);
		color: #3e5ab0;
	}

	.legend-pill-orange {
		background: rgba(201, 123, 34, 0.14);
		color: #a35f12;
	}

	.legend-pill-purple {
		background: rgba(138, 91, 209, 0.14);
		color: #6f47b6;
	}

	.cadence-column {
		display: grid;
		gap: 0.4rem;
		min-width: 2.6rem;
	}

	.cadence-column strong,
	.cadence-column span {
		font-size: 0.72rem;
		text-align: center;
	}

	.cadence-shell {
		height: 10rem;
		display: grid;
		grid-template-rows: repeat(3, minmax(0, 1fr));
		gap: 0.35rem;
		border-radius: 18px;
		padding: 0.45rem;
		background: linear-gradient(180deg, rgba(235, 241, 247, 0.9), rgba(247, 250, 253, 0.9));
		border: 1px solid rgba(20, 28, 38, 0.08);
	}

	.cadence-tier {
		display: flex;
		align-items: flex-end;
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.78);
		overflow: hidden;
	}

	.cadence-fill {
		width: 100%;
		border-radius: 10px;
	}

	.cadence-fill-blue {
		background: linear-gradient(180deg, var(--color-theme-2), #8fc2f0);
	}

	.cadence-fill-orange {
		background: linear-gradient(180deg, #c97b22, #ebb267);
	}

	.cadence-fill-purple {
		background: linear-gradient(180deg, #8a5bd1, #b88af0);
	}

	.done-item {
		display: grid;
		gap: 0.35rem;
		padding: 0.95rem 1rem;
		border-radius: 16px;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(247, 250, 253, 0.92)),
			linear-gradient(135deg, color-mix(in srgb, var(--task-accent) 14%, white), white 65%);
		border: 1px solid color-mix(in srgb, var(--task-accent) 22%, white);
	}

	.panic-item {
		display: grid;
		gap: 0.35rem;
		padding: 0.95rem 1rem;
		border-radius: 16px;
		background:
			linear-gradient(180deg, rgba(255, 249, 245, 0.96), rgba(255, 241, 238, 0.94)),
			linear-gradient(135deg, rgba(255, 159, 63, 0.16), rgba(242, 72, 57, 0.14));
		border: 1px solid rgba(242, 72, 57, 0.18);
	}

	.panic-item__charge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: fit-content;
		padding: 0.38rem 0.62rem;
		border-radius: 999px;
		background: rgba(242, 72, 57, 0.12);
		color: #a33e14;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.panic-item__note {
		margin: 0;
		color: rgba(20, 28, 38, 0.78);
		white-space: pre-wrap;
	}

	.done-item__instance-note {
		margin: 0;
		color: rgba(20, 28, 38, 0.74);
		white-space: pre-wrap;
	}

	.task-panic-log {
		display: grid;
		gap: 0.55rem;
	}

	.task-panic-entry {
		display: grid;
		gap: 0.35rem;
		padding: 0.8rem 0.9rem;
		border-radius: 14px;
		background: rgba(255, 244, 238, 0.78);
		border: 1px solid rgba(242, 72, 57, 0.14);
	}

	.task-panic-entry__top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.task-panic-entry__top strong {
		font-size: 0.84rem;
		color: rgba(20, 28, 38, 0.82);
	}

	.task-panic-entry__top span {
		font-size: 0.8rem;
		font-weight: 700;
		color: rgba(163, 62, 20, 0.82);
	}

	.task-panic-entry__note {
		margin: 0;
		color: rgba(20, 28, 38, 0.74);
		white-space: pre-wrap;
	}

	.done-item__top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.ledger {
		display: grid;
		gap: 0.55rem;
	}

	.ledger-head,
	.ledger-row {
		display: grid;
		grid-template-columns: 1.1fr 1.2fr 0.8fr 0.7fr;
		gap: 0.8rem;
		align-items: center;
	}

	.ledger-head {
		padding: 0 0.2rem;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(20, 28, 38, 0.48);
	}

	.ledger-row {
		padding: 0.95rem 1rem;
		border-radius: 16px;
		background: rgba(255, 255, 255, 0.82);
		border: 1px solid rgba(20, 28, 38, 0.08);
	}

	.ledger-note {
		grid-column: 1 / -1;
		margin-top: -0.1rem;
		color: rgba(20, 28, 38, 0.72);
		white-space: pre-wrap;
	}

	.ledger-panic-log {
		grid-column: 1 / -1;
	}

	.outcome-pill {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.45rem 0.7rem;
		border-radius: 999px;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.outcome-done {
		background: rgba(75, 159, 103, 0.14);
		color: #2f8a4f;
	}

	.outcome-inactive {
		background: rgba(201, 123, 34, 0.14);
		color: #a35f12;
	}

	.outcome-active {
		background: rgba(79, 110, 214, 0.14);
		color: #3e5ab0;
	}

	@media (max-width: 980px) {
		.summary-grid,
		.report-grid {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 760px) {
		.ledger-head,
		.ledger-row {
			grid-template-columns: 1fr;
		}
	}
</style>
