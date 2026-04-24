<script>
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { onMount, tick } from 'svelte';

	import TaskCard from '$lib/TaskCard.svelte';
	import { loadPanicStatus, PANIC_UPDATED_EVENT } from '$lib/panic-client';
	import TaskSortBar from '$lib/TaskSortBar.svelte';
	import { formatElapsedDuration } from '$lib/task-format';
	import { DEFAULT_TASK_SORT_MODE, loadStoredTaskSort, sortTasks, storeTaskSort } from '$lib/task-sort';
	import {
		doneTask,
		inactivateTask,
		loadActiveTasks,
		snoozeTask,
		updateTaskInstanceNote,
		updateTaskTally,
		updateTaskNote
	} from '$lib/tasks-client';

	let tasks = $state([]);
	let isLoading = $state(true);
	let loadError = $state('');
	let actionError = $state('');
	let busyTasks = $state({});
	let nowMs = $state(Date.now());
	let audioReady = $state(false);
	let audioSupported = $state(true);
	let sortMode = $state(DEFAULT_TASK_SORT_MODE);
	let panic = $state(null);
	let showDoneModal = $state(false);
	let doneModalTaskId = $state(null);
	let doneModalBaseCompletedAtMs = $state(0);
	let doneModalAdjustmentMs = $state(0);
	let doneModalInstanceNote = $state('');
	let doneModalNoteInput = $state(null);

	let clockIntervalId = null;
	let alarmLoopId = null;
	let audioContext = null;

	const DONE_ADJUST_MINUTE_MS = 60 * 1000;
	const DONE_ADJUST_HOUR_MS = 60 * 60 * 1000;
	const doneModalDateFormatter = new Intl.DateTimeFormat(undefined, {
		month: 'long',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
	});

	async function loadTasks() {
		isLoading = true;
		loadError = '';

		try {
			tasks = await loadActiveTasks();
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

	function mergeTaskUpdate(taskId, updatedTask, { preservePanic = false, preserveInstanceNote = false } = {}) {
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

	function isTaskRinging(task) {
		if (!task.activeToday || !task.alarmEnabled || !task.alarmDueAt) {
			return false;
		}

		return new Date(task.alarmDueAt).getTime() <= nowMs;
	}

	function getActiveDurationLabel(task) {
		if (!task.activatedAt) {
			return 'Just started';
		}

		return formatElapsedDuration(nowMs - new Date(task.activatedAt).getTime());
	}

	function getAlarmLabel(task) {
		if (!task.alarmEnabled || !task.alarmDueAt) {
			return 'Off';
		}

		const delta = new Date(task.alarmDueAt).getTime() - nowMs;

		if (delta >= 0) {
			return `Rings in ${formatElapsedDuration(delta)}`;
		}

		return `Overdue by ${formatElapsedDuration(Math.abs(delta))}`;
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

	function getDoneModalMinAdjustmentMs(task) {
		if (!task?.activatedAt || !doneModalBaseCompletedAtMs) {
			return 0;
		}

		return Math.min(0, new Date(task.activatedAt).getTime() - doneModalBaseCompletedAtMs);
	}

	function getClampedDoneModalAdjustmentMs(task, adjustmentMs) {
		return Math.max(getDoneModalMinAdjustmentMs(task), adjustmentMs);
	}

	function getDoneModalStartedAtMs(task) {
		if (!task?.activatedAt) {
			return 0;
		}

		return new Date(task.activatedAt).getTime() - Math.max(0, doneModalAdjustmentMs);
	}

	function getDoneModalCompletedAtMs(task) {
		if (!task || !doneModalBaseCompletedAtMs) {
			return 0;
		}

		return doneModalBaseCompletedAtMs + Math.min(0, getClampedDoneModalAdjustmentMs(task, doneModalAdjustmentMs));
	}

	function getDoneModalTrackedMilliseconds(task) {
		if (!task) {
			return 0;
		}

		return Math.max(0, getDoneModalCompletedAtMs(task) - getDoneModalStartedAtMs(task));
	}

	function canAdjustDoneModal(task, deltaMs) {
		if (!task) {
			return false;
		}

		if (deltaMs > 0) {
			return true;
		}

		return getClampedDoneModalAdjustmentMs(task, doneModalAdjustmentMs + deltaMs) !== doneModalAdjustmentMs;
	}

	function formatDoneModalStartedAt(task) {
		return doneModalDateFormatter.format(new Date(getDoneModalStartedAtMs(task)));
	}

	function formatDoneModalCompletedAt(task) {
		return doneModalDateFormatter.format(new Date(getDoneModalCompletedAtMs(task)));
	}

	function formatDoneModalAdjustment(task) {
		if (!task) {
			return 'No time removed';
		}

		const adjustedMilliseconds = getClampedDoneModalAdjustmentMs(task, doneModalAdjustmentMs);

		if (adjustedMilliseconds > 0) {
			return `Adding ${formatElapsedDuration(adjustedMilliseconds)}`;
		}

		if (adjustedMilliseconds < 0) {
			return `Removing ${formatElapsedDuration(Math.abs(adjustedMilliseconds))}`;
		}

		return 'No time change';
	}

	async function openDoneModal(taskId, { instanceNote = '' } = {}) {
		const task = getTaskById(taskId);

		if (!task || getBusyAction(taskId) !== null) {
			return;
		}

		actionError = '';
		doneModalTaskId = taskId;
		doneModalBaseCompletedAtMs = Date.now();
		doneModalAdjustmentMs = 0;
		doneModalInstanceNote = instanceNote ?? task.instanceNote ?? '';
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
		doneModalBaseCompletedAtMs = 0;
		doneModalAdjustmentMs = 0;
		doneModalInstanceNote = '';
	}

	function adjustDoneModalCompletion(deltaMs) {
		const task = getTaskById(doneModalTaskId);

		if (!task) {
			return;
		}

		doneModalAdjustmentMs = getClampedDoneModalAdjustmentMs(task, doneModalAdjustmentMs + deltaMs);
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

	async function handleInactivate(taskId) {
		actionError = '';
		setBusy(taskId, 'inactivate');

		try {
			await inactivateTask(taskId);
			const nextTasks = await loadActiveTasks();

			if (nextTasks.length > 0) {
				tasks = nextTasks;
				return;
			}

			await goto('/daymap');
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
		setBusy(task.id, 'done');

		try {
			await doneTask(task.id, {
				instanceNote: doneModalInstanceNote,
				startedAt: new Date(getDoneModalStartedAtMs(task)).toISOString(),
				completedAt: new Date(getDoneModalCompletedAtMs(task)).toISOString()
			});
			closeDoneModal();
			const nextTasks = await loadActiveTasks();

			if (nextTasks.length > 0) {
				tasks = nextTasks;
				return;
			}

			await goto('/done');
		} catch (error) {
			actionError = error.message;
		} finally {
			clearBusy(task.id);
		}
	}

	async function handleSnooze(taskId) {
		actionError = '';
		setBusy(taskId, 'snooze');

		try {
			const updatedTask = await snoozeTask(taskId);
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

	async function handleSaveNote(taskId, note) {
		const updatedTask = await updateTaskNote(taskId, note);
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

	async function unlockAudio() {
		if (!browser) {
			return;
		}

		const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;

		if (!AudioContextConstructor) {
			audioSupported = false;
			return;
		}

		if (!audioContext) {
			audioContext = new AudioContextConstructor();
		}

		try {
			if (audioContext.state === 'suspended') {
				await audioContext.resume();
			}
		} catch (error) {
			console.error(error);
		}

		audioReady = audioContext.state === 'running';
	}

	function playAlarmPulse() {
		if (!audioContext || audioContext.state !== 'running') {
			return;
		}

		const now = audioContext.currentTime;
		const oscillator = audioContext.createOscillator();
		const gain = audioContext.createGain();

		oscillator.type = 'square';
		oscillator.frequency.setValueAtTime(880, now);
		gain.gain.setValueAtTime(0.0001, now);
		gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
		gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

		oscillator.connect(gain);
		gain.connect(audioContext.destination);
		oscillator.start(now);
		oscillator.stop(now + 0.24);
	}

	function startAlarmLoop() {
		if (!browser || alarmLoopId !== null) {
			return;
		}

		playAlarmPulse();
		alarmLoopId = window.setInterval(() => {
			playAlarmPulse();
		}, 1200);
	}

	function stopAlarmLoop() {
		if (!browser || alarmLoopId === null) {
			return;
		}

		window.clearInterval(alarmLoopId);
		alarmLoopId = null;
	}

	onMount(() => {
		sortMode = loadStoredTaskSort('active');
		void loadTasks();
		void loadPanic();

		if (browser) {
			clockIntervalId = window.setInterval(() => {
				nowMs = Date.now();
			}, 1000);

			const resumeAudio = () => {
				void unlockAudio();
			};
			const handlePanicUpdated = async (event) => {
				try {
					panic = event.detail ?? null;
					tasks = await loadActiveTasks();
				} catch (error) {
					loadError = error.message;
				}
			};

			window.addEventListener('pointerdown', resumeAudio);
			window.addEventListener('keydown', resumeAudio);
			window.addEventListener(PANIC_UPDATED_EVENT, handlePanicUpdated);

			return () => {
				window.removeEventListener('pointerdown', resumeAudio);
				window.removeEventListener('keydown', resumeAudio);
				window.removeEventListener(PANIC_UPDATED_EVENT, handlePanicUpdated);
				window.clearInterval(clockIntervalId);
				stopAlarmLoop();

				if (audioContext) {
					void audioContext.close();
				}
			};
		}
	});

	const ringingCount = $derived(tasks.filter((task) => isTaskRinging(task)).length);
	const sortedTasks = $derived(sortTasks(tasks, { mode: sortMode, variant: 'active' }));
	const selectedDoneTask = $derived(getTaskById(doneModalTaskId));

	$effect(() => {
		if (!browser) {
			return;
		}

		if (ringingCount > 0) {
			void unlockAudio();
			startAlarmLoop();
			return;
		}

		stopAlarmLoop();
	});
</script>

<svelte:head>
	<title>Active Tasks</title>
	<meta name="description" content="Tasks currently active on the table." />
</svelte:head>

<section class="board">
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

	{#if ringingCount > 0 && audioSupported && !audioReady}
		<div class="message-card warning-card">
			<strong>Alarm audio needs a tap</strong>
			<p>The browser is holding audio until you interact. Tap anywhere and the ringing will start.</p>
		</div>
	{/if}

	{#if showDoneModal && selectedDoneTask}
		<div class="done-modal-backdrop">
			<form class="done-modal" onsubmit={handleDoneConfirm}>
				<div class="done-modal__header">
					<div>
						<p class="done-modal__eyebrow">Confirm Done</p>
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
					<span>Instance Notepad</span>
					<textarea
						bind:this={doneModalNoteInput}
						bind:value={doneModalInstanceNote}
						rows="5"
						placeholder="Anything worth capturing before you close this out?"
					></textarea>
				</label>

				<div class="done-modal__field">
					<div class="done-modal__field-header">
						<span>Adjust tracked time</span>
						<strong>{formatDoneModalAdjustment(selectedDoneTask)}</strong>
					</div>

					<p class="done-modal__adjust-note">
						Use `+` to move the start earlier. Use `-` to move the finish earlier.
					</p>

					<div class="done-modal__adjust-controls">
						<button
							class="done-modal__adjust-button"
							type="button"
							disabled={!canAdjustDoneModal(selectedDoneTask, -DONE_ADJUST_HOUR_MS)}
							onclick={() => adjustDoneModalCompletion(-DONE_ADJUST_HOUR_MS)}
						>
							-1h
						</button>
						<button
							class="done-modal__adjust-button"
							type="button"
							disabled={!canAdjustDoneModal(selectedDoneTask, -DONE_ADJUST_MINUTE_MS)}
							onclick={() => adjustDoneModalCompletion(-DONE_ADJUST_MINUTE_MS)}
						>
							-1m
						</button>
						<button
							class="done-modal__adjust-button"
							type="button"
							disabled={!canAdjustDoneModal(selectedDoneTask, DONE_ADJUST_MINUTE_MS)}
							onclick={() => adjustDoneModalCompletion(DONE_ADJUST_MINUTE_MS)}
						>
							+1m
						</button>
						<button
							class="done-modal__adjust-button"
							type="button"
							disabled={!canAdjustDoneModal(selectedDoneTask, DONE_ADJUST_HOUR_MS)}
							onclick={() => adjustDoneModalCompletion(DONE_ADJUST_HOUR_MS)}
						>
							+1h
						</button>
					</div>

					<div class="done-modal__summary">
						<div>
							<span>Start time</span>
							<strong>{formatDoneModalStartedAt(selectedDoneTask)}</strong>
						</div>
						<div>
							<span>Finish time</span>
							<strong>{formatDoneModalCompletedAt(selectedDoneTask)}</strong>
						</div>
						<div>
							<span>Tracked time</span>
							<strong>{formatElapsedDuration(getDoneModalTrackedMilliseconds(selectedDoneTask))}</strong>
						</div>
					</div>
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
						{getBusyAction(selectedDoneTask.id) === 'done' ? 'Closing...' : 'Confirm Done'}
					</button>
				</div>
			</form>
		</div>
	{/if}

	{#if isLoading}
		<div class="message-card">
			<strong>Loading active tasks</strong>
			<p>Pulling the current table and timer state from the database.</p>
		</div>
	{:else if tasks.length === 0}
		<div class="message-card">
			<strong>No active tasks</strong>
			<p>Nothing is on the table right now. Start something from the daymap when you are ready.</p>
		</div>
	{:else}
		<TaskSortBar
			value={sortMode}
			onChange={(nextSortMode) => {
				sortMode = nextSortMode;
				storeTaskSort('active', nextSortMode);
			}}
		/>

		<div class="task-grid">
			{#each sortedTasks as task}
					<TaskCard
						task={task}
						variant="active"
						editableTaskId={task.id}
						activeDurationLabel={getActiveDurationLabel(task)}
						alarmLabel={getAlarmLabel(task)}
						panicDurationLabel={getPanicDurationLabel(task)}
						effectiveDurationLabel={getEffectiveDurationLabel(task)}
						onSaveInstanceNote={handleSaveInstanceNote}
						ringing={isTaskRinging(task)}
						busyAction={getBusyAction(task.id)}
					onDone={handleDone}
					onInactivate={handleInactivate}
					onSaveNote={handleSaveNote}
					onSnooze={handleSnooze}
					onTally={handleTally}
				/>
			{/each}
		</div>
	{/if}
</section>

<style>
	.board {
		display: grid;
		gap: 1rem;
		padding: 1.4rem 0 2.4rem;
	}

	.message-card p {
		margin: 0;
		font-size: 1.05rem;
		color: rgba(10, 20, 30, 0.7);
	}

	.message-card {
		display: grid;
		gap: 0.4rem;
		padding: 1rem 1.1rem;
		border-radius: 18px;
		background: rgba(255, 255, 255, 0.58);
		border: 1px solid rgba(255, 255, 255, 0.66);
		box-shadow: 0 14px 32px rgba(44, 62, 80, 0.08);
	}

	.message-card strong {
		font-size: 1.15rem;
		letter-spacing: -0.02em;
		color: rgba(10, 20, 30, 0.82);
	}

	.error-card {
		border-color: rgba(159, 45, 39, 0.18);
		background: rgba(255, 245, 244, 0.92);
	}

	.warning-card {
		border-color: rgba(191, 121, 31, 0.18);
		background: rgba(255, 249, 239, 0.94);
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
		z-index: 60;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		background: rgba(11, 17, 24, 0.44);
		backdrop-filter: blur(6px);
	}

	.done-modal {
		display: grid;
		gap: 1rem;
		width: min(100%, 34rem);
		padding: 1.25rem;
		border-radius: 26px;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(246, 250, 255, 0.94)),
			radial-gradient(circle at top, rgba(64, 117, 166, 0.12), rgba(255, 255, 255, 0));
		border: 1px solid rgba(255, 255, 255, 0.76);
		box-shadow:
			0 28px 64px rgba(16, 24, 35, 0.22),
			inset 0 1px 0 rgba(255, 255, 255, 0.85);
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
		color: rgba(10, 20, 30, 0.9);
	}

	.done-modal__close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.35rem;
		height: 2.35rem;
		padding: 0;
		border: 1px solid rgba(20, 28, 38, 0.1);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.9);
		color: rgba(20, 28, 38, 0.56);
		font-size: 1.35rem;
		box-shadow: 0 10px 22px rgba(44, 62, 80, 0.08);
	}

	.done-modal__field {
		display: grid;
		gap: 0.65rem;
	}

	.done-modal__field span {
		font-size: 0.74rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(20, 28, 38, 0.5);
	}

	.done-modal__adjust-note {
		margin: -0.1rem 0 0;
		font-size: 0.86rem;
		color: rgba(20, 28, 38, 0.6);
	}

	.done-modal__field strong {
		font-size: 0.86rem;
		color: rgba(20, 28, 38, 0.74);
	}

	.done-modal textarea {
		min-height: 8rem;
		padding: 0.9rem 1rem;
		border: 1px solid rgba(20, 28, 38, 0.12);
		border-radius: 18px;
		background: rgba(255, 255, 255, 0.86);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
		font: inherit;
		line-height: 1.5;
		color: rgba(20, 28, 38, 0.74);
		resize: vertical;
	}

	.done-modal textarea:focus {
		outline: none;
		border-color: rgba(64, 117, 166, 0.4);
		box-shadow:
			0 0 0 3px rgba(64, 117, 166, 0.14),
			inset 0 1px 0 rgba(255, 255, 255, 0.74);
	}

	.done-modal__adjust-controls {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.6rem;
	}

	.done-modal__adjust-button,
	.done-modal__button,
	.done-modal__close {
		cursor: pointer;
		transition:
			transform 0.15s ease,
			box-shadow 0.15s ease,
			opacity 0.15s ease;
	}

	.done-modal__adjust-button {
		padding: 0.75rem 0.8rem;
		border: 1px solid rgba(20, 28, 38, 0.1);
		border-radius: 14px;
		background: rgba(255, 255, 255, 0.88);
		font-weight: 700;
		color: rgba(20, 28, 38, 0.72);
		box-shadow: 0 10px 22px rgba(44, 62, 80, 0.06);
	}

	.done-modal__summary {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.8rem;
	}

	.done-modal__summary div {
		display: grid;
		gap: 0.28rem;
		padding: 0.9rem 1rem;
		border-radius: 18px;
		background: rgba(255, 255, 255, 0.82);
		border: 1px solid rgba(20, 28, 38, 0.08);
	}

	.done-modal__summary strong {
		font-size: 0.98rem;
		color: rgba(10, 20, 30, 0.86);
	}

	.done-modal__button {
		min-height: 2.9rem;
		padding: 0.75rem 1rem;
		border: 0;
		border-radius: 999px;
		font-weight: 800;
		letter-spacing: 0.04em;
	}

	.done-modal__button-secondary {
		background: rgba(255, 255, 255, 0.78);
		color: rgba(20, 28, 38, 0.68);
		box-shadow: inset 0 0 0 1px rgba(20, 28, 38, 0.08);
	}

	.done-modal__button-primary {
		background: linear-gradient(135deg, #4b9f67, #7fbf7f);
		color: white;
		box-shadow: 0 14px 28px rgba(67, 136, 89, 0.22);
	}

	.done-modal__adjust-button:hover,
	.done-modal__button:hover,
	.done-modal__close:hover {
		transform: translateY(-1px);
		box-shadow: 0 12px 24px rgba(44, 62, 80, 0.12);
	}

	.done-modal__adjust-button:disabled,
	.done-modal__button:disabled,
	.done-modal__close:disabled {
		cursor: wait;
		opacity: 0.55;
		transform: none;
	}

	@media (max-width: 640px) {
		.done-modal {
			padding: 1rem;
			border-radius: 22px;
		}

		.done-modal__field-header,
		.done-modal__actions {
			flex-direction: column;
			align-items: stretch;
		}

		.done-modal__adjust-controls,
		.done-modal__summary {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
