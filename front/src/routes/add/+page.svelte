<script>
	import { readApiBody, readApiError } from '$lib/api';
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
	const weekdayOptions = [
		{ value: 1, short: 'M', label: 'Monday' },
		{ value: 2, short: 'T', label: 'Tuesday' },
		{ value: 3, short: 'W', label: 'Wednesday' },
		{ value: 4, short: 'T', label: 'Thursday' },
		{ value: 5, short: 'F', label: 'Friday' },
		{ value: 6, short: 'S', label: 'Saturday' },
		{ value: 0, short: 'S', label: 'Sunday' }
	];

	let taskName = $state('');
	let selectedColor = $state(taskColors[0].value);
	let taskMode = $state('repeatable');
	let trackingType = $state('time');
	let tallyUnit = $state('');
	let tallyTarget = $state('10');
	let daymapWeekdays = $state([]);
	let note = $state('');
	let isSubmitting = $state(false);
	let successMessage = $state('');
	let errorMessage = $state('');
	const selectedColorMeta = $derived(
		taskColors.find((color) => color.value === selectedColor) ?? taskColors[0]
	);

	function resetForm() {
		taskName = '';
		selectedColor = taskColors[0].value;
		taskMode = 'repeatable';
		trackingType = 'time';
		tallyUnit = '';
		tallyTarget = '10';
		daymapWeekdays = [];
		note = '';
	}

	function toggleWeekday(weekday) {
		const nextWeekdays = new Set(daymapWeekdays);

		if (nextWeekdays.has(weekday)) {
			nextWeekdays.delete(weekday);
		} else {
			nextWeekdays.add(weekday);
		}

		daymapWeekdays = [...nextWeekdays].sort((left, right) => left - right);
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
					tallyUnit: trackingType === 'tally' ? tallyUnit : null,
					tallyTarget: trackingType === 'tally' ? Number.parseInt(tallyTarget, 10) || null : null,
					daymapWeekdays: taskMode === 'repeatable' ? daymapWeekdays : [],
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

<section class="add-page app-page">
	<div class="section-divider section-divider--primary">
		<span></span>
		<h1>Add Task</h1>
		<span></span>
	</div>

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

			{#if taskMode === 'repeatable'}
				<fieldset class="weekday-picker">
					<legend class="field-label">Auto daymap</legend>
					<div class="weekday-options" aria-label="Automatically place this task on the daymap">
						{#each weekdayOptions as weekday}
							<button
								class="weekday-option"
								class:is-selected={daymapWeekdays.includes(weekday.value)}
								type="button"
								aria-pressed={daymapWeekdays.includes(weekday.value)}
								title={weekday.label}
								onclick={() => toggleWeekday(weekday.value)}
							>
								<span>{weekday.short}</span>
							</button>
						{/each}
					</div>
					<p class="weekday-help">Selected days automatically appear in the Day Map.</p>
				</fieldset>
			{/if}

			{#if trackingType === 'tally'}
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
</section>

<style>
	.add-page {
		justify-items: center;
	}

	.paper {
		position: relative;
		width: min(100%, 32rem);
		padding: 1.75rem;
		box-sizing: border-box;
		border-radius: 12px;
		box-shadow: var(--surface-shadow-strong);
		background: var(--surface-1);
		border: 1px solid var(--surface-border);
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
		color: var(--color-muted);
	}

	.text-input {
		width: 100%;
		box-sizing: border-box;
		padding: 0 0 0.75rem;
		border: 0;
		border-bottom: 2px solid color-mix(in srgb, var(--color-accent) 34%, var(--field-border));
		background: transparent;
		font-size: 1.15rem;
		color: var(--color-text);
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease;
	}

	.text-input::placeholder {
		color: var(--color-soft);
	}

	.text-input:focus {
		outline: none;
		border-bottom-color: var(--color-theme-2);
		box-shadow: 0 10px 14px -14px var(--color-accent);
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
		background: var(--surface-2);
		border: 1px solid var(--surface-border);
		box-shadow: var(--surface-shadow);
	}

	.color-helper__title {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		margin: 0;
		font-size: 0.92rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--color-heading);
	}

	.color-helper__dot {
		width: 0.8rem;
		height: 0.8rem;
		border-radius: 999px;
		background: var(--selected-color);
		box-shadow:
			0 0 0 2px var(--surface-2),
			0 0 0 3px var(--surface-border-strong);
	}

	.color-helper__description {
		margin: 0;
		font-size: 0.95rem;
		line-height: 1.45;
		color: var(--color-muted);
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
		border: 2px solid var(--surface-3);
		box-shadow:
			0 0 0 1px var(--surface-border-strong),
			0 8px 18px color-mix(in srgb, var(--color-heading) 14%, transparent);
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
			0 0 0 2px var(--surface-3),
			0 0 0 4px var(--swatch-color),
			0 12px 20px color-mix(in srgb, var(--color-heading) 18%, transparent);
	}

	.color-caption {
		max-width: 4.8rem;
		text-align: center;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		line-height: 1.2;
		color: var(--color-soft);
		transition:
			color 0.16s ease,
			transform 0.16s ease;
	}

	.color-option input:checked + .color-choice .color-caption {
		color: var(--color-heading);
		transform: translateY(-1px);
	}

	.color-option:focus-within .color-choice .swatch {
		outline: 3px solid var(--focus-ring);
		outline-offset: 3px;
	}

	.task-mode {
		margin: 0;
		padding: 0;
		border: 0;
	}

	.weekday-picker {
		display: grid;
		gap: 0.58rem;
		margin: 0;
		padding: 0;
		border: 0;
	}

	.weekday-options {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: 0.42rem;
	}

	.weekday-option {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 2.45rem;
		border: 1px solid var(--surface-border);
		border-radius: 999px;
		background: var(--surface-2);
		box-shadow: var(--surface-shadow);
		color: var(--color-muted);
		font: inherit;
		font-size: 0.78rem;
		font-weight: 900;
		cursor: pointer;
		transition:
			transform 0.16s ease,
			border-color 0.16s ease,
			background 0.16s ease,
			color 0.16s ease;
	}

	.weekday-option:hover {
		transform: translateY(-1px);
		border-color: color-mix(in srgb, var(--color-theme-2) 34%, var(--surface-border));
		color: var(--color-heading);
	}

	.weekday-option.is-selected {
		background: var(--accent-gradient);
		border-color: color-mix(in srgb, var(--color-accent) 45%, var(--surface-border));
		color: var(--color-accent-contrast);
	}

	.weekday-help {
		margin: 0;
		font-size: 0.82rem;
		color: var(--color-muted);
	}

	.mode-slider {
		position: relative;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		padding: 0.3rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--color-accent) 10%, var(--surface-1));
		border: 1px solid color-mix(in srgb, var(--color-accent) 18%, var(--surface-border));
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
		background: var(--surface-3);
		box-shadow: 0 10px 24px color-mix(in srgb, var(--color-accent) 16%, transparent);
		transition: transform 0.18s ease;
	}

	#task-type-repeatable:checked ~ .mode-indicator {
		transform: translateX(100%);
	}

	#tracking-tally:checked ~ .mode-indicator {
		transform: translateX(100%);
	}

	.mode-option {
		position: relative;
		z-index: 1;
		padding: 0.8rem 1rem;
		text-align: center;
		font-size: 0.92rem;
		font-weight: 700;
		color: var(--color-muted);
		cursor: pointer;
		transition: color 0.16s ease;
	}

	#task-type-once:checked ~ .mode-option-once,
	#task-type-repeatable:checked ~ .mode-option-repeatable,
	#tracking-time:checked ~ .mode-option-once,
	#tracking-tally:checked ~ .mode-option-repeatable {
		color: var(--color-theme-2);
	}

	.mode-slider:focus-within {
		outline: 3px solid var(--focus-ring);
		outline-offset: 4px;
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
		background: var(--surface-2);
		border: 1px solid var(--surface-border);
	}

	.notes-input {
		width: 100%;
		box-sizing: border-box;
		padding: 0.9rem 1rem;
		border: 1px solid var(--field-border);
		border-radius: 14px;
		background: var(--field-bg);
		color: var(--color-text);
		resize: vertical;
		min-height: 7rem;
		line-height: 1.45;
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease;
	}

	.notes-input::placeholder {
		color: var(--color-soft);
	}

	.notes-input:focus {
		outline: none;
		border-color: var(--color-theme-2);
		box-shadow: 0 0 0 4px var(--focus-ring);
	}

	.form-message {
		margin: 0;
		padding: 0.9rem 1rem;
		border-radius: 14px;
		font-size: 0.92rem;
		font-weight: 700;
	}

	.success-message {
		background: color-mix(in srgb, var(--color-success) 14%, var(--surface-1));
		color: var(--color-success);
		border: 1px solid color-mix(in srgb, var(--color-success) 22%, var(--surface-border));
	}

	.error-message {
		background: color-mix(in srgb, var(--color-danger) 12%, var(--surface-1));
		color: var(--color-danger);
		border: 1px solid color-mix(in srgb, var(--color-danger) 22%, var(--surface-border));
	}

	button {
		width: 100%;
		padding: 0.9rem 1rem;
		border: 0;
		border-radius: 10px;
		background: var(--accent-gradient);
		color: var(--color-accent-contrast);
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		box-shadow: 0 12px 24px color-mix(in srgb, var(--color-accent) 24%, transparent);
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
		outline: 3px solid var(--focus-ring);
		outline-offset: 3px;
	}
</style>
