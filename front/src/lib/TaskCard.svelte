<script>
	import { onDestroy } from 'svelte';

	import {
		formatElapsedDuration,
		formatMinutes,
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
	const lastDoneDateFormatter = new Intl.DateTimeFormat(undefined, {
		month: 'long',
		day: 'numeric',
		year: '2-digit'
	});
	const lastDoneTimeFormatter = new Intl.DateTimeFormat(undefined, {
		hour: 'numeric',
		minute: '2-digit'
	});

	let {
		task,
		variant = 'inactive',
		editableTaskId = null,
		clickActionLabel = 'Activate',
		activeDurationLabel = '',
		alarmLabel = '',
		panicDurationLabel = '',
		effectiveDurationLabel = '',
		doneDurationLabel = '',
		doneTallyCount = null,
		completedAtLabel = '',
		ringing = false,
		busyAction = null,
		onSaveNote = null,
		onSaveInstanceNote = null,
		showArchiveButton = false,
		onActivate = () => {},
		onArchive = () => {},
		onToggleDaymapLock = () => {},
		onQueueToggle = () => {},
		onTally = () => {},
		onUnmap = () => {},
		onInactivate = () => {},
		onDone = () => {},
		onSnooze = () => {}
	} = $props();

	const isTallyTask = $derived(task.trackingType === 'tally');
	const hasAlarm = $derived(
		task.trackingType !== 'tally' && task.alarmEnabled && task.durationMinutes && task.snoozeMinutes
	);
	const isInactiveCard = $derived(variant === 'inactive');
	const isDaymapCard = $derived(variant === 'daymap');
	const isQueuedDaymapTask = $derived(isDaymapCard && Number.isInteger(task.queuePosition) && task.queuePosition > 0);
	const showsDaymapLock = $derived(isDaymapCard && task.mode === 'repeatable');
	const showsRuntime = $derived(variant === 'active' || variant === 'done');
	const showsActions = $derived(variant === 'active' || variant === 'daymap');
	const canEditNote = $derived(Boolean(editableTaskId && onSaveNote));
	const canEditInstanceNote = $derived(variant === 'active' && Boolean(editableTaskId && onSaveInstanceNote));
	const showsLastDone = $derived(Boolean(task.lastCompletedAt));
	const showsInstanceNote = $derived(Boolean(task.instanceNote) || canEditInstanceNote);
	const taskPanicLog = $derived(Array.isArray(task.taskPanicLog) ? task.taskPanicLog : []);
	const showsTaskPanicLog = $derived(taskPanicLog.length > 0);
	const tallyUnitLabel = $derived(task.tallyUnit || 'units');
	const activeTallyCountValue = $derived(Number.isInteger(task.activeTallyCount) ? task.activeTallyCount : 0);
	const resolvedDoneTallyCount = $derived(
		Number.isInteger(doneTallyCount)
			? doneTallyCount
			: Number.isInteger(task.lastCompletedTallyCount)
				? task.lastCompletedTallyCount
				: 0
	);
	const visibleTitleChips = $derived([
		variant === 'done' ? 'Completed' : null,
		task.mode === 'one-time' ? formatTaskMode(task.mode) : null,
		task.trackingType === 'tally' ? formatTaskTrackingType(task.trackingType) : null,
		hasAlarm ? 'Alarm on' : null,
		hasAlarm ? formatMinutes(task.durationMinutes) : null,
		hasAlarm ? `Snooze ${formatMinutes(task.snoozeMinutes)}` : null
	].filter(Boolean));

	let draftNote = $state('');
	let lastCommittedNote = $state('');
	let noteSaveStatus = $state('idle');
	let noteSaveError = $state('');
	let draftInstanceNote = $state('');
	let lastCommittedInstanceNote = $state('');
	let instanceNoteSaveStatus = $state('idle');
	let instanceNoteSaveError = $state('');

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

	function handleInactiveActivate() {
		if (!isInactiveCard || busyAction !== null) {
			return;
		}

		onActivate(task.id);
	}

	function handleInactiveKeydown(event) {
		if (!isInactiveCard || busyAction !== null) {
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
		const date = new Date(value);
		const dateLabel = lastDoneDateFormatter.format(date);
		const timeLabel = lastDoneTimeFormatter.format(date).replace(' AM', 'am').replace(' PM', 'pm');

		return `${dateLabel} @ ${timeLabel}`;
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
	style={`--task-accent: ${task.color};`}
	role={isInactiveCard ? 'button' : undefined}
	tabindex={isInactiveCard ? 0 : undefined}
	aria-label={isInactiveCard ? `${clickActionLabel} ${task.name}` : undefined}
	aria-disabled={isInactiveCard ? busyAction !== null : undefined}
	onclick={isInactiveCard ? handleInactiveActivate : undefined}
	onkeydown={isInactiveCard ? handleInactiveKeydown : undefined}
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
			{#if showsDaymapLock}
				<button
					class="daymap-lock-button"
					class:is-locked={task.daymapLocked}
					type="button"
					aria-label={
						task.daymapLocked
							? `Unlock ${task.name} from looping back to daymap`
							: `Lock ${task.name} to loop back to daymap`
					}
					title={
						task.daymapLocked
							? 'Locked to return to daymap after done'
							: 'Return to inactive after done'
					}
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
					class="queue-button"
					class:is-queued={isQueuedDaymapTask}
					type="button"
					aria-label={
						isQueuedDaymapTask
							? `Remove ${task.name} from the queue`
							: `Add ${task.name} to the queue`
					}
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

			{#if showArchiveButton}
				<button
					class="archive-button"
					type="button"
					aria-label={`Archive ${task.name}`}
					title="Archive task"
					disabled={busyAction !== null}
					onpointerdown={stopEventPropagation}
					onclick={handleArchiveClick}
					onkeydown={stopEventPropagation}
				>
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
				</button>
			{/if}
		</div>
	</div>

	{#if showsLastDone}
		<p class="task-card__last-done">Last done: {formatLastDone(task.lastCompletedAt)}</p>
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
					rows="3"
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
					rows="3"
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
						<strong>{formatTallyProgress(activeTallyCountValue, task.tallyTarget, tallyUnitLabel)}</strong>
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
					<span>{variant === 'done' ? 'Completed' : 'Alarm'}</span>
					<strong>{variant === 'done' ? completedAtLabel : alarmLabel || 'Off'}</strong>
				</div>
			</div>

			{#if variant === 'active' && hasAlarm && ringing}
				<div class="alarm-panel">
					<div>
						<strong>Alarm ringing</strong>
						<p>This task has hit its timer and will keep sounding until you snooze it.</p>
					</div>
					<button
						class="action-button warm-button"
						type="button"
						disabled={busyAction !== null}
						onclick={() => onSnooze(task.id)}
					>
						{busyAction === 'snooze' ? 'Snoozing...' : `Snooze ${formatMinutes(task.snoozeMinutes)}`}
					</button>
				</div>
			{/if}
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
							instanceNote: canEditInstanceNote ? draftInstanceNote : task.instanceNote ?? ''
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
			linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(248, 251, 255, 0.88)),
			linear-gradient(135deg, color-mix(in srgb, var(--task-accent) 14%, white), white 65%);
		border: 1px solid color-mix(in srgb, var(--task-accent) 22%, white);
		box-shadow:
			0 18px 40px rgba(44, 62, 80, 0.1),
			inset 0 1px 0 rgba(255, 255, 255, 0.75);
		position: relative;
		overflow: hidden;
	}

	.task-card.is-inactive {
		border-width: 2px;
		border-color: color-mix(in srgb, var(--task-accent) 58%, white);
		box-shadow:
			0 20px 42px rgba(44, 62, 80, 0.11),
			0 0 0 1px color-mix(in srgb, var(--task-accent) 16%, white),
			inset 0 1px 0 rgba(255, 255, 255, 0.75);
		cursor: pointer;
		transition:
			transform 0.16s ease,
			box-shadow 0.16s ease,
			border-color 0.16s ease;
	}

	.task-card.is-inactive:hover {
		transform: translateY(-2px);
		border-color: color-mix(in srgb, var(--task-accent) 82%, white);
		box-shadow:
			0 24px 48px rgba(44, 62, 80, 0.14),
			0 0 0 1px color-mix(in srgb, var(--task-accent) 22%, white),
			inset 0 1px 0 rgba(255, 255, 255, 0.82);
	}

	.task-card.is-inactive:focus-visible {
		outline: none;
		box-shadow:
			0 0 0 4px color-mix(in srgb, var(--task-accent) 24%, white),
			0 24px 48px rgba(44, 62, 80, 0.16),
			inset 0 1px 0 rgba(255, 255, 255, 0.82);
	}

	.task-card.is-inactive.is-busy {
		cursor: wait;
		transform: none;
	}

	.task-card::before {
		content: '';
		position: absolute;
		inset: 0 auto 0 0;
		width: 0.38rem;
		background: linear-gradient(180deg, var(--task-accent), color-mix(in srgb, var(--task-accent) 55%, white));
	}

	.task-card.is-active {
		box-shadow:
			0 22px 44px rgba(44, 62, 80, 0.14),
			0 0 0 1px color-mix(in srgb, var(--task-accent) 20%, white);
	}

	.task-card__header,
	.alarm-panel {
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
		gap: 0.7rem;
		flex: 0 0 auto;
	}

	.task-card__title-block {
		display: grid;
		gap: 0.25rem;
		min-width: 0;
	}

	.queue-button,
	.daymap-lock-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: 0 0 auto;
		width: 2.35rem;
		height: 2.35rem;
		padding: 0;
		border: 1px solid rgba(20, 28, 38, 0.1);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.92);
		box-shadow: 0 10px 22px rgba(44, 62, 80, 0.08);
		cursor: pointer;
		transition:
			transform 0.15s ease,
			box-shadow 0.15s ease,
			color 0.15s ease,
			background 0.15s ease,
			border-color 0.15s ease;
	}

	.daymap-lock-button {
		color: rgba(20, 28, 38, 0.58);
	}

	.queue-button span {
		font-size: 0.88rem;
		font-weight: 800;
		line-height: 1;
	}

	.queue-button.is-queued {
		background: color-mix(in srgb, var(--task-accent) 18%, white);
		border-color: color-mix(in srgb, var(--task-accent) 34%, white);
		color: color-mix(in srgb, var(--task-accent) 68%, black);
	}

	.daymap-lock-button svg {
		width: 1rem;
		height: 1rem;
	}

	.daymap-lock-button.is-locked {
		background: linear-gradient(180deg, rgba(255, 251, 236, 0.98), rgba(255, 246, 214, 0.95));
		border-color: rgba(200, 155, 43, 0.35);
		color: #c89b2b;
		box-shadow:
			0 12px 24px rgba(44, 62, 80, 0.1),
			0 0 0 1px rgba(200, 155, 43, 0.08);
	}

	.daymap-lock-button:not(.is-locked) {
		color: rgba(20, 28, 38, 0.34);
	}

	.daymap-lock-button:hover,
	.queue-button:hover {
		transform: translateY(-1px);
		box-shadow: 0 12px 24px rgba(44, 62, 80, 0.12);
	}

	.daymap-lock-button:disabled,
	.queue-button:disabled {
		cursor: wait;
		opacity: 0.72;
		transform: none;
	}

	.queue-button__spinner {
		width: 0.92rem;
		height: 0.92rem;
		border: 2px solid rgba(20, 28, 38, 0.16);
		border-top-color: var(--task-accent);
		border-radius: 999px;
		animation: note-spin 0.8s linear infinite;
	}

	.archive-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.3rem;
		height: 2.3rem;
		padding: 0;
		border: 1px solid rgba(20, 28, 38, 0.08);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.92);
		color: rgba(20, 28, 38, 0.56);
		box-shadow: 0 10px 22px rgba(44, 62, 80, 0.08);
		cursor: pointer;
		transition:
			transform 0.15s ease,
			color 0.15s ease,
			box-shadow 0.15s ease;
	}

	.archive-button svg {
		width: 1rem;
		height: 1rem;
	}

	.archive-button:hover {
		transform: translateY(-1px);
		color: #9f2d27;
		box-shadow: 0 12px 24px rgba(44, 62, 80, 0.12);
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
		color: rgba(13, 24, 36, 0.92);
	}

	.task-card__title-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.85rem;
	}

	.task-card__title-chips {
		margin-top: 0.15rem;
	}

	.runtime-stat,
	.alarm-panel {
		background: rgba(255, 255, 255, 0.88);
		border: 1px solid rgba(20, 28, 38, 0.08);
	}

	.task-card__title-chips span {
		padding: 0 0 0.22rem;
		border-bottom: 2px solid rgba(20, 28, 38, 0.14);
		font-size: 0.78rem;
		font-weight: 700;
		color: rgba(20, 28, 38, 0.72);
		line-height: 1.15;
	}

	.task-card__title-chips span.highlight-chip {
		border-bottom-color: color-mix(in srgb, var(--task-accent) 48%, white);
		color: color-mix(in srgb, var(--task-accent) 65%, black);
	}

	.task-card__last-done {
		margin: -0.2rem 0 0;
		padding-left: 0.55rem;
		font-size: 0.78rem;
		font-weight: 500;
		letter-spacing: 0.01em;
		color: rgba(20, 28, 38, 0.34);
	}

	.task-card__note-block {
		padding: 0.9rem 1rem;
		margin-left: 0.35rem;
		border-left: 3px solid color-mix(in srgb, var(--task-accent) 38%, white);
		border-radius: 0 14px 14px 0;
		background:
			linear-gradient(180deg, rgba(248, 250, 252, 0.98), rgba(243, 247, 251, 0.96)),
			rgba(255, 255, 255, 0.88);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
	}

	.task-card__note-block-instance {
		background:
			linear-gradient(180deg, rgba(251, 249, 246, 0.98), rgba(247, 243, 238, 0.96)),
			rgba(255, 255, 255, 0.88);
		border-left-color: color-mix(in srgb, var(--task-accent) 24%, #dba86c);
	}

	.task-card__note-label {
		display: inline-block;
		font-family: 'IBM Plex Mono', 'SFMono-Regular', 'SF Mono', Consolas, 'Liberation Mono',
			Menlo, monospace;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(20, 28, 38, 0.48);
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
		color: rgba(20, 28, 38, 0.72);
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
		color: rgba(20, 28, 38, 0.72);
	}

	.task-card__note-input::placeholder {
		color: rgba(20, 28, 38, 0.42);
	}

	.task-card__note-input:focus {
		outline: none;
	}

	.task-card__note-error {
		margin-top: 0.45rem;
		font-size: 0.82rem;
		color: #9f2d27;
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
		border: 2px solid rgba(79, 110, 214, 0.18);
		border-top-color: var(--task-accent);
		animation: note-spin 0.8s linear infinite;
	}

	.note-check {
		background: rgba(75, 159, 103, 0.14);
		color: #2f8a4f;
	}

	.note-error {
		background: rgba(159, 45, 39, 0.12);
		color: #9f2d27;
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
		color: rgba(20, 28, 38, 0.46);
	}

	.runtime-stat strong {
		font-size: 1rem;
		color: rgba(20, 28, 38, 0.84);
	}

	.task-card__panic-duration {
		margin: -0.45rem 0 0;
		padding: 0 0.2rem;
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		color: rgba(176, 79, 22, 0.82);
	}

	.task-card__effective-duration {
		margin: -0.6rem 0 0;
		padding: 0 0.2rem;
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		color: rgba(45, 112, 86, 0.84);
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
		color: rgba(20, 28, 38, 0.48);
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
			linear-gradient(180deg, rgba(255, 249, 245, 0.96), rgba(255, 243, 238, 0.94)),
			linear-gradient(135deg, rgba(255, 159, 63, 0.14), rgba(242, 72, 57, 0.1));
		border: 1px solid rgba(242, 72, 57, 0.16);
	}

	.task-card__panic-item-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.task-card__panic-item-top strong {
		font-size: 0.88rem;
		color: rgba(20, 28, 38, 0.82);
	}

	.task-card__panic-item-top span {
		font-size: 0.82rem;
		font-weight: 700;
		color: rgba(163, 62, 20, 0.82);
	}

	.task-card__panic-charge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: fit-content;
		margin: 0;
		padding: 0.35rem 0.6rem;
		border-radius: 999px;
		background: rgba(242, 72, 57, 0.12);
		color: #a33e14;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.task-card__panic-note {
		margin: 0;
		color: rgba(20, 28, 38, 0.76);
		white-space: pre-wrap;
	}

	.alarm-panel {
		padding: 0.95rem 1rem;
		border-radius: 18px;
		background:
			linear-gradient(180deg, rgba(255, 247, 236, 0.98), rgba(255, 251, 245, 0.95)),
			rgba(255, 255, 255, 0.88);
		border-color: rgba(191, 121, 31, 0.16);
	}

	.alarm-panel strong {
		display: block;
		margin-bottom: 0.25rem;
		color: #9a5e12;
	}

	.alarm-panel p {
		font-size: 0.88rem;
		color: rgba(20, 28, 38, 0.66);
	}

	.tally-panel {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.75rem;
		padding: 0.9rem 1rem;
		border-radius: 18px;
		background:
			linear-gradient(180deg, rgba(248, 250, 252, 0.98), rgba(243, 247, 251, 0.96)),
			rgba(255, 255, 255, 0.88);
		border: 1px solid rgba(20, 28, 38, 0.08);
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
		color: rgba(20, 28, 38, 0.46);
	}

	.tally-readout strong {
		font-size: 1.05rem;
		color: rgba(20, 28, 38, 0.84);
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
		background: linear-gradient(135deg, #4b9f67, #6cbc83);
		color: white;
		box-shadow: 0 12px 24px rgba(75, 159, 103, 0.2);
	}

	.tally-button-minus {
		background: rgba(20, 28, 38, 0.08);
		color: rgba(20, 28, 38, 0.76);
		border: 1px solid rgba(20, 28, 38, 0.08);
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
		background: linear-gradient(135deg, #4b9f67, #6cbc83);
		color: white;
		box-shadow: 0 12px 24px rgba(75, 159, 103, 0.2);
	}

	.subtle-button {
		background: rgba(20, 28, 38, 0.08);
		color: rgba(20, 28, 38, 0.76);
		border: 1px solid rgba(20, 28, 38, 0.08);
	}

	.warm-button {
		background: linear-gradient(135deg, #c97b22, #e3a04f);
		color: white;
		box-shadow: 0 12px 24px rgba(201, 123, 34, 0.2);
	}

	@keyframes note-spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (max-width: 640px) {
		.task-card__header,
		.alarm-panel {
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
