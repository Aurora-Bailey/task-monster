<script>
	import { onDestroy, tick } from 'svelte';

	import {
		formatElapsedDuration,
		formatTaskMode,
		formatTaskTrackingType,
		formatTallyCount,
		formatTallyProgress
	} from '$lib/task-format';

	const NOTE_SAVE_DEBOUNCE_MS = 1000;
	const panicTimeFormatter = new Intl.DateTimeFormat(undefined, {
		hour: 'numeric',
		minute: '2-digit'
	});
	const timingWeekdayFormatter = new Intl.DateTimeFormat(undefined, {
		weekday: 'short'
	});
	const lastDoneDateFormatter = new Intl.DateTimeFormat(undefined, {
		month: 'short',
		day: 'numeric'
	});
	const lastDoneTimeFormatter = new Intl.DateTimeFormat(undefined, {
		hour: 'numeric',
		minute: '2-digit'
	});
	const weekdayOptions = [
		{ value: 1, short: 'M', label: 'Monday' },
		{ value: 2, short: 'T', label: 'Tuesday' },
		{ value: 3, short: 'W', label: 'Wednesday' },
		{ value: 4, short: 'T', label: 'Thursday' },
		{ value: 5, short: 'F', label: 'Friday' },
		{ value: 6, short: 'S', label: 'Saturday' },
		{ value: 0, short: 'S', label: 'Sunday' }
	];
	const currentWeekday = new Date().getDay();

	let {
		task,
		variant = 'inactive',
		editableTaskId = null,
		clickActionLabel = 'Activate',
		enableInactiveCardClick = false,
		compact = false,
		activeDurationLabel = '',
		panicDurationLabel = '',
		effectiveDurationLabel = '',
		doneDurationLabel = '',
		doneTallyCount = null,
		completedAtLabel = '',
		busyAction = null,
		onSaveNote = null,
		onSaveInstanceNote = null,
		onSaveNextDue = null,
		onScheduleChange = null,
		showDaymapToggle = false,
		showActivateButton = false,
		showScheduleControls = false,
		showArchiveButton = false,
		onActivate = () => {},
		onDaymapToggle = () => {},
		onArchive = () => {},
		onToggleDaymapLock = () => {},
		onQueueToggle = () => {},
		onTally = () => {},
		onUnmap = () => {},
		onInactivate = () => {},
		onDone = () => {}
	} = $props();

	const isTallyTask = $derived(task.trackingType === 'tally');
	const isInactiveCard = $derived(variant === 'inactive');
	const isDaymapCard = $derived(variant === 'daymap');
	const usesInactiveCardClick = $derived(isInactiveCard && enableInactiveCardClick);
	const isQueuedDaymapTask = $derived(
		isDaymapCard && Number.isInteger(task.queuePosition) && task.queuePosition > 0
	);
	const showsDaymapLock = $derived(isDaymapCard && task.mode === 'repeatable');
	const showsRuntime = $derived(variant === 'active' || variant === 'done');
	const showsActions = $derived(variant === 'active');
	const showsHeaderDaymapToggle = $derived(showDaymapToggle && (isInactiveCard || isDaymapCard));
	const showsHeaderActivate = $derived(showActivateButton && (isInactiveCard || isDaymapCard));
	const isScheduledOnlyDaymapTask = $derived(
		isDaymapCard && task.scheduledToday === true && task.mappedToday !== true
	);
	const canUseHeaderDaymapToggle = $derived(showsHeaderDaymapToggle && !isScheduledOnlyDaymapTask);
	const showsWeekdaySchedule = $derived(
		showScheduleControls && task.mode === 'repeatable' && Boolean(onScheduleChange)
	);
	const canEditNote = $derived(Boolean(editableTaskId && onSaveNote));
	const canEditInstanceNote = $derived(
		variant === 'active' && Boolean(editableTaskId && onSaveInstanceNote)
	);
	const canEditNextDue = $derived(Boolean(editableTaskId && onSaveNextDue));
	const showsInstanceNote = $derived(Boolean(task.instanceNote) || canEditInstanceNote);
	const taskPanicLog = $derived(Array.isArray(task.taskPanicLog) ? task.taskPanicLog : []);
	const showsTaskPanicLog = $derived(taskPanicLog.length > 0);
	const tallyUnitLabel = $derived(task.tallyUnit || 'units');
	const activeTallyCountValue = $derived(
		Number.isInteger(task.activeTallyCount) ? task.activeTallyCount : 0
	);
	const resolvedDoneTallyCount = $derived(
		Number.isInteger(doneTallyCount)
			? doneTallyCount
			: Number.isInteger(task.lastCompletedTallyCount)
				? task.lastCompletedTallyCount
				: 0
	);
	const visibleTitleChips = $derived(
		[
			variant === 'done' ? 'Completed' : null,
			task.mode === 'one-time' ? formatTaskMode(task.mode) : null,
			task.trackingType === 'tally' ? formatTaskTrackingType(task.trackingType) : null
		].filter(Boolean)
	);

	let draftNote = $state('');
	let lastCommittedNote = $state('');
	let noteSaveStatus = $state('idle');
	let noteSaveError = $state('');
	let draftInstanceNote = $state('');
	let lastCommittedInstanceNote = $state('');
	let instanceNoteSaveStatus = $state('idle');
	let instanceNoteSaveError = $state('');
	let nextDueEditorOpen = $state(false);
	let draftNextDueAt = $state('');
	let nextDueSaveStatus = $state('idle');
	let nextDueSaveError = $state('');
	let nextDueInput = $state(null);

	let pendingSaveTimer = null;
	let noteRevision = 0;
	let pendingInstanceNoteSaveTimer = null;
	let instanceNoteRevision = 0;

	function clearPendingNoteSave() {
		if (pendingSaveTimer !== null) {
			clearTimeout(pendingSaveTimer);
			pendingSaveTimer = null;
		}
	}

	function clearPendingInstanceNoteSave() {
		if (pendingInstanceNoteSaveTimer !== null) {
			clearTimeout(pendingInstanceNoteSaveTimer);
			pendingInstanceNoteSaveTimer = null;
		}
	}

	function isInteractiveCardTarget(event) {
		return Boolean(
			event?.target?.closest?.('button, input, textarea, select, a, label, .task-card__interactive')
		);
	}

	function handleInactiveActivate(event) {
		if (!usesInactiveCardClick || busyAction !== null) {
			return;
		}

		if (isInteractiveCardTarget(event)) {
			return;
		}

		onActivate(task.id);
	}

	function handleInactiveKeydown(event) {
		if (!usesInactiveCardClick || busyAction !== null) {
			return;
		}

		if (isInteractiveCardTarget(event)) {
			return;
		}

		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			onActivate(task.id);
		}
	}

	function stopEventPropagation(event) {
		event.stopPropagation();
	}

	function padDateTimePart(value) {
		return String(value).padStart(2, '0');
	}

	function formatDateTimeLocalValue(value) {
		if (!value) {
			return '';
		}

		const date = new Date(value);

		if (Number.isNaN(date.getTime())) {
			return '';
		}

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

	function handleArchiveClick(event) {
		event.stopPropagation();

		if (!showArchiveButton || busyAction !== null) {
			return;
		}

		onArchive(task.id);
	}

	function handleQueueToggleClick(event) {
		event.stopPropagation();

		if (!isDaymapCard || busyAction !== null) {
			return;
		}

		onQueueToggle(task);
	}

	function handleDaymapLockClick(event) {
		event.stopPropagation();

		if (!showsDaymapLock || busyAction !== null) {
			return;
		}

		onToggleDaymapLock(task);
	}

	function handleDaymapToggleClick(event) {
		event.stopPropagation();

		if (!canUseHeaderDaymapToggle || busyAction !== null) {
			return;
		}

		onDaymapToggle(task);
	}

	function getScheduledWeekdays() {
		return Array.isArray(task.daymapWeekdays) ? task.daymapWeekdays : [];
	}

	function isWeekdayScheduled(weekday) {
		return getScheduledWeekdays().includes(weekday);
	}

	function handleScheduleToggle(event, weekday) {
		event.stopPropagation();

		if (!showsWeekdaySchedule || busyAction !== null) {
			return;
		}

		const nextWeekdays = new Set(getScheduledWeekdays());

		if (nextWeekdays.has(weekday)) {
			nextWeekdays.delete(weekday);
		} else {
			nextWeekdays.add(weekday);
		}

		onScheduleChange(
			task,
			[...nextWeekdays].sort((left, right) => left - right)
		);
	}

	function handleHeaderActivateClick(event) {
		event.stopPropagation();

		if (!showsHeaderActivate || busyAction !== null) {
			return;
		}

		onActivate(task.id);
	}

	function handleTallyClick(event, delta) {
		event.stopPropagation();

		if (variant !== 'active' || !isTallyTask || busyAction !== null) {
			return;
		}

		onTally(task.id, delta);
	}

	function scheduleNoteSave() {
		if (!canEditNote) {
			return;
		}

		clearPendingNoteSave();
		noteSaveError = '';

		if (draftNote === lastCommittedNote) {
			noteSaveStatus = noteSaveStatus === 'saved' ? 'saved' : 'idle';
			return;
		}

		noteRevision += 1;
		const revision = noteRevision;
		const noteToSave = draftNote;
		noteSaveStatus = 'pending';
		pendingSaveTimer = setTimeout(() => {
			pendingSaveTimer = null;
			void persistNote(revision, noteToSave);
		}, NOTE_SAVE_DEBOUNCE_MS);
	}

	async function persistNote(revision, noteToSave) {
		if (!canEditNote) {
			return;
		}

		if (noteToSave === lastCommittedNote) {
			if (revision === noteRevision) {
				noteSaveStatus = 'saved';
			}
			return;
		}

		noteSaveStatus = 'saving';

		try {
			const updatedTask = await onSaveNote(editableTaskId, noteToSave);
			const normalizedNote = updatedTask?.note ?? '';

			lastCommittedNote = normalizedNote;

			if (revision !== noteRevision) {
				return;
			}

			draftNote = normalizedNote;
			noteSaveStatus = 'saved';
		} catch (error) {
			if (revision !== noteRevision) {
				return;
			}

			noteSaveStatus = 'error';
			noteSaveError = error.message;
		}
	}

	function handleNoteInput() {
		scheduleNoteSave();
	}

	function formatPanicWindow(startedAt, endedAt) {
		return `${panicTimeFormatter.format(new Date(startedAt))} - ${panicTimeFormatter.format(new Date(endedAt))}`;
	}

	function formatLastDone(value) {
		if (!value) {
			return {
				weekdayLabel: 'Never',
				dateTimeLabel: 'No runs'
			};
		}

		const date = new Date(value);

		if (Number.isNaN(date.getTime())) {
			return {
				weekdayLabel: 'Never',
				dateTimeLabel: 'No runs'
			};
		}

		const weekdayLabel = timingWeekdayFormatter.format(date);
		const dateLabel = lastDoneDateFormatter.format(date);
		const timeLabel = lastDoneTimeFormatter.format(date).replace(' AM', 'am').replace(' PM', 'pm');

		return {
			weekdayLabel,
			dateTimeLabel: `${dateLabel} @ ${timeLabel}`
		};
	}

	function formatNextDue(value) {
		if (!value) {
			return {
				weekdayLabel: 'Unset',
				dateTimeLabel: canEditNextDue ? 'Schedule' : 'No date'
			};
		}

		const date = new Date(value);

		if (Number.isNaN(date.getTime())) {
			return {
				weekdayLabel: 'Unset',
				dateTimeLabel: canEditNextDue ? 'Schedule' : 'No date'
			};
		}

		return formatLastDone(value);
	}

	function formatTimingTitle(label, meta) {
		return `${label}: ${meta.weekdayLabel} ${meta.dateTimeLabel}`;
	}

	async function openNextDueEditor(event) {
		event.stopPropagation();

		if (!canEditNextDue || nextDueSaveStatus === 'saving') {
			return;
		}

		draftNextDueAt = formatDateTimeLocalValue(task.nextDueAt);
		nextDueSaveStatus = 'idle';
		nextDueSaveError = '';
		nextDueEditorOpen = true;
		await tick();
		nextDueInput?.focus();
	}

	function closeNextDueEditor(event) {
		event?.stopPropagation();

		if (nextDueSaveStatus === 'saving') {
			return;
		}

		nextDueEditorOpen = false;
		nextDueSaveStatus = 'idle';
		nextDueSaveError = '';
		draftNextDueAt = formatDateTimeLocalValue(task.nextDueAt);
	}

	async function handleNextDueSubmit(event) {
		event.preventDefault();
		event.stopPropagation();

		if (!canEditNextDue || nextDueSaveStatus === 'saving') {
			return;
		}

		const nextDueDate = parseDateTimeLocalValue(draftNextDueAt);

		if (!nextDueDate) {
			nextDueSaveStatus = 'error';
			nextDueSaveError = 'Enter a valid next due time.';
			return;
		}

		nextDueSaveStatus = 'saving';
		nextDueSaveError = '';

		try {
			const updatedTask = await onSaveNextDue(editableTaskId, nextDueDate.toISOString());

			draftNextDueAt = formatDateTimeLocalValue(updatedTask?.nextDueAt ?? nextDueDate);
			nextDueSaveStatus = 'saved';
			nextDueEditorOpen = false;
		} catch (error) {
			nextDueSaveStatus = 'error';
			nextDueSaveError = error.message;
		}
	}

	function formatPanicCharge(value) {
		return `${value}/10 pull`;
	}

	function scheduleInstanceNoteSave() {
		if (!canEditInstanceNote) {
			return;
		}

		clearPendingInstanceNoteSave();
		instanceNoteSaveError = '';

		if (draftInstanceNote === lastCommittedInstanceNote) {
			instanceNoteSaveStatus = instanceNoteSaveStatus === 'saved' ? 'saved' : 'idle';
			return;
		}

		instanceNoteRevision += 1;
		const revision = instanceNoteRevision;
		const noteToSave = draftInstanceNote;
		instanceNoteSaveStatus = 'pending';
		pendingInstanceNoteSaveTimer = setTimeout(() => {
			pendingInstanceNoteSaveTimer = null;
			void persistInstanceNote(revision, noteToSave);
		}, NOTE_SAVE_DEBOUNCE_MS);
	}

	async function persistInstanceNote(revision, noteToSave) {
		if (!canEditInstanceNote) {
			return;
		}

		if (noteToSave === lastCommittedInstanceNote) {
			if (revision === instanceNoteRevision) {
				instanceNoteSaveStatus = 'saved';
			}
			return;
		}

		instanceNoteSaveStatus = 'saving';

		try {
			const updatedTask = await onSaveInstanceNote(editableTaskId, noteToSave);
			const normalizedNote = updatedTask?.instanceNote ?? '';

			lastCommittedInstanceNote = normalizedNote;

			if (revision !== instanceNoteRevision) {
				return;
			}

			draftInstanceNote = normalizedNote;
			instanceNoteSaveStatus = 'saved';
		} catch (error) {
			if (revision !== instanceNoteRevision) {
				return;
			}

			instanceNoteSaveStatus = 'error';
			instanceNoteSaveError = error.message;
		}
	}

	function handleInstanceNoteInput() {
		scheduleInstanceNoteSave();
	}

	$effect(() => {
		const incomingNote = task.note ?? '';

		if (incomingNote === lastCommittedNote) {
			return;
		}

		lastCommittedNote = incomingNote;

		if (noteSaveStatus !== 'pending' && noteSaveStatus !== 'saving') {
			draftNote = incomingNote;
		}
	});

	$effect(() => {
		const incomingInstanceNote = task.instanceNote ?? '';

		if (incomingInstanceNote === lastCommittedInstanceNote) {
			return;
		}

		lastCommittedInstanceNote = incomingInstanceNote;

		if (instanceNoteSaveStatus !== 'pending' && instanceNoteSaveStatus !== 'saving') {
			draftInstanceNote = incomingInstanceNote;
		}
	});

	$effect(() => {
		if (nextDueSaveStatus === 'saving') {
			return;
		}

		draftNextDueAt = formatDateTimeLocalValue(task.nextDueAt);
	});

	onDestroy(() => {
		clearPendingNoteSave();
		clearPendingInstanceNoteSave();
	});
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
	class="task-card"
	class:is-active={variant !== 'inactive'}
	class:is-inactive={isInactiveCard}
	class:is-busy={busyAction !== null}
	class:is-compact={compact}
	class:is-started-today={task.startedToday === true && variant !== 'active'}
	class:uses-card-click={usesInactiveCardClick}
	style={`--task-accent: ${task.color};`}
	role={usesInactiveCardClick ? 'button' : undefined}
	tabindex={usesInactiveCardClick ? 0 : undefined}
	aria-label={usesInactiveCardClick ? `${clickActionLabel} ${task.name}` : undefined}
	aria-disabled={usesInactiveCardClick ? busyAction !== null : undefined}
	onclick={usesInactiveCardClick ? handleInactiveActivate : undefined}
	onkeydown={usesInactiveCardClick ? handleInactiveKeydown : undefined}
>
	<div class="task-card__header">
		<div class="task-card__header-main">
			<div class="task-card__title-block">
				<h2>{task.name}</h2>

				{#if visibleTitleChips.length > 0}
					<div class="task-card__title-chips">
						{#each visibleTitleChips as chip}
							<span class="highlight-chip">{chip}</span>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<div class="task-card__header-actions">
			{#if showsHeaderDaymapToggle}
				<button
					class="task-card__icon-action daymap-toggle-button"
					class:is-selected={isDaymapCard && task.mappedToday === true}
					type="button"
					aria-label={isScheduledOnlyDaymapTask
						? `${task.name} is scheduled for today. Toggle today's weekday off to remove it from the daymap.`
						: isDaymapCard
							? `Move ${task.name} to inactive`
							: `Move ${task.name} to daymap`}
					title={isScheduledOnlyDaymapTask
						? "Scheduled today; toggle today's weekday off below"
						: isDaymapCard
							? 'Move to inactive'
							: 'Move to daymap'}
					disabled={busyAction !== null || !canUseHeaderDaymapToggle}
					onpointerdown={stopEventPropagation}
					onclick={handleDaymapToggleClick}
					onkeydown={stopEventPropagation}
				>
					{#if busyAction === 'daymap' || busyAction === 'unmap'}
						<span class="queue-button__spinner" aria-hidden="true"></span>
					{:else}
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<path
								d="m12 3 2.72 5.5 6.07.88-4.39 4.28 1.04 6.04L12 16.84 6.56 19.7l1.04-6.04-4.39-4.28 6.07-.88L12 3Z"
								fill={task.mappedToday === true ? 'currentColor' : 'none'}
								stroke="currentColor"
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="1.65"
							/>
						</svg>
					{/if}
				</button>
			{/if}

			{#if showsDaymapLock}
				<button
					class="task-card__icon-action daymap-lock-button"
					class:is-locked={task.daymapLocked}
					type="button"
					aria-label={task.daymapLocked
						? `Unlock ${task.name} from looping back to daymap`
						: `Lock ${task.name} to loop back to daymap`}
					title={task.daymapLocked
						? 'Locked to return to daymap after done'
						: 'Return to inactive after done'}
					disabled={busyAction !== null}
					onpointerdown={stopEventPropagation}
					onclick={handleDaymapLockClick}
					onkeydown={stopEventPropagation}
				>
					{#if busyAction === 'lock' || busyAction === 'unlock'}
						<span class="queue-button__spinner" aria-hidden="true"></span>
					{:else}
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<path
								d="M8 10V8a4 4 0 1 1 8 0v2m-9 0h10a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z"
								fill="none"
								stroke="currentColor"
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="1.8"
							/>
						</svg>
					{/if}
				</button>
			{/if}

			{#if isDaymapCard}
				<button
					class="task-card__icon-action queue-button"
					class:is-queued={isQueuedDaymapTask}
					type="button"
					aria-label={isQueuedDaymapTask
						? `Remove ${task.name} from the queue`
						: `Add ${task.name} to the queue`}
					title={isQueuedDaymapTask ? 'Remove from queue' : 'Add to queue'}
					disabled={busyAction !== null}
					onpointerdown={stopEventPropagation}
					onclick={handleQueueToggleClick}
					onkeydown={stopEventPropagation}
				>
					{#if busyAction === 'queue' || busyAction === 'unqueue'}
						<span class="queue-button__spinner" aria-hidden="true"></span>
					{:else if isQueuedDaymapTask}
						<span>{task.queuePosition}</span>
					{:else}
						<span>+</span>
					{/if}
				</button>
			{/if}

			{#if showsHeaderActivate}
				<button
					class="task-card__icon-action activate-icon-button"
					type="button"
					aria-label={`Activate ${task.name}`}
					title="Activate"
					disabled={busyAction !== null}
					onpointerdown={stopEventPropagation}
					onclick={handleHeaderActivateClick}
					onkeydown={stopEventPropagation}
				>
					{#if busyAction === 'activate'}
						<span class="queue-button__spinner" aria-hidden="true"></span>
					{:else}
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<path
								d="M8 5v14l11-7L8 5Z"
								fill="currentColor"
								stroke="currentColor"
								stroke-linejoin="round"
								stroke-width="1.4"
							/>
						</svg>
					{/if}
				</button>
			{/if}

			{#if showArchiveButton}
				<button
					class="task-card__icon-action archive-button"
					type="button"
					aria-label={`Archive ${task.name}`}
					title="Archive task"
					disabled={busyAction !== null}
					onpointerdown={stopEventPropagation}
					onclick={handleArchiveClick}
					onkeydown={stopEventPropagation}
				>
					{#if busyAction === 'archive'}
						<span class="queue-button__spinner" aria-hidden="true"></span>
					{:else}
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<path
								d="M4 7h16M7 7V5h10v2m-9 4h8m-9 0v6h10v-6"
								fill="none"
								stroke="currentColor"
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="1.8"
							/>
						</svg>
					{/if}
				</button>
			{/if}
		</div>
	</div>

	<div class="task-card__timing-row" class:is-editing-next-due={nextDueEditorOpen}>
		{#if true}
			{@const lastDoneMeta = formatLastDone(task.lastCompletedAt)}
			<p
				class="task-card__timing-meta task-card__last-done"
				title={formatTimingTitle('Last done', lastDoneMeta)}
				aria-label={formatTimingTitle('Last done', lastDoneMeta)}
			>
				<strong class="task-card__timing-day">{lastDoneMeta.weekdayLabel}</strong>
				<span class="task-card__timing-date">{lastDoneMeta.dateTimeLabel}</span>
			</p>
		{/if}

		<svg class="task-card__timing-arrow" viewBox="0 0 18 10" aria-hidden="true">
			<path
				d="M1 5h14m-4-4 4 4-4 4"
				fill="none"
				stroke="currentColor"
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="1.4"
			/>
		</svg>

		{#if true}
			{@const nextDueMeta = formatNextDue(task.nextDueAt)}
			{#if nextDueEditorOpen}
				<form
					class="task-card__next-due-editor task-card__interactive"
					onsubmit={handleNextDueSubmit}
				>
					<label>
						<span>Next due</span>
						<input
							bind:this={nextDueInput}
							bind:value={draftNextDueAt}
							type="datetime-local"
							disabled={nextDueSaveStatus === 'saving'}
						/>
					</label>

					<div class="task-card__next-due-actions">
						<button type="submit" disabled={nextDueSaveStatus === 'saving'}>
							{nextDueSaveStatus === 'saving' ? 'Saving...' : 'Save'}
						</button>
						<button
							type="button"
							disabled={nextDueSaveStatus === 'saving'}
							onclick={closeNextDueEditor}
						>
							Cancel
						</button>
					</div>

					{#if nextDueSaveStatus === 'error' && nextDueSaveError}
						<p class="task-card__next-due-error">{nextDueSaveError}</p>
					{/if}
				</form>
			{:else if canEditNextDue}
				<button
					class="task-card__timing-meta task-card__next-due task-card__timing-button"
					type="button"
					aria-label={`Edit next due time for ${task.name}. ${formatTimingTitle('Next due', nextDueMeta)}`}
					title={formatTimingTitle('Next due', nextDueMeta)}
					onpointerdown={stopEventPropagation}
					onclick={openNextDueEditor}
					onkeydown={stopEventPropagation}
				>
					<strong class="task-card__timing-day">{nextDueMeta.weekdayLabel}</strong>
					<span class="task-card__timing-date">{nextDueMeta.dateTimeLabel}</span>
				</button>
			{:else}
				<p
					class="task-card__timing-meta task-card__next-due"
					title={formatTimingTitle('Next due', nextDueMeta)}
					aria-label={formatTimingTitle('Next due', nextDueMeta)}
				>
					<strong class="task-card__timing-day">{nextDueMeta.weekdayLabel}</strong>
					<span class="task-card__timing-date">{nextDueMeta.dateTimeLabel}</span>
				</p>
			{/if}
		{/if}
	</div>

	{#if showsWeekdaySchedule}
		<div
			class="task-card__weekday-schedule task-card__interactive"
			aria-label={`Auto daymap schedule for ${task.name}`}
		>
			{#each weekdayOptions as weekday}
				<button
					class="weekday-schedule-button"
					class:is-selected={isWeekdayScheduled(weekday.value)}
					class:is-today={weekday.value === currentWeekday}
					type="button"
					aria-pressed={isWeekdayScheduled(weekday.value)}
					title={`${weekday.label}${weekday.value === currentWeekday ? ' (today)' : ''}`}
					disabled={busyAction !== null}
					onpointerdown={stopEventPropagation}
					onclick={(event) => handleScheduleToggle(event, weekday.value)}
					onkeydown={stopEventPropagation}
				>
					<span>{weekday.short}</span>
				</button>
			{/each}
		</div>
	{/if}

	{#if task.note || canEditNote}
		<div class="task-card__note-block">
			<div
				class="task-card__note-header"
				role="presentation"
				onpointerdown={stopEventPropagation}
				onclick={stopEventPropagation}
				onkeydown={stopEventPropagation}
			>
				<span class="task-card__note-label">Notepad</span>

				{#if canEditNote}
					<div class="task-card__note-status" aria-live="polite">
						{#if noteSaveStatus === 'pending' || noteSaveStatus === 'saving'}
							<span class="note-spinner" aria-label="Waiting to save"></span>
						{:else if noteSaveStatus === 'saved'}
							<span class="note-check" aria-label="Saved">✓</span>
						{:else if noteSaveStatus === 'error'}
							<span class="note-error" aria-label="Save failed">!</span>
						{/if}
					</div>
				{/if}
			</div>

			{#if canEditNote}
				<textarea
					bind:value={draftNote}
					class="task-card__note-input"
					rows={compact ? 2 : 3}
					placeholder="Add to notepad..."
					onpointerdown={stopEventPropagation}
					onclick={stopEventPropagation}
					onkeydown={stopEventPropagation}
					onkeyup={stopEventPropagation}
					oninput={handleNoteInput}
				></textarea>

				{#if noteSaveStatus === 'error' && noteSaveError}
					<p class="task-card__note-error">{noteSaveError}</p>
				{/if}
			{:else}
				<p class="task-card__note">{task.note}</p>
			{/if}
		</div>
	{/if}

	{#if showsInstanceNote}
		<div class="task-card__note-block task-card__note-block-instance">
			<div
				class="task-card__note-header"
				role="presentation"
				onpointerdown={stopEventPropagation}
				onclick={stopEventPropagation}
				onkeydown={stopEventPropagation}
			>
				<span class="task-card__note-label">Instance Notepad</span>

				{#if canEditInstanceNote}
					<div class="task-card__note-status" aria-live="polite">
						{#if instanceNoteSaveStatus === 'pending' || instanceNoteSaveStatus === 'saving'}
							<span class="note-spinner" aria-label="Waiting to save"></span>
						{:else if instanceNoteSaveStatus === 'saved'}
							<span class="note-check" aria-label="Saved">✓</span>
						{:else if instanceNoteSaveStatus === 'error'}
							<span class="note-error" aria-label="Save failed">!</span>
						{/if}
					</div>
				{/if}
			</div>

			{#if canEditInstanceNote}
				<textarea
					bind:value={draftInstanceNote}
					class="task-card__note-input"
					rows={compact ? 2 : 3}
					placeholder="Add to this session..."
					onpointerdown={stopEventPropagation}
					onclick={stopEventPropagation}
					onkeydown={stopEventPropagation}
					onkeyup={stopEventPropagation}
					oninput={handleInstanceNoteInput}
				></textarea>

				{#if instanceNoteSaveStatus === 'error' && instanceNoteSaveError}
					<p class="task-card__note-error">{instanceNoteSaveError}</p>
				{/if}
			{:else}
				<p class="task-card__note">{task.instanceNote}</p>
			{/if}
		</div>
	{/if}

	{#if showsRuntime}
		{#if isTallyTask}
			<div class="task-card__runtime">
				<div class="runtime-stat">
					<span>{variant === 'done' ? 'Completed' : 'Current count'}</span>
					<strong>
						{formatTallyCount(
							variant === 'done' ? resolvedDoneTallyCount : activeTallyCountValue,
							tallyUnitLabel
						)}
					</strong>
				</div>

				<div class="runtime-stat">
					<span>{variant === 'done' ? 'Logged' : 'Target'}</span>
					<strong>
						{variant === 'done'
							? completedAtLabel
							: Number.isInteger(task.tallyTarget) && task.tallyTarget > 0
								? formatTallyCount(task.tallyTarget, tallyUnitLabel)
								: 'No target'}
					</strong>
				</div>
			</div>

			{#if variant === 'active'}
				<div class="tally-panel">
					<button
						class="tally-button tally-button-minus"
						type="button"
						disabled={busyAction !== null || activeTallyCountValue <= 0}
						onclick={(event) => handleTallyClick(event, -1)}
					>
						{busyAction === 'tally-down' ? '...' : '-'}
					</button>

					<div class="tally-readout">
						<span>Progress</span>
						<strong
							>{formatTallyProgress(
								activeTallyCountValue,
								task.tallyTarget,
								tallyUnitLabel
							)}</strong
						>
					</div>

					<button
						class="tally-button tally-button-plus"
						type="button"
						disabled={busyAction !== null}
						onclick={(event) => handleTallyClick(event, 1)}
					>
						{busyAction === 'tally-up' ? '...' : '+'}
					</button>
				</div>
			{/if}
		{:else}
			<div class="task-card__runtime">
				<div class="runtime-stat">
					<span>{variant === 'done' ? 'Worked for' : 'Active for'}</span>
					<strong>{variant === 'done' ? doneDurationLabel : activeDurationLabel}</strong>
				</div>

				<div class="runtime-stat">
					<span>{variant === 'done' ? 'Completed' : 'Timer'}</span>
					<strong>{variant === 'done' ? completedAtLabel : 'Running'}</strong>
				</div>
			</div>
		{/if}
	{/if}

	{#if panicDurationLabel}
		<p class="task-card__panic-duration">{panicDurationLabel}</p>
	{/if}

	{#if effectiveDurationLabel}
		<p class="task-card__effective-duration">{effectiveDurationLabel}</p>
	{/if}

	{#if showsTaskPanicLog}
		<div class="task-card__panic-log">
			<div class="task-card__panic-log-header">
				<span>Task Panic Log</span>
			</div>

			<div class="task-card__panic-log-list">
				{#each taskPanicLog as panicItem}
					<article class="task-card__panic-item">
						<div class="task-card__panic-item-top">
							<strong>{formatPanicWindow(panicItem.startedAt, panicItem.endedAt)}</strong>
							<span>{formatElapsedDuration(panicItem.milliseconds)}</span>
						</div>

						{#if panicItem.emotionalCharge !== null}
							<p class="task-card__panic-charge">{formatPanicCharge(panicItem.emotionalCharge)}</p>
						{/if}

						{#if panicItem.note}
							<p class="task-card__panic-note">{panicItem.note}</p>
						{/if}
					</article>
				{/each}
			</div>
		</div>
	{/if}

	{#if showsActions}
		<div class="task-card__actions split-actions">
			{#if isDaymapCard}
				<button
					class="action-button subtle-button"
					type="button"
					disabled={busyAction !== null}
					onclick={() => onUnmap(task.id)}
				>
					{busyAction === 'unmap' ? 'Moving...' : 'Inactive'}
				</button>
				<button
					class="action-button success-button"
					type="button"
					disabled={busyAction !== null}
					onclick={() => onActivate(task.id)}
				>
					{busyAction === 'activate' ? 'Starting...' : 'Activate'}
				</button>
			{:else}
				<button
					class="action-button subtle-button"
					type="button"
					disabled={busyAction !== null}
					onclick={() => onInactivate(task.id)}
				>
					{busyAction === 'inactivate' ? 'Moving...' : 'Daymap'}
				</button>
				<button
					class="action-button success-button"
					type="button"
					disabled={busyAction !== null}
					onclick={() =>
						onDone(task.id, {
							instanceNote: canEditInstanceNote ? draftInstanceNote : (task.instanceNote ?? '')
						})}
				>
					{busyAction === 'done' ? 'Closing...' : 'Done'}
				</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.task-card {
		display: grid;
		gap: 1rem;
		padding: 1.2rem;
		border-radius: 20px;
		background:
			linear-gradient(
				180deg,
				var(--surface-2),
				color-mix(in srgb, var(--surface-1) 84%, transparent)
			),
			linear-gradient(
				135deg,
				color-mix(in srgb, var(--task-accent) 14%, transparent),
				transparent 68%
			);
		border: 1px solid color-mix(in srgb, var(--task-accent) 22%, var(--surface-border));
		box-shadow: var(--surface-shadow), var(--surface-inset);
		position: relative;
		overflow: hidden;
	}

	.task-card.is-inactive {
		border-width: 2px;
		border-color: color-mix(in srgb, var(--task-accent) 58%, var(--surface-border));
		box-shadow:
			var(--surface-shadow),
			0 0 0 1px color-mix(in srgb, var(--task-accent) 16%, transparent),
			var(--surface-inset);
		transition:
			transform 0.16s ease,
			box-shadow 0.16s ease,
			border-color 0.16s ease;
	}

	.task-card.uses-card-click {
		cursor: pointer;
	}

	.task-card.is-inactive.uses-card-click:hover {
		transform: translateY(-2px);
		border-color: color-mix(in srgb, var(--task-accent) 82%, var(--surface-border));
		box-shadow:
			var(--surface-shadow-strong),
			0 0 0 1px color-mix(in srgb, var(--task-accent) 22%, transparent),
			var(--surface-inset);
	}

	.task-card.is-inactive.uses-card-click:focus-visible {
		outline: none;
		box-shadow:
			0 0 0 4px color-mix(in srgb, var(--task-accent) 24%, transparent),
			var(--surface-shadow-strong),
			var(--surface-inset);
	}

	.task-card.is-inactive.is-busy {
		cursor: wait;
		transform: none;
	}

	.task-card.is-compact {
		gap: 0.68rem;
		padding: 0.82rem 0.88rem 0.88rem;
		border-radius: 16px;
	}

	.task-card.is-started-today {
		opacity: 0.5;
	}

	.task-card.is-compact::before {
		width: 0.28rem;
	}

	.task-card::before {
		content: '';
		position: absolute;
		inset: 0 auto 0 0;
		width: 0.38rem;
		background: linear-gradient(
			180deg,
			var(--task-accent),
			color-mix(in srgb, var(--task-accent) 55%, var(--surface-3))
		);
	}

	.task-card.is-active {
		box-shadow:
			var(--surface-shadow-strong),
			0 0 0 1px color-mix(in srgb, var(--task-accent) 20%, transparent);
	}

	.task-card__header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	.task-card__header-main {
		display: flex;
		align-items: flex-start;
		gap: 0.85rem;
		min-width: 0;
		flex: 1 1 auto;
	}

	.task-card__header-actions {
		display: inline-flex;
		align-items: flex-start;
		justify-content: flex-end;
		gap: 0.48rem;
		flex: 0 0 auto;
	}

	.task-card__title-block {
		display: grid;
		gap: 0.25rem;
		min-width: 0;
	}

	.task-card.is-compact .task-card__header {
		gap: 0.65rem;
	}

	.task-card.is-compact .task-card__header-actions {
		gap: 0.34rem;
	}

	.task-card__icon-action {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: 0 0 auto;
		width: 2.35rem;
		height: 2.35rem;
		padding: 0;
		border: 1px solid var(--surface-border-strong);
		border-radius: 999px;
		background: var(--surface-2);
		box-shadow: var(--surface-shadow);
		cursor: pointer;
		transition:
			transform 0.15s ease,
			box-shadow 0.15s ease,
			color 0.15s ease,
			background 0.15s ease,
			border-color 0.15s ease;
	}

	.task-card.is-compact .task-card__icon-action {
		width: 2.05rem;
		height: 2.05rem;
	}

	.task-card__icon-action svg {
		width: 1rem;
		height: 1rem;
	}

	.task-card__icon-action:focus-visible {
		outline: none;
		box-shadow:
			0 0 0 3px color-mix(in srgb, var(--color-theme-1) 20%, transparent),
			var(--surface-shadow-strong);
	}

	.task-card__weekday-schedule {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.2rem;
		padding: 0;
		margin-top: -0.14rem;
	}

	.weekday-schedule-button {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.42rem;
		height: 1.42rem;
		padding: 0;
		border: 1px solid color-mix(in srgb, var(--task-accent) 18%, var(--surface-border));
		border-radius: 999px;
		background: color-mix(in srgb, var(--surface-2) 72%, transparent);
		color: var(--color-muted);
		font: inherit;
		font-size: 0.58rem;
		font-weight: 900;
		line-height: 1;
		cursor: pointer;
		transition:
			transform 0.15s ease,
			border-color 0.15s ease,
			background 0.15s ease,
			color 0.15s ease;
	}

	.weekday-schedule-button:hover {
		transform: translateY(-1px);
		border-color: color-mix(in srgb, var(--task-accent) 32%, var(--surface-border));
		color: var(--color-heading);
	}

	.weekday-schedule-button.is-selected {
		background: color-mix(in srgb, var(--task-accent) 24%, var(--surface-2));
		border-color: color-mix(in srgb, var(--task-accent) 48%, var(--surface-border));
		color: color-mix(in srgb, var(--task-accent) 82%, var(--color-heading));
	}

	.weekday-schedule-button.is-today::after {
		content: '';
		position: absolute;
		right: 0.2rem;
		bottom: 0.18rem;
		width: 0.18rem;
		height: 0.18rem;
		border-radius: 999px;
		background: currentColor;
		opacity: 0.72;
	}

	.weekday-schedule-button:disabled {
		cursor: wait;
		opacity: 0.72;
		transform: none;
	}

	.daymap-lock-button {
		color: var(--color-muted);
	}

	.queue-button span {
		font-size: 0.88rem;
		font-weight: 800;
		line-height: 1;
	}

	.queue-button.is-queued {
		background: color-mix(in srgb, var(--task-accent) 18%, var(--surface-2));
		border-color: color-mix(in srgb, var(--task-accent) 34%, var(--surface-border));
		color: color-mix(in srgb, var(--task-accent) 72%, var(--color-heading));
	}

	.daymap-toggle-button {
		color: color-mix(in srgb, var(--color-theme-2) 74%, var(--color-muted));
	}

	.daymap-toggle-button.is-selected {
		background: color-mix(in srgb, var(--color-theme-2) 18%, var(--surface-2));
		border-color: color-mix(in srgb, var(--color-theme-2) 38%, var(--surface-border));
		color: color-mix(in srgb, var(--color-theme-2) 88%, var(--color-heading));
	}

	.activate-icon-button {
		background: color-mix(in srgb, var(--color-theme-1) 14%, var(--surface-2));
		border-color: color-mix(in srgb, var(--color-theme-1) 30%, var(--surface-border));
		color: color-mix(in srgb, var(--color-theme-1) 86%, var(--color-heading));
		box-shadow:
			var(--surface-shadow),
			0 0 0 1px color-mix(in srgb, var(--color-theme-1) 9%, transparent);
	}

	.daymap-lock-button.is-locked {
		background: color-mix(in srgb, var(--color-warning) 15%, var(--surface-2));
		border-color: color-mix(in srgb, var(--color-warning) 35%, var(--surface-border));
		color: var(--color-warning);
		box-shadow:
			var(--surface-shadow),
			0 0 0 1px color-mix(in srgb, var(--color-warning) 10%, transparent);
	}

	.daymap-lock-button:not(.is-locked) {
		color: var(--color-soft);
	}

	.daymap-lock-button:hover,
	.queue-button:hover,
	.daymap-toggle-button:hover,
	.activate-icon-button:hover {
		transform: translateY(-1px);
		box-shadow: var(--surface-shadow-strong);
	}

	.daymap-lock-button:disabled,
	.queue-button:disabled,
	.daymap-toggle-button:disabled,
	.activate-icon-button:disabled {
		cursor: wait;
		opacity: 0.72;
		transform: none;
	}

	.queue-button__spinner {
		width: 0.92rem;
		height: 0.92rem;
		border: 2px solid var(--surface-border-strong);
		border-top-color: var(--task-accent);
		border-radius: 999px;
		animation: note-spin 0.8s linear infinite;
	}

	.archive-button {
		color: var(--color-muted);
	}

	.archive-button:hover {
		transform: translateY(-1px);
		color: var(--color-danger);
		box-shadow: var(--surface-shadow-strong);
	}

	.archive-button:disabled {
		cursor: wait;
		opacity: 0.72;
		transform: none;
	}

	h2,
	strong,
	p {
		margin: 0;
	}

	h2 {
		font-size: 1.25rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: var(--color-heading);
	}

	.task-card.is-compact h2 {
		font-size: 1.05rem;
		line-height: 1.12;
	}

	.task-card__title-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.85rem;
	}

	.task-card__title-chips {
		margin-top: 0.15rem;
	}

	.runtime-stat {
		background: var(--surface-2);
		border: 1px solid var(--surface-border);
	}

	.task-card__title-chips span {
		padding: 0 0 0.22rem;
		border-bottom: 2px solid var(--surface-border-strong);
		font-size: 0.78rem;
		font-weight: 700;
		color: var(--color-muted);
		line-height: 1.15;
	}

	.task-card.is-compact .task-card__title-chips {
		gap: 0.55rem;
		margin-top: 0.05rem;
	}

	.task-card.is-compact .task-card__title-chips span {
		font-size: 0.68rem;
	}

	.task-card__title-chips span.highlight-chip {
		border-bottom-color: color-mix(in srgb, var(--task-accent) 48%, var(--surface-border));
		color: color-mix(in srgb, var(--task-accent) 68%, var(--color-heading));
	}

	.task-card__timing-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
		align-items: center;
		gap: 0.24rem;
		margin-top: -0.25rem;
		color: var(--color-muted);
	}

	.task-card.is-compact .task-card__timing-row {
		gap: 0.16rem;
		margin-top: -0.12rem;
	}

	.task-card.is-compact .task-card__timing-meta {
		font-size: 0.58rem;
	}

	.task-card__timing-row.is-editing-next-due {
		align-items: start;
	}

	.task-card__timing-meta {
		margin: 0;
		display: inline-flex;
		align-items: center;
		flex-wrap: nowrap;
		gap: 0.18rem;
		width: 100%;
		max-width: 100%;
		min-width: 0;
		padding: 0;
		border: 0;
		background: transparent;
		font-size: clamp(0.6rem, 1.5vw, 0.7rem);
		font-weight: 700;
		letter-spacing: 0.01em;
		color: color-mix(in srgb, var(--timing-accent) 62%, var(--color-muted));
		white-space: nowrap;
	}

	.task-card__timing-arrow {
		width: 0.9rem;
		height: 0.5rem;
		color: color-mix(in srgb, var(--surface-border-strong) 42%, transparent);
		opacity: 0.48;
	}

	.task-card__timing-day {
		flex: 0 0 auto;
		font-weight: 800;
		color: color-mix(in srgb, var(--timing-accent) 86%, var(--color-heading));
	}

	.task-card__timing-date {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.task-card__timing-button {
		appearance: none;
		font-family: inherit;
		text-align: left;
		cursor: pointer;
		border: 0;
		background: transparent;
		transition:
			transform 0.15s ease,
			color 0.15s ease;
	}

	.task-card__timing-button:hover {
		transform: translateY(-1px);
		color: color-mix(in srgb, var(--timing-accent) 82%, var(--color-heading));
	}

	.task-card__timing-button:focus-visible {
		outline: none;
		border-radius: 0.35rem;
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--timing-accent) 18%, transparent);
	}

	.task-card__next-due {
		--timing-accent: var(--color-theme-1);
		justify-content: flex-start;
	}

	.task-card__last-done {
		--timing-accent: var(--color-theme-2);
		justify-content: flex-end;
		text-align: right;
	}

	.task-card__next-due-editor {
		display: grid;
		gap: 0.55rem;
		width: 100%;
		min-width: 0;
		margin: 0;
		padding: 0.72rem;
		border: 1px solid color-mix(in srgb, var(--color-theme-1) 30%, var(--surface-border));
		border-left: 3px solid var(--color-theme-1);
		border-radius: 16px;
		background:
			linear-gradient(
				135deg,
				color-mix(in srgb, var(--color-theme-1) 12%, transparent),
				transparent 64%
			),
			var(--surface-2);
		box-shadow: var(--surface-inset);
	}

	.task-card__next-due-editor label {
		display: grid;
		gap: 0.35rem;
		color: color-mix(in srgb, var(--color-theme-1) 72%, var(--color-heading));
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.task-card__next-due-editor input {
		width: 100%;
		min-height: 2.45rem;
		padding: 0.62rem 0.72rem;
		border: 1px solid color-mix(in srgb, var(--color-theme-1) 24%, var(--field-border));
		border-radius: 12px;
		background: var(--field-bg);
		color: var(--color-heading);
		font: inherit;
		font-size: 0.9rem;
		color-scheme: inherit;
	}

	.task-card__next-due-editor input:focus {
		outline: none;
		border-color: color-mix(in srgb, var(--color-theme-1) 58%, var(--field-border));
		box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-theme-1) 18%, transparent);
	}

	.task-card__next-due-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.task-card__next-due-actions button {
		min-height: 2.2rem;
		padding: 0.48rem 0.75rem;
		border: 1px solid color-mix(in srgb, var(--color-theme-1) 24%, var(--surface-border));
		border-radius: 999px;
		background: color-mix(in srgb, var(--color-theme-1) 12%, var(--surface-2));
		color: color-mix(in srgb, var(--color-theme-1) 78%, var(--color-heading));
		font-size: 0.74rem;
		font-weight: 800;
		cursor: pointer;
	}

	.task-card__next-due-actions button[type='submit'] {
		background: var(--accent-gradient);
		border-color: color-mix(in srgb, var(--color-theme-1) 48%, var(--surface-border));
		color: var(--color-accent-contrast);
	}

	.task-card__next-due-actions button:disabled {
		cursor: wait;
		opacity: 0.7;
	}

	.task-card__next-due-error {
		color: var(--color-danger);
		font-size: 0.78rem;
		font-weight: 700;
	}

	.task-card__note-block {
		padding: 0.9rem 1rem;
		margin-left: 0.35rem;
		border-left: 3px solid color-mix(in srgb, var(--task-accent) 38%, var(--surface-border));
		border-radius: 0 14px 14px 0;
		background:
			linear-gradient(
				180deg,
				var(--surface-2),
				color-mix(in srgb, var(--surface-1) 88%, transparent)
			),
			var(--surface-1);
		box-shadow: var(--surface-inset);
	}

	.task-card.is-compact .task-card__note-block {
		padding: 0.64rem 0.74rem;
		margin-left: 0.22rem;
		border-radius: 0 12px 12px 0;
	}

	.task-card.is-compact .task-card__note-header {
		margin-bottom: 0.24rem;
	}

	.task-card.is-compact .task-card__note-label {
		font-size: 0.62rem;
		letter-spacing: 0.07em;
	}

	.task-card__note-block-instance {
		background:
			linear-gradient(
				180deg,
				color-mix(in srgb, var(--color-warning) 8%, var(--surface-2)),
				var(--surface-1)
			),
			var(--surface-1);
		border-left-color: color-mix(in srgb, var(--task-accent) 24%, var(--color-warning));
	}

	.task-card__note-label {
		display: inline-block;
		font-family:
			'IBM Plex Mono', 'SFMono-Regular', 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-soft);
	}

	.task-card__note-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 0.4rem;
	}

	.task-card__note-status {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1rem;
		min-height: 1rem;
	}

	.task-card__note {
		color: var(--color-muted);
		line-height: 1.5;
		white-space: pre-wrap;
	}

	.task-card__note-input {
		display: block;
		width: 100%;
		box-sizing: border-box;
		padding: 0;
		border: 0;
		background: transparent;
		resize: vertical;
		font: inherit;
		line-height: 1.5;
		color: var(--color-muted);
	}

	.task-card.is-compact .task-card__note,
	.task-card.is-compact .task-card__note-input {
		font-size: 0.88rem;
		line-height: 1.36;
	}

	.task-card__note-input::placeholder {
		color: var(--color-soft);
	}

	.task-card__note-input:focus {
		outline: none;
	}

	.task-card__note-error {
		margin-top: 0.45rem;
		font-size: 0.82rem;
		color: var(--color-danger);
	}

	.note-spinner,
	.note-check,
	.note-error {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1rem;
		height: 1rem;
		border-radius: 999px;
		font-size: 0.72rem;
		font-weight: 800;
	}

	.note-spinner {
		border: 2px solid color-mix(in srgb, var(--color-accent) 18%, transparent);
		border-top-color: var(--task-accent);
		animation: note-spin 0.8s linear infinite;
	}

	.note-check {
		background: color-mix(in srgb, var(--color-success) 14%, transparent);
		color: var(--color-success);
	}

	.note-error {
		background: color-mix(in srgb, var(--color-danger) 12%, transparent);
		color: var(--color-danger);
	}

	.task-card__runtime {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.8rem;
	}

	.runtime-stat {
		padding: 0.9rem 1rem;
		border-radius: 16px;
	}

	.runtime-stat span {
		display: block;
		margin-bottom: 0.35rem;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-soft);
	}

	.runtime-stat strong {
		font-size: 1rem;
		color: var(--color-heading);
	}

	.task-card__panic-duration {
		margin: -0.45rem 0 0;
		padding: 0 0.2rem;
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		color: var(--color-warning);
	}

	.task-card__effective-duration {
		margin: -0.6rem 0 0;
		padding: 0 0.2rem;
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		color: var(--color-success);
	}

	.task-card__panic-log {
		display: grid;
		gap: 0.65rem;
		margin-top: -0.1rem;
	}

	.task-card__panic-log-header span {
		display: inline-flex;
		align-items: center;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-soft);
	}

	.task-card__panic-log-list {
		display: grid;
		gap: 0.65rem;
	}

	.task-card__panic-item {
		display: grid;
		gap: 0.35rem;
		padding: 0.9rem 0.95rem;
		border-radius: 16px;
		background:
			linear-gradient(
				180deg,
				color-mix(in srgb, var(--color-warning) 9%, var(--surface-2)),
				color-mix(in srgb, var(--color-danger) 7%, var(--surface-1))
			),
			var(--surface-1);
		border: 1px solid color-mix(in srgb, var(--color-danger) 16%, var(--surface-border));
	}

	.task-card__panic-item-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.task-card__panic-item-top strong {
		font-size: 0.88rem;
		color: var(--color-heading);
	}

	.task-card__panic-item-top span {
		font-size: 0.82rem;
		font-weight: 700;
		color: var(--color-warning);
	}

	.task-card__panic-charge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: fit-content;
		margin: 0;
		padding: 0.35rem 0.6rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--color-danger) 12%, transparent);
		color: var(--color-warning);
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.task-card__panic-note {
		margin: 0;
		color: var(--color-muted);
		white-space: pre-wrap;
	}

	.tally-panel {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.75rem;
		padding: 0.9rem 1rem;
		border-radius: 18px;
		background:
			linear-gradient(
				180deg,
				var(--surface-2),
				color-mix(in srgb, var(--surface-1) 90%, transparent)
			),
			var(--surface-1);
		border: 1px solid var(--surface-border);
	}

	.tally-readout {
		display: grid;
		gap: 0.2rem;
		text-align: center;
	}

	.tally-readout span {
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-soft);
	}

	.tally-readout strong {
		font-size: 1.05rem;
		color: var(--color-heading);
	}

	.tally-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 3rem;
		min-height: 3rem;
		padding: 0;
		border: 0;
		border-radius: 14px;
		font-size: 1.2rem;
		font-weight: 800;
		cursor: pointer;
		transition:
			transform 0.15s ease,
			box-shadow 0.15s ease,
			filter 0.15s ease;
	}

	.tally-button:hover {
		transform: translateY(-1px);
	}

	.tally-button:disabled {
		cursor: wait;
		opacity: 0.7;
		transform: none;
	}

	.tally-button-plus {
		background: linear-gradient(
			135deg,
			var(--color-success),
			color-mix(in srgb, var(--color-success) 72%, var(--color-accent-contrast))
		);
		color: var(--color-accent-contrast);
		box-shadow: 0 12px 24px color-mix(in srgb, var(--color-success) 22%, transparent);
	}

	.tally-button-minus {
		background: var(--surface-muted);
		color: var(--color-muted);
		border: 1px solid var(--surface-border-strong);
	}

	.task-card__actions {
		display: grid;
		gap: 0.7rem;
	}

	.split-actions {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.action-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		min-height: 3.2rem;
		padding: 0.9rem 1rem;
		border: 0;
		border-radius: 14px;
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		cursor: pointer;
		transition:
			transform 0.15s ease,
			box-shadow 0.15s ease,
			filter 0.15s ease;
	}

	.action-button:hover {
		transform: translateY(-1px);
	}

	.action-button:disabled {
		cursor: wait;
		opacity: 0.74;
		transform: none;
	}

	.success-button {
		background: linear-gradient(
			135deg,
			var(--color-success),
			color-mix(in srgb, var(--color-success) 72%, var(--color-accent-contrast))
		);
		color: var(--color-accent-contrast);
		box-shadow: 0 12px 24px color-mix(in srgb, var(--color-success) 22%, transparent);
	}

	.subtle-button {
		background: var(--surface-muted);
		color: var(--color-muted);
		border: 1px solid var(--surface-border-strong);
	}

	@keyframes note-spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (max-width: 640px) {
		.task-card__header {
			flex-direction: column;
		}

		.task-card__runtime,
		.split-actions {
			grid-template-columns: 1fr;
		}

		.tally-panel {
			grid-template-columns: 1fr;
		}
	}
</style>
