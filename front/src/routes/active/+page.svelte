<script>
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount, tick } from 'svelte';

	import { ASSISTANT_REFRESH_EVENT } from '$lib/assistant-client';
	import PageContentReveal from '$lib/PageContentReveal.svelte';
	import TaskCard from '$lib/TaskCard.svelte';
	import { loadPanicStatus, PANIC_UPDATED_EVENT } from '$lib/panic-client';
	import TaskSortBar from '$lib/TaskSortBar.svelte';
	import { formatElapsedDuration } from '$lib/task-format';
	import {
		DEFAULT_TASK_SORT_MODE,
		filterTasks,
		loadStoredTaskSort,
		sortTasks,
		storeTaskSort
	} from '$lib/task-sort';
	import {
		cancelActiveTask,
		doneTask,
		loadActiveTasks,
		loadDaymapTasks,
		loadInactiveTasks,
		updateTaskIntensity,
		updateTaskInstanceNote,
		updateTaskNextDue,
		updateTaskTally,
		updateTaskNote
	} from '$lib/tasks-client';

	let tasks = $state([]);
	let isLoading = $state(true);
	let loadError = $state('');
	let actionError = $state('');
	let busyTasks = $state({});
	let nowMs = $state(Date.now());
	let sortMode = $state(DEFAULT_TASK_SORT_MODE);
	let searchQuery = $state('');
	let panic = $state(null);
	let hasAnyBoardTasks = $state(true);
	let showDoneModal = $state(false);
	let doneModalTaskId = $state(null);
	let doneModalStartedAtValue = $state('');
	let doneModalCompletedAtValue = $state('');
	let doneModalInstanceNote = $state('');
	let doneModalSetNextDue = $state(false);
	let doneModalNextDueAtValue = $state('');
	let doneModalNextDueDirty = $state(false);
	let doneModalNoteInput = $state(null);

	let clockIntervalId = null;
	const ONE_DAY_MS = 24 * 60 * 60 * 1000;

	function padDateTimePart(value) {
		return String(value).padStart(2, '0');
	}

	function formatDateTimeLocalValue(date) {
		return (
			[
				date.getFullYear(),
				padDateTimePart(date.getMonth() + 1),
				padDateTimePart(date.getDate())
			].join('-') +
			'T' +
			[padDateTimePart(date.getHours()), padDateTimePart(date.getMinutes())].join(':')
		);
	}

	function parseDateTimeLocalValue(value) {
		if (typeof value !== 'string' || !value.trim()) {
			return null;
		}

		const parsed = new Date(value);

		return Number.isNaN(parsed.getTime()) ? null : parsed;
	}

	function getDefaultDoneModalNextDueValue(completedAtValue) {
		const completedAt = parseDateTimeLocalValue(completedAtValue);

		if (!completedAt) {
			return '';
		}

		return formatDateTimeLocalValue(new Date(completedAt.getTime() + ONE_DAY_MS));
	}

	async function loadActiveBoardState() {
		const [nextActiveTasks, nextDaymapTasks, nextInactiveTasks] = await Promise.all([
			loadActiveTasks(),
			loadDaymapTasks(),
			loadInactiveTasks()
		]);

		tasks = nextActiveTasks;
		hasAnyBoardTasks =
			nextActiveTasks.length + nextDaymapTasks.length + nextInactiveTasks.length > 0;
	}

	async function loadTasks() {
		isLoading = true;
		loadError = '';

		try {
			await loadActiveBoardState();
		} catch (error) {
			loadError = error.message;
		} finally {
			isLoading = false;
		}
	}

	async function loadPanic() {
		try {
			panic = await loadPanicStatus();
		} catch (error) {
			console.error(error);
		}
	}

	function getBusyAction(taskId) {
		return busyTasks[taskId] || null;
	}

	function getTaskById(taskId) {
		return tasks.find((task) => task.id === taskId) ?? null;
	}

	function mergeTaskUpdate(
		taskId,
		updatedTask,
		{ preservePanic = false, preserveInstanceNote = false } = {}
	) {
		tasks = tasks.map((task) =>
			task.id === taskId
				? {
						...task,
						...updatedTask,
						...(preservePanic
							? {
									panicMilliseconds: task.panicMilliseconds,
									panicMeasuredAt: task.panicMeasuredAt,
									effectiveMilliseconds: task.effectiveMilliseconds,
									taskPanicLog: task.taskPanicLog ?? []
								}
							: {}),
						...(preserveInstanceNote
							? {
									instanceNote: task.instanceNote ?? null
								}
							: {})
					}
				: task
		);
	}

	function setBusy(taskId, action) {
		busyTasks = {
			...busyTasks,
			[taskId]: action
		};
	}

	function clearBusy(taskId) {
		const nextBusyTasks = { ...busyTasks };
		delete nextBusyTasks[taskId];
		busyTasks = nextBusyTasks;
	}

	function getActiveDurationLabel(task) {
		if (!task.activatedAt) {
			return 'Just started';
		}

		return formatElapsedDuration(nowMs - new Date(task.activatedAt).getTime());
	}

	function getLivePanicMilliseconds(task) {
		const baseMilliseconds = Number.isInteger(task.panicMilliseconds) ? task.panicMilliseconds : 0;

		if (!panic?.active || !task.panicMeasuredAt) {
			return baseMilliseconds;
		}

		const measuredAtMs = new Date(task.panicMeasuredAt).getTime();
		return baseMilliseconds + Math.max(0, nowMs - measuredAtMs);
	}

	function getPanicDurationLabel(task) {
		return `Panic ${formatElapsedDuration(getLivePanicMilliseconds(task))}`;
	}

	function getEffectiveDurationLabel(task) {
		if (!task.activatedAt) {
			return 'Effective 0s';
		}

		const activeMilliseconds = Math.max(0, nowMs - new Date(task.activatedAt).getTime());
		const effectiveMilliseconds = Math.max(0, activeMilliseconds - getLivePanicMilliseconds(task));

		return `Effective ${formatElapsedDuration(effectiveMilliseconds)}`;
	}

	function getDoneModalStartedAtMs(task) {
		const startedAt = parseDateTimeLocalValue(doneModalStartedAtValue);

		if (startedAt) {
			return startedAt.getTime();
		}

		return task?.activatedAt ? new Date(task.activatedAt).getTime() : 0;
	}

	function getDoneModalCompletedAtMs(task) {
		const completedAt = parseDateTimeLocalValue(doneModalCompletedAtValue);

		if (completedAt) {
			return completedAt.getTime();
		}

		return task ? Date.now() : 0;
	}

	function getDoneModalTrackedMilliseconds(task) {
		if (!task) {
			return 0;
		}

		return Math.max(0, getDoneModalCompletedAtMs(task) - getDoneModalStartedAtMs(task));
	}

	function getDoneModalNextDueDate() {
		if (!doneModalSetNextDue) {
			return null;
		}

		return parseDateTimeLocalValue(doneModalNextDueAtValue);
	}

	function handleDoneModalCompletedAtInput() {
		if (!doneModalNextDueDirty) {
			doneModalNextDueAtValue = getDefaultDoneModalNextDueValue(doneModalCompletedAtValue);
		}
	}

	function handleDoneModalNextDueInput() {
		doneModalNextDueDirty = true;
	}

	function handleDoneModalNextDueToggle() {
		doneModalSetNextDue = !doneModalSetNextDue;

		if (doneModalSetNextDue && !doneModalNextDueAtValue) {
			doneModalNextDueAtValue = getDefaultDoneModalNextDueValue(doneModalCompletedAtValue);
			doneModalNextDueDirty = false;
		}
	}

	async function openDoneModal(taskId, { instanceNote = '' } = {}) {
		const task = getTaskById(taskId);

		if (!task || getBusyAction(taskId) !== null) {
			return;
		}

		actionError = '';
		doneModalTaskId = taskId;
		doneModalStartedAtValue = formatDateTimeLocalValue(
			task.activatedAt ? new Date(task.activatedAt) : new Date()
		);
		doneModalCompletedAtValue = formatDateTimeLocalValue(new Date());
		doneModalInstanceNote = instanceNote ?? task.instanceNote ?? '';
		doneModalSetNextDue = false;
		doneModalNextDueAtValue =
			task.mode === 'repeatable' ? getDefaultDoneModalNextDueValue(doneModalCompletedAtValue) : '';
		doneModalNextDueDirty = false;
		showDoneModal = true;
		await tick();
		doneModalNoteInput?.focus();
	}

	function closeDoneModal() {
		if (doneModalTaskId && getBusyAction(doneModalTaskId) === 'done') {
			return;
		}

		showDoneModal = false;
		doneModalTaskId = null;
		doneModalStartedAtValue = '';
		doneModalCompletedAtValue = '';
		doneModalInstanceNote = '';
		doneModalSetNextDue = false;
		doneModalNextDueAtValue = '';
		doneModalNextDueDirty = false;
	}

	async function handleTally(taskId, delta) {
		actionError = '';
		setBusy(taskId, delta > 0 ? 'tally-up' : 'tally-down');

		try {
			const updatedTask = await updateTaskTally(taskId, delta);
			mergeTaskUpdate(taskId, updatedTask, {
				preservePanic: true,
				preserveInstanceNote: true
			});
		} catch (error) {
			actionError = error.message;
		} finally {
			clearBusy(taskId);
		}
	}

	async function handleCancelActive(taskId) {
		actionError = '';
		setBusy(taskId, 'cancel');

		try {
			await cancelActiveTask(taskId);
			const nextTasks = await loadActiveTasks();

			if (nextTasks.length > 0) {
				tasks = nextTasks;
				return;
			}

			await goto(resolve('/tasks'));
		} catch (error) {
			actionError = error.message;
		} finally {
			clearBusy(taskId);
		}
	}

	async function handleDone(taskId, { instanceNote = '' } = {}) {
		await openDoneModal(taskId, {
			instanceNote
		});
	}

	async function handleDoneConfirm(event) {
		event.preventDefault();
		const task = getTaskById(doneModalTaskId);

		if (!task) {
			closeDoneModal();
			return;
		}

		actionError = '';
		const startedAt = parseDateTimeLocalValue(doneModalStartedAtValue);
		const completedAt = parseDateTimeLocalValue(doneModalCompletedAtValue);

		if (!startedAt || !completedAt) {
			actionError = 'Enter a valid local start time and finish time.';
			return;
		}

		if (completedAt.getTime() < startedAt.getTime()) {
			actionError = 'Finish time cannot be earlier than start time.';
			return;
		}

		let nextDueAt;

		if (task.mode === 'repeatable' && doneModalSetNextDue) {
			nextDueAt = getDoneModalNextDueDate();

			if (!nextDueAt) {
				actionError = 'Enter a valid next due time.';
				return;
			}
		}

		setBusy(task.id, 'done');

		try {
			await doneTask(task.id, {
				instanceNote: doneModalInstanceNote,
				startedAt: startedAt.toISOString(),
				completedAt: completedAt.toISOString(),
				nextDueAt: nextDueAt?.toISOString()
			});
			closeDoneModal();
			const nextTasks = await loadActiveTasks();

			if (nextTasks.length > 0) {
				tasks = nextTasks;
				return;
			}

			await goto(resolve('/done'));
		} catch (error) {
			actionError = error.message;
		} finally {
			clearBusy(task.id);
		}
	}

	async function handleSaveNote(taskId, note) {
		const updatedTask = await updateTaskNote(taskId, note);
		mergeTaskUpdate(taskId, updatedTask, {
			preservePanic: true,
			preserveInstanceNote: true
		});
		return updatedTask;
	}

	async function handleSaveNextDue(taskId, nextDueAt) {
		const updatedTask = await updateTaskNextDue(taskId, nextDueAt);
		mergeTaskUpdate(taskId, updatedTask, {
			preservePanic: true,
			preserveInstanceNote: true
		});
		return updatedTask;
	}

	async function handleSaveInstanceNote(taskId, instanceNote) {
		const updatedTask = await updateTaskInstanceNote(taskId, instanceNote);
		mergeTaskUpdate(taskId, updatedTask, {
			preservePanic: true
		});
		return updatedTask;
	}

	async function handleIntensityChange(taskId, intensity) {
		const updatedTask = await updateTaskIntensity(taskId, intensity);
		mergeTaskUpdate(taskId, updatedTask, {
			preservePanic: true,
			preserveInstanceNote: true
		});
		return updatedTask;
	}

	onMount(() => {
		sortMode = loadStoredTaskSort('active');
		void loadTasks();
		void loadPanic();

		if (browser) {
			clockIntervalId = window.setInterval(() => {
				nowMs = Date.now();
			}, 1000);
			const handleAssistantRefresh = async (event) => {
				if (event.detail?.refresh?.tasks !== true && event.detail?.refresh?.panic !== true) {
					return;
				}

				try {
					panic = await loadPanicStatus();
					await loadActiveBoardState();
				} catch (error) {
					loadError = error.message;
				}
			};
			const handlePanicUpdated = async (event) => {
				try {
					panic = event.detail ?? null;
					await loadActiveBoardState();
				} catch (error) {
					loadError = error.message;
				}
			};

			window.addEventListener(ASSISTANT_REFRESH_EVENT, handleAssistantRefresh);
			window.addEventListener(PANIC_UPDATED_EVENT, handlePanicUpdated);

			return () => {
				window.removeEventListener(ASSISTANT_REFRESH_EVENT, handleAssistantRefresh);
				window.removeEventListener(PANIC_UPDATED_EVENT, handlePanicUpdated);
				window.clearInterval(clockIntervalId);
			};
		}
	});

	const sortedTasks = $derived(
		sortTasks(filterTasks(tasks, searchQuery), { mode: sortMode, variant: 'active' })
	);
	const selectedDoneTask = $derived(getTaskById(doneModalTaskId));
