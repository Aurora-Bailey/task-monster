<script>
	import { onMount } from 'svelte';

	import { ASSISTANT_REFRESH_EVENT } from '$lib/assistant-client';
	import { PANIC_UPDATED_EVENT } from '$lib/panic-client';
	import { formatElapsedDuration } from '$lib/task-format';
	import { loadStatsHeatmap } from '$lib/stats-client';

	const DAYS_PER_BATCH = 10;
	const MINUTES_PER_DAY = 24 * 60;
	const MINUTES_PER_HOUR = 60;
	const MINUTE_MS = 60 * 1000;
	const EMPTY_MINUTE = Object.freeze({
		active: false,
		fill: '',
		glow: '',
		label: ''
	});
	const taskColorLegend = [
		{ key: 'red', label: 'System', color: '#c74a4a' },
		{ key: 'orange', label: 'World', color: '#de7d37' },
		{ key: 'gold', label: 'Home', color: '#d7b23d' },
		{ key: 'green', label: 'Body', color: '#5f9b55' },
		{ key: 'teal', label: 'Reset', color: '#3d9790' },
		{ key: 'blue', label: 'Craft', color: '#4f6ed6' },
		{ key: 'violet', label: 'Becoming', color: '#8a5bd1' }
	];
	const dayLabelFormatter = new Intl.DateTimeFormat(undefined, {
		weekday: 'short',
		month: 'short',
		day: 'numeric'
	});
	const clockFormatter = new Intl.DateTimeFormat(undefined, {
		hour: 'numeric',
		minute: '2-digit'
	});

	let days = $state([]);
	let nextStartDay = $state(null);
	let isLoadingInitial = $state(true);
	let isLoadingMore = $state(false);
	let loadError = $state('');
	let timezoneOffsetMinutes = 0;
	let sentinel = $state(null);

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

	function getLocalDayStartMs(day) {
		const [year, month, date] = day.split('-').map((part) => Number.parseInt(part, 10));

		return new Date(year, month - 1, date, 0, 0, 0, 0).getTime();
	}

	function formatDayLabel(day) {
		const [year, month, date] = day.split('-').map((part) => Number.parseInt(part, 10));

		return dayLabelFormatter.format(new Date(year, month - 1, date));
	}

	function formatMinuteLabel(day, minuteIndex) {
		return clockFormatter.format(new Date(getLocalDayStartMs(day) + minuteIndex * MINUTE_MS));
	}

	function buildSplitFill(colors) {
		const visibleColors = colors.filter(Boolean).slice(0, 3);

		if (visibleColors.length === 0) {
			return '';
		}

		if (visibleColors.length === 1) {
			return visibleColors[0];
		}

		const segmentSize = 100 / visibleColors.length;
		const segments = visibleColors.map(
			(color, index) => `${color} ${index * segmentSize}% ${(index + 1) * segmentSize}%`
		);

		return `linear-gradient(180deg, ${segments.join(', ')})`;
	}

	function getUniqueTaskSessions(sessions) {
		const seenTaskIds = new Set();

		return sessions.filter((session) => {
			const key = session.taskId || session.id;

			if (seenTaskIds.has(key)) {
				return false;
			}

			seenTaskIds.add(key);
			return true;
		});
	}

	function buildMinuteCells(day) {
		const dayStartMs = getLocalDayStartMs(day.day);
		const minuteBuckets = Array.from({ length: MINUTES_PER_DAY }, () => []);

		for (const session of day.sessions ?? []) {
			const startedAtMs = new Date(session.startedAt).getTime();
			const endedAtMs = new Date(session.endedAt).getTime();

			if (
				!Number.isFinite(startedAtMs) ||
				!Number.isFinite(endedAtMs) ||
				endedAtMs <= startedAtMs
			) {
				continue;
			}

			const startMinute = Math.max(0, Math.floor((startedAtMs - dayStartMs) / MINUTE_MS));
			const endMinute = Math.min(MINUTES_PER_DAY, Math.ceil((endedAtMs - dayStartMs) / MINUTE_MS));

			for (let minute = startMinute; minute < endMinute; minute += 1) {
				minuteBuckets[minute].push(session);
			}
		}

		return minuteBuckets.map((sessions, minuteIndex) => {
			if (sessions.length === 0) {
				return EMPTY_MINUTE;
			}

			const uniqueTaskSessions = getUniqueTaskSessions(sessions);
			const uniqueTaskNames = uniqueTaskSessions.map((session) => session.name);
			const uniqueColors = uniqueTaskSessions.map((session) => session.color).filter(Boolean);

			return {
				active: true,
				fill: buildSplitFill(uniqueColors),
				glow: uniqueColors[0] ?? '',
				label: `${formatMinuteLabel(day.day, minuteIndex)}: ${uniqueTaskNames.join(' + ')}`
			};
		});
	}

	function reverseHourRows(minutes) {
		const reversedMinutes = [];

		for (let hour = 23; hour >= 0; hour -= 1) {
			const hourStart = hour * MINUTES_PER_HOUR;
			reversedMinutes.push(...minutes.slice(hourStart, hourStart + MINUTES_PER_HOUR));
		}

		return reversedMinutes;
	}

	function getDayActiveMilliseconds(day) {
		return (day.sessions ?? []).reduce((total, session) => {
			const startedAtMs = new Date(session.startedAt).getTime();
			const endedAtMs = new Date(session.endedAt).getTime();

			if (!Number.isFinite(startedAtMs) || !Number.isFinite(endedAtMs)) {
				return total;
			}

			return total + Math.max(0, endedAtMs - startedAtMs);
		}, 0);
	}

	function getDayTaskCount(day) {
		return new Set((day.sessions ?? []).map((session) => session.taskId)).size;
	}

	function getDaySummary(day) {
		const activeMilliseconds = getDayActiveMilliseconds(day);
		const taskCount = getDayTaskCount(day);

		if (activeMilliseconds === 0) {
			return 'No active task minutes';
		}

		return `${formatElapsedDuration(activeMilliseconds)} across ${taskCount} task${taskCount === 1 ? '' : 's'}`;
	}

	function normalizeDay(day) {
		return {
			...day,
			minutes: reverseHourRows(buildMinuteCells(day))
		};
	}

	async function loadNextBatch({ reset = false } = {}) {
		if (isLoadingMore || (isLoadingInitial && !reset)) {
			return;
		}

		const batchStartDay = reset ? getTodayDay() : nextStartDay;

		if (!batchStartDay) {
			return;
		}

		if (reset) {
			isLoadingInitial = true;
			loadError = '';
		} else {
			isLoadingMore = true;
		}

		try {
			const heatmap = await loadStatsHeatmap({
				startDay: batchStartDay,
				count: DAYS_PER_BATCH,
				tzOffsetMinutes: timezoneOffsetMinutes
			});
			const nextDays = (heatmap.days ?? []).map(normalizeDay);
			const oldestLoadedDay = nextDays[nextDays.length - 1]?.day ?? batchStartDay;

			days = reset ? nextDays : [...days, ...nextDays];
			nextStartDay = shiftDay(oldestLoadedDay, -1);
		} catch (error) {
			loadError = error.message;
		} finally {
			isLoadingInitial = false;
			isLoadingMore = false;
		}
	}

	async function reloadHeatmap() {
		days = [];
		nextStartDay = getTodayDay();
		await loadNextBatch({ reset: true });
	}

	const hasDays = $derived(days.length > 0);

	$effect(() => {
		if (!sentinel || typeof IntersectionObserver === 'undefined') {
			return;
		}

		const sentinelObserver = new IntersectionObserver(
			(entries) => {
				const [entry] = entries;

				if (entry?.isIntersecting) {
					void loadNextBatch();
				}
			},
			{
				rootMargin: '900px 0px'
			}
		);

		sentinelObserver.observe(sentinel);

		return () => {
			sentinelObserver.disconnect();
		};
	});

	onMount(() => {
		timezoneOffsetMinutes = new Date().getTimezoneOffset();
		nextStartDay = getTodayDay();
		void loadNextBatch({ reset: true });

		if (typeof window === 'undefined') {
			return;
		}

		const handlePanicUpdated = () => {
			void reloadHeatmap();
		};
		const handleAssistantRefresh = (event) => {
			if (
				event.detail?.refresh?.tasks !== true &&
				event.detail?.refresh?.stats !== true &&
				event.detail?.refresh?.panic !== true
			) {
				return;
			}

			void reloadHeatmap();
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
		content="Minute-by-minute task heatmap built from real task run history."
	/>
</svelte:head>

<section class="stats-page app-page">
	<div class="section-divider section-divider--primary">
		<span></span>
		<h1>Stats</h1>
		<span></span>
	</div>

	<header class="stats-header">
		<div class="legend" aria-label="Task color legend">
			{#each taskColorLegend as item}
				<span class="legend-chip" style={`--legend-color: ${item.color};`}>
					<i aria-hidden="true"></i>
					{item.label}
				</span>
			{/each}
		</div>
	</header>

	{#if loadError}
		<div class="message-card error-card">
			<strong>Could not load minute map</strong>
			<p>{loadError}</p>
		</div>
	{/if}

	{#if isLoadingInitial}
		<div class="page-loader" aria-label="Loading minute maps">
			<span class="page-spinner" aria-hidden="true"></span>
		</div>
	{:else if !hasDays}
		<div class="message-card">
			<strong>No day data</strong>
			<p>No heatmap days came back from the server.</p>
		</div>
	{:else}
		<div class="heatmap-stack">
			{#each days as day}
				<article class="day-card">
					<header class="day-card__header">
						<div>
							<h2>{formatDayLabel(day.day)}</h2>
							<p>{day.day}</p>
						</div>
						<strong>{getDaySummary(day)}</strong>
					</header>

					<div
						class="minute-grid"
						role="img"
						aria-label={`${formatDayLabel(day.day)} minute activity map. ${getDaySummary(day)}.`}
					>
						{#each day.minutes as minute}
							<span
								class:minute-active={minute.active}
								class="minute-cell"
								style={minute.fill
									? `--minute-fill: ${minute.fill}; --minute-glow: ${minute.glow};`
									: ''}
								title={minute.label}
								aria-hidden="true"
							></span>
						{/each}
					</div>
				</article>
			{/each}
		</div>

		<div class="load-sentinel" bind:this={sentinel}>
			{#if isLoadingMore}
				<span class="page-spinner page-spinner--small" aria-label="Loading older days"></span>
			{:else}
				<span>Scroll for older days</span>
			{/if}
		</div>
	{/if}
</section>

<style>
	.stats-page {
		display: grid;
		gap: 1rem;
	}

	.stats-header,
	.message-card,
	.day-card {
		background: var(--surface-1);
		border: 1px solid var(--surface-border);
		box-shadow: var(--surface-shadow);
	}

	.stats-header {
		height: 30px;
		max-height: 30px;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0 0.55rem;
		overflow-x: auto;
		overflow-y: hidden;
		border-radius: 999px;
		background:
			linear-gradient(
				180deg,
				color-mix(in srgb, var(--surface-3) 92%, transparent),
				color-mix(in srgb, var(--surface-2) 88%, transparent)
			),
			radial-gradient(
				circle at top right,
				color-mix(in srgb, var(--color-accent) 14%, transparent),
				transparent 56%
			);
		box-shadow: var(--surface-shadow-strong), var(--surface-inset);
		scrollbar-width: none;
	}

	.stats-header::-webkit-scrollbar {
		display: none;
	}

	h2,
	p,
	strong {
		margin: 0;
	}

	h2 {
		font-size: clamp(1rem, 2vw, 1.28rem);
		letter-spacing: -0.03em;
		color: var(--color-heading);
	}

	.message-card p,
	.day-card__header p,
	.load-sentinel {
		color: var(--color-muted);
	}

	.legend {
		flex: 0 0 auto;
		display: flex;
		flex-wrap: nowrap;
		gap: 0.28rem;
		min-width: max-content;
	}

	.legend-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		height: 20px;
		min-height: 20px;
		padding: 0 0.4rem;
		border: 1px solid var(--surface-border);
		border-radius: 999px;
		background: var(--surface-2);
		box-shadow: var(--surface-inset);
		font-size: 0.6rem;
		font-weight: 800;
		line-height: 1;
		color: var(--color-muted);
	}

	.legend-chip i {
		width: 0.45rem;
		height: 0.45rem;
		border-radius: 999px;
		background: var(--legend-color);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--legend-color) 16%, transparent);
	}

	.message-card {
		display: grid;
		gap: 0.4rem;
		padding: 1rem 1.1rem;
		border-radius: 18px;
	}

	.message-card strong {
		color: var(--color-heading);
	}

	.error-card {
		border-color: color-mix(in srgb, var(--color-danger) 22%, var(--surface-border));
		background: color-mix(in srgb, var(--color-danger) 8%, var(--surface-1));
	}

	.heatmap-stack {
		display: grid;
		gap: 5px;
	}

	.day-card {
		display: grid;
		gap: 0.65rem;
		padding: 0.75rem;
		border-radius: 16px;
	}

	.day-card__header {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 0.8rem;
	}

	.day-card__header strong {
		text-align: right;
		font-size: 0.82rem;
		color: var(--color-muted);
	}

	.minute-grid {
		display: grid;
		grid-template-columns: repeat(60, minmax(0, 1fr));
		gap: 1px;
		padding: 0.35rem;
		border: 1px solid var(--surface-border);
		border-radius: 10px;
		background: color-mix(in srgb, var(--surface-2) 82%, transparent);
		box-shadow: var(--surface-inset);
	}

	.minute-cell {
		aspect-ratio: 1;
		min-width: 0;
		border-radius: 1.5px;
		background: color-mix(in srgb, var(--color-muted) 14%, transparent);
	}

	.minute-cell:nth-child(60n + 1) {
		box-shadow: inset 1px 0 0 color-mix(in srgb, var(--color-muted) 16%, transparent);
	}

	.minute-active {
		background: var(--minute-fill);
		box-shadow: 0 0 5px color-mix(in srgb, var(--minute-glow) 42%, transparent);
	}

	.load-sentinel {
		min-height: 4rem;
		display: grid;
		place-items: center;
		font-size: 0.8rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	@media (max-width: 640px) {
		.stats-page {
			gap: 0.75rem;
		}

		.stats-header {
			padding: 0 0.45rem;
		}

		.legend {
			gap: 0.24rem;
		}

		.legend-chip {
			height: 19px;
			min-height: 19px;
			padding: 0 0.35rem;
			font-size: 0.58rem;
		}

		.day-card {
			gap: 0.45rem;
			padding: 0.48rem;
			border-radius: 12px;
		}

		.day-card__header {
			align-items: start;
		}

		.day-card__header strong {
			font-size: 0.72rem;
		}

		.minute-grid {
			gap: 1px;
			padding: 0.22rem;
			border-radius: 8px;
		}

		.minute-cell {
			border-radius: 1px;
		}
	}
</style>
