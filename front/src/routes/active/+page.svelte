<script>
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	import TaskCard from '$lib/TaskCard.svelte';
	import TaskSortBar from '$lib/TaskSortBar.svelte';
	import { formatElapsedDuration } from '$lib/task-format';
	import { DEFAULT_TASK_SORT_MODE, loadStoredTaskSort, sortTasks, storeTaskSort } from '$lib/task-sort';
	import {
		doneTask,
		inactivateTask,
		loadActiveTasks,
		snoozeTask,
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

	let clockIntervalId = null;
	let alarmLoopId = null;
	let audioContext = null;

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

	function getBusyAction(taskId) {
		return busyTasks[taskId] || null;
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

	async function handleInactivate(taskId) {
		actionError = '';
		setBusy(taskId, 'inactivate');

		try {
			await inactivateTask(taskId);
			await goto('/inactive');
		} catch (error) {
			actionError = error.message;
		} finally {
			clearBusy(taskId);
		}
	}

	async function handleDone(taskId) {
		actionError = '';
		setBusy(taskId, 'done');

		try {
			await doneTask(taskId);
			await goto('/done');
		} catch (error) {
			actionError = error.message;
		} finally {
			clearBusy(taskId);
		}
	}

	async function handleSnooze(taskId) {
		actionError = '';
		setBusy(taskId, 'snooze');

		try {
			const updatedTask = await snoozeTask(taskId);
			tasks = tasks.map((task) => (task.id === taskId ? updatedTask : task));
		} catch (error) {
			actionError = error.message;
		} finally {
			clearBusy(taskId);
		}
	}

	async function handleSaveNote(taskId, note) {
		const updatedTask = await updateTaskNote(taskId, note);
		tasks = tasks.map((task) => (task.id === taskId ? updatedTask : task));
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

		if (browser) {
			clockIntervalId = window.setInterval(() => {
				nowMs = Date.now();
			}, 1000);

			const resumeAudio = () => {
				void unlockAudio();
			};

			window.addEventListener('pointerdown', resumeAudio);
			window.addEventListener('keydown', resumeAudio);

			return () => {
				window.removeEventListener('pointerdown', resumeAudio);
				window.removeEventListener('keydown', resumeAudio);
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

	{#if isLoading}
		<div class="message-card">
			<strong>Loading active tasks</strong>
			<p>Pulling the current table and timer state from the database.</p>
		</div>
	{:else if tasks.length === 0}
		<div class="message-card">
			<strong>No active tasks</strong>
			<p>Nothing is on the table right now. Activate something from the inactive stack.</p>
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
					ringing={isTaskRinging(task)}
					busyAction={getBusyAction(task.id)}
					onDone={handleDone}
					onInactivate={handleInactivate}
					onSaveNote={handleSaveNote}
					onSnooze={handleSnooze}
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
</style>