</script>

<svelte:head>
	<title>Active Tasks</title>
	<meta name="description" content="Tasks currently active on the table." />
</svelte:head>

<section class="board app-page">
	{#if loadError}
		<div class="message-card error-card">
			<strong>Could not load active tasks</strong>
			<p>{loadError}</p>
		</div>
	{/if}

	{#if actionError}
		<div class="message-card error-card">
			<strong>Could not update that task</strong>
			<p>{actionError}</p>
		</div>
	{/if}

	{#if showDoneModal && selectedDoneTask}
		<div class="done-modal-backdrop">
			<form class="done-modal" onsubmit={handleDoneConfirm}>
				<div class="done-modal__header">
					<div>
						<p class="done-modal__eyebrow">Done</p>
						<h2>{selectedDoneTask.name}</h2>
					</div>
					<button
						class="done-modal__close"
						type="button"
						aria-label="Cancel done confirmation"
						disabled={getBusyAction(selectedDoneTask.id) === 'done'}
						onclick={closeDoneModal}
					>
						×
					</button>
				</div>

				<label class="done-modal__field">
					<span>Note</span>
					<textarea
						bind:this={doneModalNoteInput}
						bind:value={doneModalInstanceNote}
						rows="3"
						placeholder="Optional note"
					></textarea>
				</label>

				<div class="done-modal__field">
					<div class="done-modal__field-header">
						<span>Time</span>
						<strong
							>{formatElapsedDuration(getDoneModalTrackedMilliseconds(selectedDoneTask))}</strong
						>
					</div>

					<div class="done-modal__panel">
						<div class="done-modal__time-grid">
							<label class="done-modal__time-field">
								<span>Start</span>
								<input bind:value={doneModalStartedAtValue} type="datetime-local" />
							</label>
							<label class="done-modal__time-field">
								<span>Finish</span>
								<input
									bind:value={doneModalCompletedAtValue}
									type="datetime-local"
									oninput={handleDoneModalCompletedAtInput}
								/>
							</label>
						</div>
					</div>

					{#if selectedDoneTask.mode === 'repeatable'}
						<div class="done-modal__panel done-modal__next-due">
							<div class="done-modal__time-grid">
								<label class="done-modal__time-field">
									<span>Next due</span>
									<input
										bind:value={doneModalNextDueAtValue}
										class="done-modal__next-due-input"
										type="datetime-local"
										disabled={!doneModalSetNextDue}
										oninput={handleDoneModalNextDueInput}
									/>
								</label>
								<div class="done-modal__time-field done-modal__toggle-field">
									<span>Status</span>
									<button
										class:done-modal__toggle-active={doneModalSetNextDue}
										class="done-modal__toggle"
										type="button"
										onclick={handleDoneModalNextDueToggle}
									>
										{doneModalSetNextDue ? 'Set' : 'Unset'}
									</button>
								</div>
							</div>
						</div>
					{/if}
				</div>

				<div class="done-modal__actions">
					<button
						class="done-modal__button done-modal__button-secondary"
						type="button"
						disabled={getBusyAction(selectedDoneTask.id) === 'done'}
						onclick={closeDoneModal}
					>
						Cancel
					</button>
					<button
						class="done-modal__button done-modal__button-primary"
						type="submit"
						disabled={getBusyAction(selectedDoneTask.id) === 'done'}
					>
						{getBusyAction(selectedDoneTask.id) === 'done' ? 'Saving...' : 'Done'}
					</button>
				</div>
			</form>
		</div>
	{/if}

	{#if isLoading}
		<div class="page-loader" aria-label="Loading active tasks">
			<span class="page-spinner" aria-hidden="true"></span>
		</div>
	{:else if tasks.length === 0}
		<PageContentReveal>
			<p class="machine-inscription">
				<span>
					{#if hasAnyBoardTasks}
						No active tasks on deck. <a href={resolve('/tasks')}>Choose one from tasks</a>.
					{:else}
						No tasks installed. <a href={resolve('/add')}>Add the first task</a>.
					{/if}
				</span>
			</p>
		</PageContentReveal>
	{:else}
		<PageContentReveal className="page-content-stack">
			<TaskSortBar
				value={sortMode}
				onChange={(nextSortMode) => {
					sortMode = nextSortMode;
					storeTaskSort('active', nextSortMode);
				}}
				searchValue={searchQuery}
				onSearchChange={(nextSearchQuery) => {
					searchQuery = nextSearchQuery;
				}}
			/>

			<div class="section-divider section-divider--primary">
				<span></span>
				<h1>Active</h1>
				<span></span>
			</div>

			{#if sortedTasks.length === 0}
				<div class="message-card">
					<strong>No matching tasks</strong>
					<p>Clear search to show all active tasks.</p>
				</div>
			{:else}
				<div class="task-grid">
					{#each sortedTasks as task}
						<TaskCard
							{task}
							variant="active"
							editableTaskId={task.id}
							activeDurationLabel={getActiveDurationLabel(task)}
							panicDurationLabel={getPanicDurationLabel(task)}
							effectiveDurationLabel={getEffectiveDurationLabel(task)}
							onSaveInstanceNote={handleSaveInstanceNote}
							showIntensityControl={true}
							busyAction={getBusyAction(task.id)}
							onDone={handleDone}
							onInactivate={handleCancelActive}
							onIntensityChange={handleIntensityChange}
							onSaveNote={handleSaveNote}
							onSaveNextDue={handleSaveNextDue}
							onTally={handleTally}
						/>
					{/each}
				</div>
			{/if}
		</PageContentReveal>
	{/if}
</section>

<style>
	.board {
		display: grid;
		gap: 1rem;
	}

	.message-card p {
		margin: 0;
		font-size: 1.05rem;
		color: var(--color-muted);
	}

	.message-card {
		display: grid;
		gap: 0.4rem;
		padding: 1rem 1.1rem;
		border-radius: 18px;
		background: var(--surface-1);
		border: 1px solid var(--surface-border);
		box-shadow: var(--surface-shadow);
	}

	.message-card strong {
		font-size: 1.15rem;
		letter-spacing: -0.02em;
		color: var(--color-heading);
	}

	.error-card {
		border-color: color-mix(in srgb, var(--color-danger) 22%, var(--surface-border));
		background: color-mix(in srgb, var(--color-danger) 8%, var(--surface-1));
	}

	.task-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
	}

	@media (max-width: 840px) {
		.task-grid {
			grid-template-columns: 1fr;
		}
	}

	.done-modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 120;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		overflow-y: auto;
		background: color-mix(in srgb, var(--app-bg-color) 58%, transparent);
		backdrop-filter: blur(6px);
	}

	.done-modal {
		display: grid;
		gap: 0.85rem;
		width: min(100%, 34rem);
		max-height: calc(100vh - 2rem - env(safe-area-inset-top) - env(safe-area-inset-bottom));
		padding: 1.25rem;
		overflow-y: auto;
		overscroll-behavior: contain;
		border-radius: 26px;
		background:
			linear-gradient(
				180deg,
				color-mix(in srgb, var(--surface-3) 94%, transparent),
				color-mix(in srgb, var(--surface-2) 92%, transparent)
			),
			radial-gradient(
				circle at top,
				color-mix(in srgb, var(--color-accent) 14%, transparent),
				transparent 62%
			);
		border: 1px solid var(--surface-border);
		box-shadow: var(--surface-shadow-strong), var(--surface-inset);
	}

	@supports (height: 100dvh) {
		.done-modal {
			max-height: calc(100dvh - 2rem - env(safe-area-inset-top) - env(safe-area-inset-bottom));
		}
	}

	.done-modal__header,
	.done-modal__field-header,
	.done-modal__actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.85rem;
	}

	.done-modal__eyebrow {
		margin: 0 0 0.25rem;
		font-size: 0.74rem;
		font-weight: 800;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--color-theme-2);
	}

	.done-modal h2 {
		margin: 0;
		font-size: 1.55rem;
		text-align: left;
		letter-spacing: -0.04em;
		color: var(--color-heading);
	}

	.done-modal__close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.35rem;
		height: 2.35rem;
		padding: 0;
		border: 1px solid var(--surface-border-strong);
		border-radius: 999px;
		background: var(--surface-2);
		color: var(--color-muted);
		font-size: 1.35rem;
		box-shadow: var(--surface-shadow);
	}

	.done-modal__field {
		display: grid;
		gap: 0.55rem;
	}

	.done-modal__field span {
		font-size: 0.74rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-soft);
	}

	.done-modal__field strong {
		font-size: 0.86rem;
		color: var(--color-muted);
	}

	.done-modal textarea {
		min-height: 5.75rem;
		padding: 0.75rem 0.9rem;
		border: 1px solid var(--field-border);
		border-radius: 18px;
		background: var(--field-bg);
		box-shadow: var(--surface-inset);
		font: inherit;
		line-height: 1.5;
		color: var(--color-text);
		resize: vertical;
	}

	.done-modal textarea:focus {
		outline: none;
		border-color: color-mix(in srgb, var(--color-accent) 42%, var(--field-border));
		box-shadow:
			0 0 0 3px var(--focus-ring),
			var(--surface-inset);
	}

	.done-modal__time-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.6rem;
	}

	.done-modal__time-field {
		display: grid;
		gap: 0.35rem;
	}

	.done-modal__toggle-field {
		align-content: end;
	}

	.done-modal__time-field input,
	.done-modal__next-due-input {
		min-height: 2.75rem;
		padding: 0.68rem 0.85rem;
		border: 1px solid var(--field-border);
		border-radius: 16px;
		background: var(--field-bg);
		box-shadow: var(--surface-inset);
		font: inherit;
		color: var(--color-text);
	}

	.done-modal__time-field input:focus,
	.done-modal__next-due-input:focus {
		outline: none;
		border-color: color-mix(in srgb, var(--color-accent) 42%, var(--field-border));
		box-shadow:
			0 0 0 3px var(--focus-ring),
			var(--surface-inset);
	}

	.done-modal__panel {
		display: grid;
		gap: 0.6rem;
		padding: 0.75rem 0.85rem;
		border-radius: 18px;
		background: var(--surface-2);
		border: 1px solid var(--surface-border);
	}

	.done-modal__toggle,
	.done-modal__button,
	.done-modal__close {
		cursor: pointer;
		transition:
			transform 0.15s ease,
			box-shadow 0.15s ease,
			opacity 0.15s ease;
	}

	.done-modal__toggle {
		width: 100%;
		min-height: 2.75rem;
		padding: 0.65rem 0.8rem;
		border: 1px solid var(--surface-border-strong);
		border-radius: 14px;
		background: var(--surface-2);
		font-weight: 700;
		color: var(--color-muted);
		box-shadow: var(--surface-shadow);
	}

	.done-modal__toggle-active {
		background: color-mix(in srgb, var(--color-success) 16%, var(--surface-2));
		border-color: color-mix(in srgb, var(--color-success) 34%, var(--surface-border));
		color: var(--color-success);
	}

	.done-modal__button {
		min-height: 2.75rem;
		padding: 0.68rem 1rem;
		border: 0;
		border-radius: 999px;
		font-weight: 800;
		letter-spacing: 0.04em;
	}

	.done-modal__button-secondary {
		background: var(--surface-2);
		color: var(--color-muted);
		box-shadow: inset 0 0 0 1px var(--surface-border-strong);
	}

	.done-modal__button-primary {
		background: linear-gradient(
			135deg,
			var(--color-success),
			color-mix(in srgb, var(--color-success) 70%, var(--color-accent))
		);
		color: var(--color-accent-contrast);
		box-shadow: 0 14px 28px color-mix(in srgb, var(--color-success) 24%, transparent);
	}

	.done-modal__toggle:hover,
	.done-modal__button:hover,
	.done-modal__close:hover {
		transform: translateY(-1px);
		box-shadow: var(--surface-shadow-strong);
	}

	.done-modal__toggle:disabled,
	.done-modal__button:disabled,
	.done-modal__close:disabled {
		cursor: wait;
		opacity: 0.55;
		transform: none;
	}

	@media (max-width: 640px) {
		.done-modal-backdrop {
			align-items: flex-start;
			padding: calc(0.65rem + env(safe-area-inset-top)) 0.55rem
				calc(0.65rem + env(safe-area-inset-bottom));
		}

		.done-modal {
			gap: 0.65rem;
			width: min(100%, 28rem);
			max-height: calc(100vh - 1.3rem - env(safe-area-inset-top) - env(safe-area-inset-bottom));
			padding: 0.75rem;
			border-radius: 20px;
		}

		@supports (height: 100dvh) {
			.done-modal {
				max-height: calc(100dvh - 1.3rem - env(safe-area-inset-top) - env(safe-area-inset-bottom));
			}
		}

		.done-modal__header {
			gap: 0.55rem;
		}

		.done-modal__eyebrow {
			margin-bottom: 0.08rem;
			font-size: 0.64rem;
			letter-spacing: 0.12em;
		}

		.done-modal h2 {
			font-size: 1.22rem;
			line-height: 1.05;
		}

		.done-modal__close {
			width: 2rem;
			height: 2rem;
			font-size: 1.1rem;
		}

		.done-modal__field {
			gap: 0.42rem;
		}

		.done-modal__actions {
			position: sticky;
			bottom: -0.75rem;
			z-index: 1;
			margin: 0 -0.75rem -0.75rem;
			padding: 0.55rem 0.75rem 0.75rem;
			background: linear-gradient(
				180deg,
				color-mix(in srgb, var(--surface-2) 16%, transparent),
				color-mix(in srgb, var(--surface-2) 96%, transparent) 28%
			);
			border-top: 1px solid var(--surface-border);
			backdrop-filter: blur(16px);
		}

		.done-modal__field-header,
		.done-modal__actions {
			flex-direction: row;
			align-items: center;
		}

		.done-modal textarea {
			min-height: 4.4rem;
			padding: 0.65rem 0.75rem;
			border-radius: 14px;
			line-height: 1.35;
		}

		.done-modal__time-grid {
			grid-template-columns: 1fr;
			gap: 0.42rem;
		}

		.done-modal__panel {
			padding: 0.58rem 0.65rem;
			border-radius: 16px;
		}

		.done-modal__time-field input,
		.done-modal__next-due-input {
			min-height: 2.5rem;
			padding: 0.5rem 0.65rem;
			border-radius: 13px;
			font-size: 0.92rem;
		}

		.done-modal__toggle {
			min-height: 2.5rem;
			padding: 0.5rem 0.65rem;
		}

		.done-modal__button {
			min-height: 2.5rem;
			padding: 0.55rem 0.75rem;
			font-size: 0.95rem;
		}

		.done-modal__button-secondary {
			flex: 0 0 auto;
		}

		.done-modal__button-primary {
			flex: 1 1 auto;
		}
	}
</style>
