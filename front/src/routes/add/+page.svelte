<script>
	import { readApiBody, readApiError } from '$lib/api';
	import {
		formatPomodoroCadence,
		formatPomodoroLongBreak,
		getPomodoroPresetOption,
		NO_POMODORO_PRESET_KEY,
		POMODORO_PRESET_OPTIONS
	} from '$lib/pomodoro';
	import { authorizedRequest } from '$lib/session';

	const taskColors = [
		{
			value: 'red',
			hex: '#c74a4a',
			label: 'Red',
			category: 'System',
			description:
				'The stuff that keeps life from drifting off the rails: bills, forms, insurance, lease, car upkeep, scheduling, paperwork, email, and account fixes.'
		},
		{
			value: 'orange',
			hex: '#de7d37',
			label: 'Orange',
			category: 'World',
			description:
				'Outside-the-house motion: errands, pickups, shopping, pharmacy, post office, appointments, and travel across town.'
		},
		{
			value: 'gold',
			hex: '#d7b23d',
			label: 'Yellow',
			category: 'Home',
			description:
				'Physical upkeep of your space: dishes, laundry, trash, sweeping, kitchen reset, organizing, and apartment care.'
		},
		{
			value: 'green',
			hex: '#5f9b55',
			label: 'Green',
			category: 'Body',
			description:
				'Care of the organism: meals, hydration, hormones or meds, sleep support, shower, stretching, walks, and health appointments.'
		},
		{
			value: 'teal',
			hex: '#3d9790',
			label: 'Teal',
			category: 'Reset',
			description:
				'Recovery and nervous-system maintenance: bath, tidy reset, journaling, room calming, digital cleanup, and getting back online after fog or overwhelm.'
		},
		{
			value: 'blue',
			hex: '#4f6ed6',
			label: 'Blue',
			category: 'Craft',
			description:
				'Focused building and learning: coding, automation study, SLCC work, reading docs, writing, debugging, systems design, and skill-forging.'
		},
		{
			value: 'violet',
			hex: '#8a5bd1',
			label: 'Purple',
			category: 'Becoming',
			description:
				'Vision, planning, and deeper arc work: daymaps, long-term goals, HW autobahn thinking, identity design, personal philosophy, dream notes, and future-self architecture.'
		}
	];

	let taskName = $state('');
	let selectedColor = $state(taskColors[0].value);
	let taskMode = $state('repeatable');
	let trackingType = $state('time');
	let selectedPomodoroPreset = $state('medium');
	let tallyUnit = $state('');
	let tallyTarget = $state('10');
	let note = $state('');
	let isSubmitting = $state(false);
	let successMessage = $state('');
	let errorMessage = $state('');
	const selectedColorMeta = $derived(
		taskColors.find((color) => color.value === selectedColor) ?? taskColors[0]
	);
	const selectedPomodoroMeta = $derived(getPomodoroPresetOption(selectedPomodoroPreset));

	function resetForm() {
		taskName = '';
		selectedColor = taskColors[0].value;
		taskMode = 'repeatable';
		trackingType = 'time';
		selectedPomodoroPreset = 'medium';
		tallyUnit = '';
		tallyTarget = '10';
		note = '';
	}

	async function handleSubmit(event) {
		event.preventDefault();
		successMessage = '';
		errorMessage = '';
		isSubmitting = true;

		try {
			const response = await authorizedRequest('/tasks', {
				method: 'POST',
				body: {
					name: taskName,
					color: selectedColor,
					mode: taskMode,
					trackingType,
					pomodoroPreset:
						trackingType === 'time'
							? selectedPomodoroPreset === NO_POMODORO_PRESET_KEY
								? null
								: selectedPomodoroPreset
							: null,
					tallyUnit: trackingType === 'tally' ? tallyUnit : null,
					tallyTarget:
						trackingType === 'tally' ? Number.parseInt(tallyTarget, 10) || null : null,
					note: note.trim() ? note : null
				}
			});

			if (!response.ok) {
				throw new Error(await readApiError(response, 'Unable to save the task.'));
			}

			const body = await readApiBody(response);
			successMessage = `Saved "${body.task.name}" to your task list.`;
			resetForm();
		} catch (error) {
			errorMessage = error.message;
		} finally {
			isSubmitting = false;
		}
	}
