<script>
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';

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
		updateActiveTaskStartedAt,
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

	let clockIntervalId = null;

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
		{ preservePanic = false, preserveNote = false, preserveInstanceNote = false } = {}
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
						...(preserveNote
							? {
									note: task.note ?? null
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
		const task = getTaskById(taskId);

		if (!task || getBusyAction(taskId) !== null) {
			return;
		}

		actionError = '';
		setBusy(task.id, 'done');

		try {
			await doneTask(task.id, {
				instanceNote
			});
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
			preservePanic: true,
			preserveNote: true
		});
		return updatedTask;
	}

	async function handleSaveActiveStartedAt(taskId, startedAt) {
		const updatedTask = await updateActiveTaskStartedAt(taskId, startedAt);
		mergeTaskUpdate(taskId, updatedTask, {
			preserveInstanceNote: true
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
							panicDurationLabel={getPanicDurationLabel(task)}
							effectiveDurationLabel={getEffectiveDurationLabel(task)}
							onSaveInstanceNote={handleSaveInstanceNote}
							showIntensityControl={true}
							busyAction={getBusyAction(task.id)}
							onDone={handleDone}
							onInactivate={handleCancelActive}
							onIntensityChange={handleIntensityChange}
							onSaveActiveStartedAt={handleSaveActiveStartedAt}
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
</style>