</script>

<svelte:head>
	<title>Add Task</title>
	<meta name="description" content="Add a task" />
</svelte:head>

<div class="text-column">
	<div class="paper">
		<form class="task-form" onsubmit={handleSubmit}>
			<label class="field-label" for="task-name">Name that task</label>
			<input
				id="task-name"
				bind:value={taskName}
				class="text-input"
				type="text"
				name="name"
				placeholder="Wash dishes"
				maxlength="120"
				required
			/>

				<fieldset class="color-picker">
					<legend class="field-label">Task color</legend>
					<div class="color-options">
						{#each taskColors as color}
							<label class="color-option" style={`--swatch-color: ${color.hex};`}>
								<input type="radio" name="color" value={color.value} bind:group={selectedColor} />
								<span class="color-choice">
									<span class="swatch" aria-hidden="true"></span>
									<span class="color-caption">{color.category}</span>
								</span>
								<span class="visually-hidden">{color.label} for {color.category} tasks</span>
							</label>
						{/each}
					</div>
					<div class="color-helper" style={`--selected-color: ${selectedColorMeta.hex};`}>
						<p class="color-helper__title">
							<span class="color-helper__dot" aria-hidden="true"></span>
							<strong>{selectedColorMeta.category}</strong>
						</p>
						<p class="color-helper__description">{selectedColorMeta.description}</p>
					</div>
				</fieldset>

			<fieldset class="task-mode">
				<legend class="field-label">Task type</legend>
				<div class="mode-slider">
					<input
						id="task-type-once"
						class="mode-input"
						type="radio"
						name="taskType"
						value="one-time"
						bind:group={taskMode}
					/>
					<input
						id="task-type-repeatable"
						class="mode-input"
						type="radio"
						name="taskType"
						value="repeatable"
						bind:group={taskMode}
					/>
					<span class="mode-indicator" aria-hidden="true"></span>
					<label class="mode-option mode-option-once" for="task-type-once">One-time task</label>
					<label class="mode-option mode-option-repeatable" for="task-type-repeatable"
						>Repeatable task</label
					>
				</div>
			</fieldset>

			<fieldset class="task-mode">
				<legend class="field-label">How it tracks</legend>
				<div class="mode-slider">
					<input
						id="tracking-time"
						class="mode-input"
						type="radio"
						name="trackingType"
						value="time"
						bind:group={trackingType}
					/>
					<input
						id="tracking-tally"
						class="mode-input"
						type="radio"
						name="trackingType"
						value="tally"
						bind:group={trackingType}
					/>
					<span class="mode-indicator" aria-hidden="true"></span>
					<label class="mode-option mode-option-once" for="tracking-time">Clock time</label>
					<label class="mode-option mode-option-repeatable" for="tracking-tally">Tallies</label>
				</div>
			</fieldset>

			{#if trackingType === 'time'}
				<fieldset class="pomodoro-picker">
					<legend class="field-label">Pomodoro cadence</legend>

					<div class="pomodoro-options">
						{#each POMODORO_PRESET_OPTIONS as option}
							<label class="pomodoro-option">
								<input
									type="radio"
									name="pomodoroPreset"
									value={option.presetKey}
									bind:group={selectedPomodoroPreset}
								/>

								<span class="pomodoro-card">
									<span class="pomodoro-card__icon" aria-hidden="true">
										{#if option.presetKey === NO_POMODORO_PRESET_KEY}
											<svg viewBox="0 0 48 48" fill="none" role="presentation">
												<circle cx="24" cy="24" r="17" fill="#e8edf5" stroke="#8ba0b9" stroke-width="2" />
												<path d="M16 32 32 16" stroke="#8ba0b9" stroke-width="2.5" stroke-linecap="round" />
											</svg>
										{:else}
											<svg viewBox="0 0 48 48" fill="none" role="presentation">
												<path
													d="M20 9c0-3.3 2.7-6 6-6 2.9 0 5.2 2 5.8 4.7-.8-.3-1.6-.4-2.5-.4-3.4 0-6.7 1.5-9.3 4.1V9Z"
													fill="#5a9d5d"
												/>
												<path
													d="M31.5 8.7c2.6-2.2 6.3-2.3 9.1-.3-2.1 1.6-4.1 3.2-6.6 3.6-1 .2-1.9.2-2.8 0 .1-1.2.1-2.3.3-3.3Z"
													fill="#7dbb77"
												/>
												<path
													d="M24 14c10.8 0 19 7.1 19 16.4C43 39.3 35 45 24 45S5 39.3 5 30.4C5 21.1 13.2 14 24 14Z"
													fill="#e55243"
												/>
												<path
													d="M24 19c3.9 0 6.8 1.4 8.5 2.7-1.4-3.8-4.6-6.1-8.5-6.1-4 0-7.2 2.3-8.6 6.1C17.1 20.4 20 19 24 19Z"
													fill="#f17b66"
												/>
											</svg>
										{/if}
									</span>

									<span class="pomodoro-card__topline">
										<strong>{option.label}</strong>
										<span>{option.tagline}</span>
									</span>

									<span class="pomodoro-card__cadence">
										{#if option.presetKey === NO_POMODORO_PRESET_KEY}
											No focus/break cycle
										{:else}
											{option.focusMinutes}m focus / {option.shortBreakMinutes}m break
										{/if}
									</span>

									<span class="pomodoro-card__meta">
										{#if option.presetKey === NO_POMODORO_PRESET_KEY}
											Still tracks active time, notes, panic overlap, and done history
										{:else}
											{option.longBreakMinutes}m long break after {option.longBreakInterval} focus blocks
										{/if}
									</span>

									<span class="pomodoro-card__description">{option.description}</span>
								</span>
							</label>
						{/each}
					</div>

					<div class="pomodoro-helper">
						<p class="pomodoro-helper__eyebrow">Selected rhythm</p>
						<h2>{selectedPomodoroMeta.label} lantern</h2>
						{#if selectedPomodoroPreset === NO_POMODORO_PRESET_KEY}
							<p class="pomodoro-helper__lede">
								This task will still record active time, notes, panic overlap, and done history, but
								it will not run a focus/break cadence or ring break bells.
							</p>
						{:else}
							<p class="pomodoro-helper__lede">
								{selectedPomodoroMeta.focusMinutes} minutes on, {selectedPomodoroMeta.shortBreakMinutes}
								minutes off, then a {selectedPomodoroMeta.longBreakMinutes}-minute long break every
								{selectedPomodoroMeta.longBreakInterval} focus blocks.
							</p>
						{/if}
						{#if selectedPomodoroPreset === NO_POMODORO_PRESET_KEY}
							<p class="pomodoro-helper__meta">{formatPomodoroLongBreak(selectedPomodoroMeta)}.</p>
						{:else}
							<p class="pomodoro-helper__meta">
								{formatPomodoroCadence(selectedPomodoroMeta)} cadence. {formatPomodoroLongBreak(
									selectedPomodoroMeta
								)}.
							</p>
						{/if}
					</div>
				</fieldset>
			{:else}
				<div class="tally-fields">
					<label class="field-label" for="task-tally-unit">Tally unit</label>
					<input
						id="task-tally-unit"
						bind:value={tallyUnit}
						class="text-input"
						type="text"
						name="tallyUnit"
						placeholder="squats"
						maxlength="60"
						required={trackingType === 'tally'}
					/>

					<label class="field-label" for="task-tally-target">Target amount</label>
					<input
						id="task-tally-target"
						bind:value={tallyTarget}
						class="text-input"
						type="number"
						name="tallyTarget"
						min="1"
						max="100000"
						step="1"
						required={trackingType === 'tally'}
					/>
				</div>
			{/if}

			<div class="notes-section">
				<label class="field-label" for="task-notes">Task notepad</label>
				<textarea
					id="task-notes"
					bind:value={note}
					class="notes-input"
					name="notes"
					rows="4"
					maxlength="2000"
					placeholder="Extra context, reminders, or anything that makes this task easier to land."
				></textarea>
			</div>

			{#if errorMessage}
				<p class="form-message error-message">{errorMessage}</p>
			{/if}

			{#if successMessage}
				<p class="form-message success-message">{successMessage}</p>
			{/if}

			<button type="submit" disabled={isSubmitting}>
				{isSubmitting ? 'Saving...' : 'Add'}
			</button>
		</form>
	</div>
</div>

<style>
	.paper {
		position: relative;
		width: min(100%, 32rem);
		margin: 0 auto;
		padding: 1.75rem;
		box-sizing: border-box;
		border-radius: 12px;
		box-shadow: 0 18px 35px rgba(50, 70, 90, 0.18);
		background-color: rgba(255, 255, 255, 0.95);
		border: 1px solid rgba(0, 0, 0, 0.08);
	}

	.task-form {
		display: grid;
		gap: 1rem;
	}

	.field-label {
		display: block;
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(0, 0, 0, 0.55);
	}

	.text-input {
		width: 100%;
		box-sizing: border-box;
		padding: 0 0 0.75rem;
		border: 0;
		border-bottom: 2px solid rgba(64, 117, 166, 0.35);
		background: transparent;
		font-size: 1.15rem;
		color: var(--color-text);
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease;
	}

	.text-input::placeholder {
		color: rgba(0, 0, 0, 0.35);
	}

	.text-input:focus {
		outline: none;
		border-bottom-color: var(--color-theme-2);
		box-shadow: 0 10px 14px -14px rgba(64, 117, 166, 0.9);
	}

	.color-picker {
		margin: 0;
		padding: 0.25rem 0;
		border: 0;
	}

	.color-options {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: 0.6rem;
	}

	.color-helper {
		display: grid;
		gap: 0.35rem;
		margin-top: 0.95rem;
		padding: 0.95rem 1rem;
		border-radius: 16px;
		background: rgba(255, 255, 255, 0.78);
		border: 1px solid rgba(64, 117, 166, 0.12);
		box-shadow: 0 12px 26px rgba(44, 62, 80, 0.08);
	}

	.color-helper__title {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		margin: 0;
		font-size: 0.92rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: rgba(13, 24, 36, 0.82);
	}

	.color-helper__dot {
		width: 0.8rem;
		height: 0.8rem;
		border-radius: 999px;
		background: var(--selected-color);
		box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.92), 0 0 0 3px rgba(0, 0, 0, 0.08);
	}

	.color-helper__description {
		margin: 0;
		font-size: 0.95rem;
		line-height: 1.45;
		color: rgba(13, 24, 36, 0.72);
	}

	.color-option {
		position: relative;
		display: flex;
		justify-content: center;
		cursor: pointer;
	}

	.color-option input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.color-choice {
		display: grid;
		justify-items: center;
		gap: 0.45rem;
	}

	.swatch {
		width: 2.35rem;
		height: 2.35rem;
		border-radius: 999px;
		background: var(--swatch-color);
		border: 2px solid rgba(255, 255, 255, 0.95);
		box-shadow:
			0 0 0 1px rgba(0, 0, 0, 0.12),
			0 8px 18px rgba(0, 0, 0, 0.16);
		transition:
			transform 0.16s ease,
			box-shadow 0.16s ease,
			outline-color 0.16s ease;
	}

	.color-option:hover .swatch {
		transform: translateY(-1px);
	}

	.color-option input:checked + .color-choice .swatch {
		transform: translateY(-2px) scale(1.05);
		box-shadow:
			0 0 0 2px rgba(255, 255, 255, 1),
			0 0 0 4px var(--swatch-color),
			0 12px 20px rgba(0, 0, 0, 0.18);
	}

	.color-caption {
		max-width: 4.8rem;
		text-align: center;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		line-height: 1.2;
		color: rgba(0, 0, 0, 0.52);
		transition: color 0.16s ease, transform 0.16s ease;
	}

	.color-option input:checked + .color-choice .color-caption {
		color: rgba(0, 0, 0, 0.76);
		transform: translateY(-1px);
	}

	.color-option:focus-within .color-choice .swatch {
		outline: 3px solid rgba(64, 117, 166, 0.35);
		outline-offset: 3px;
	}

	.task-mode {
		margin: 0;
		padding: 0;
		border: 0;
	}

	.mode-slider {
		position: relative;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		padding: 0.3rem;
		border-radius: 999px;
		background: rgba(64, 117, 166, 0.1);
		border: 1px solid rgba(64, 117, 166, 0.16);
	}

	.mode-input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.mode-indicator {
		position: absolute;
		top: 0.3rem;
		bottom: 0.3rem;
		left: 0.3rem;
		width: calc(50% - 0.3rem);
		border-radius: 999px;
		background: white;
		box-shadow: 0 10px 24px rgba(64, 117, 166, 0.14);
		transition: transform 0.18s ease;
	}

	#task-type-repeatable:checked ~ .mode-indicator {
		transform: translateX(100%);
	}

	.mode-option {
		position: relative;
		z-index: 1;
		padding: 0.8rem 1rem;
		text-align: center;
		font-size: 0.92rem;
		font-weight: 700;
		color: rgba(0, 0, 0, 0.55);
		cursor: pointer;
		transition: color 0.16s ease;
	}

	#task-type-once:checked ~ .mode-option-once,
	#task-type-repeatable:checked ~ .mode-option-repeatable {
		color: var(--color-theme-2);
	}

	.mode-slider:focus-within {
		outline: 3px solid rgba(64, 117, 166, 0.2);
		outline-offset: 4px;
	}

	.pomodoro-picker {
		margin: 0;
		padding: 0.15rem 0 0;
		border: 0;
	}

	.pomodoro-options {
		display: grid;
		gap: 0.85rem;
	}

	.pomodoro-option {
		position: relative;
		display: block;
		cursor: pointer;
	}

	.pomodoro-option input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.pomodoro-card {
		display: grid;
		gap: 0.45rem;
		padding: 1rem 1rem 1.05rem;
		border-radius: 20px;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 251, 255, 0.94)),
			radial-gradient(circle at top left, rgba(229, 82, 67, 0.08), transparent 38%);
		border: 1px solid rgba(64, 117, 166, 0.14);
		box-shadow: 0 12px 28px rgba(44, 62, 80, 0.08);
		transition:
			transform 0.16s ease,
			border-color 0.16s ease,
			box-shadow 0.16s ease,
			background-color 0.16s ease;
	}

	.pomodoro-option:hover .pomodoro-card {
		transform: translateY(-1px);
	}

	.pomodoro-option input:checked + .pomodoro-card {
		border-color: rgba(229, 82, 67, 0.4);
		box-shadow:
			0 18px 34px rgba(229, 82, 67, 0.14),
			0 0 0 1px rgba(229, 82, 67, 0.08);
		background:
			linear-gradient(180deg, rgba(255, 252, 250, 0.98), rgba(255, 247, 242, 0.95)),
			radial-gradient(circle at top left, rgba(229, 82, 67, 0.16), transparent 42%);
	}

	.pomodoro-option:focus-within .pomodoro-card {
		outline: 3px solid rgba(64, 117, 166, 0.25);
		outline-offset: 3px;
	}

	.pomodoro-card__icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.6rem;
		height: 2.6rem;
		border-radius: 999px;
		background: rgba(255, 245, 241, 0.92);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
	}

	.pomodoro-card__icon svg {
		width: 1.85rem;
		height: 1.85rem;
	}

	.pomodoro-card__topline {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.pomodoro-card__topline strong {
		font-size: 1rem;
		color: rgba(13, 24, 36, 0.88);
	}

	.pomodoro-card__topline span {
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba(229, 82, 67, 0.76);
	}

	.pomodoro-card__cadence {
		font-size: 0.95rem;
		font-weight: 700;
		color: rgba(13, 24, 36, 0.76);
	}

	.pomodoro-card__meta,
	.pomodoro-card__description,
	.pomodoro-helper__lede,
	.pomodoro-helper__meta {
		font-size: 0.9rem;
		line-height: 1.45;
		color: rgba(13, 24, 36, 0.66);
	}

	.pomodoro-helper {
		display: grid;
		gap: 0.35rem;
		margin-top: 0.95rem;
		padding: 1rem 1.05rem;
		border-radius: 18px;
		background:
			linear-gradient(180deg, rgba(255, 251, 249, 0.96), rgba(255, 246, 242, 0.94)),
			radial-gradient(circle at top left, rgba(229, 82, 67, 0.12), transparent 44%);
		border: 1px solid rgba(229, 82, 67, 0.12);
		box-shadow: 0 12px 26px rgba(44, 62, 80, 0.08);
	}

	.pomodoro-helper__eyebrow {
		margin: 0;
		font-size: 0.74rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba(229, 82, 67, 0.76);
	}

	.pomodoro-helper h2 {
		margin: 0;
		font-size: 1.2rem;
		letter-spacing: -0.03em;
		color: rgba(13, 24, 36, 0.9);
	}

	.notes-section {
		display: grid;
		gap: 0.55rem;
	}

	.tally-fields {
		display: grid;
		gap: 0.55rem;
		padding: 1rem 1.1rem;
		border-radius: 18px;
		background: rgba(255, 255, 255, 0.7);
		border: 1px solid rgba(64, 117, 166, 0.12);
	}

	.notes-input {
		width: 100%;
		box-sizing: border-box;
		padding: 0.9rem 1rem;
		border: 1px solid rgba(64, 117, 166, 0.18);
		border-radius: 14px;
		background: rgba(255, 255, 255, 0.92);
		color: var(--color-text);
		resize: vertical;
		min-height: 7rem;
		line-height: 1.45;
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease;
	}

	.notes-input::placeholder {
		color: rgba(0, 0, 0, 0.35);
	}

	.notes-input:focus {
		outline: none;
		border-color: var(--color-theme-2);
		box-shadow: 0 0 0 4px rgba(64, 117, 166, 0.12);
	}

	.form-message {
		margin: 0;
		padding: 0.9rem 1rem;
		border-radius: 14px;
		font-size: 0.92rem;
		font-weight: 700;
	}

	.success-message {
		background: rgba(67, 142, 94, 0.12);
		color: #2d6d44;
		border: 1px solid rgba(67, 142, 94, 0.18);
	}

	.error-message {
		background: rgba(175, 68, 56, 0.1);
		color: #9f2d27;
		border: 1px solid rgba(175, 68, 56, 0.16);
	}

	button {
		width: 100%;
		padding: 0.9rem 1rem;
		border: 0;
		border-radius: 10px;
		background: linear-gradient(135deg, var(--color-theme-2), #5b93c8);
		color: white;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		box-shadow: 0 12px 24px rgba(64, 117, 166, 0.24);
		cursor: pointer;
	}

	button:hover {
		filter: brightness(1.04);
	}

	button:disabled {
		cursor: wait;
		opacity: 0.72;
		filter: none;
	}

	button:focus-visible {
		outline: 3px solid rgba(64, 117, 166, 0.35);
		outline-offset: 3px;
	}
</style>
