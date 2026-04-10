<script>
	const taskColors = [
		{ value: 'red', hex: '#c74a4a', label: 'Red' },
		{ value: 'orange', hex: '#de7d37', label: 'Orange' },
		{ value: 'gold', hex: '#d7b23d', label: 'Gold' },
		{ value: 'green', hex: '#5f9b55', label: 'Green' },
		{ value: 'teal', hex: '#3d9790', label: 'Teal' },
		{ value: 'blue', hex: '#4f6ed6', label: 'Blue' },
		{ value: 'violet', hex: '#8a5bd1', label: 'Violet' }
	];

	const taskDurations = [
		{ value: '5', label: '5 min' },
		{ value: '10', label: '10 min' },
		{ value: '15', label: '15 min' },
		{ value: '20', label: '20 min' },
		{ value: '30', label: '30 min' },
		{ value: '45', label: '45 min' },
		{ value: '60', label: '1 hour' },
		{ value: '90', label: '90 min' },
		{ value: '120', label: '2 hours' },
		{ value: '180', label: '3 hours' }
	];

	const snoozeDurations = [
		{ value: '5', label: '5 min' },
		{ value: '10', label: '10 min' },
		{ value: '15', label: '15 min' },
		{ value: '20', label: '20 min' },
		{ value: '30', label: '30 min' }
	];
</script>

<svelte:head>
	<title>Add Task</title>
	<meta name="description" content="Add a task" />
</svelte:head>

<div class="text-column">
	<div class="paper">
		<form class="task-form">
			<label class="field-label" for="task-name">Name that task</label>
			<input id="task-name" class="text-input" type="text" name="name" placeholder="Wash dishes" />

			<fieldset class="color-picker">
				<legend class="field-label">Task color</legend>
				<div class="color-options">
					{#each taskColors as color, index}
						<label class="color-option" style={`--swatch-color: ${color.hex};`}>
							<input type="radio" name="color" value={color.value} checked={index === 0} />
							<span class="swatch" aria-hidden="true"></span>
							<span class="visually-hidden">{color.label}</span>
						</label>
					{/each}
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
					/>
					<input
						id="task-type-repeatable"
						class="mode-input"
						type="radio"
						name="taskType"
						value="repeatable"
						checked
					/>
					<span class="mode-indicator" aria-hidden="true"></span>
					<label class="mode-option mode-option-once" for="task-type-once">One-time task</label>
					<label class="mode-option mode-option-repeatable" for="task-type-repeatable"
						>Repeatable task</label
					>
				</div>
			</fieldset>

			<div class="alarm-stack">
				<input id="task-alarm" class="alarm-toggle" type="checkbox" name="alarm" />
				<label class="alarm-row" for="task-alarm">Alarm</label>

				<div class="alarm-fields">
					<fieldset class="time-group">
						<legend class="field-label">Task length</legend>
						<div class="time-options">
							{#each taskDurations as duration, index}
								<label class="time-option">
									<input
										type="radio"
										name="duration"
										value={duration.value}
										checked={index === 1}
									/>
									<span class="time-pill">{duration.label}</span>
								</label>
							{/each}
						</div>
					</fieldset>

					<fieldset class="time-group">
						<legend class="field-label">Snooze length</legend>
						<div class="time-options">
							{#each snoozeDurations as duration, index}
								<label class="time-option">
									<input
										type="radio"
										name="snooze"
										value={duration.value}
										checked={index === 1}
									/>
									<span class="time-pill">{duration.label}</span>
								</label>
							{/each}
						</div>
					</fieldset>
				</div>
			</div>

			<div class="notes-stack">
				<input id="task-notes-toggle" class="notes-toggle" type="checkbox" name="hasNotes" />
				<label class="notes-row" for="task-notes-toggle">Additional notes</label>

				<div class="notes-fields">
					<label class="field-label" for="task-notes">Task notes</label>
					<textarea
						id="task-notes"
						class="notes-input"
						name="notes"
						rows="4"
						placeholder="Extra context, reminders, or anything that makes this task easier to land."
					></textarea>
				</div>
			</div>

			<button type="submit">Add</button>
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

	.color-option input:checked + .swatch {
		transform: translateY(-2px) scale(1.05);
		box-shadow:
			0 0 0 2px rgba(255, 255, 255, 1),
			0 0 0 4px var(--swatch-color),
			0 12px 20px rgba(0, 0, 0, 0.18);
	}

	.color-option:focus-within .swatch {
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

	.alarm-stack {
		display: grid;
		grid-template-columns: auto 1fr;
		align-items: center;
		column-gap: 0.75rem;
		row-gap: 0.4rem;
	}

	.alarm-toggle {
		width: 1rem;
		height: 1rem;
		margin: 0;
		accent-color: var(--color-theme-2);
	}

	.alarm-row {
		font-weight: 600;
		color: rgba(0, 0, 0, 0.7);
		cursor: pointer;
	}

	.alarm-fields {
		grid-column: 1 / -1;
		display: grid;
		gap: 1rem;
		padding-left: 1.75rem;
		max-height: 0;
		overflow: hidden;
		opacity: 0;
		pointer-events: none;
		transform: translateY(-0.35rem);
		transition:
			max-height 0.25s ease,
			opacity 0.18s ease,
			transform 0.18s ease,
			padding-top 0.18s ease;
	}

	.alarm-toggle:checked ~ .alarm-fields {
		max-height: 18rem;
		padding-top: 0.35rem;
		opacity: 1;
		pointer-events: auto;
		transform: translateY(0);
	}

	.time-group {
		margin: 0;
		padding: 0;
		border: 0;
	}

	.time-options {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
	}

	.time-option {
		position: relative;
		display: inline-flex;
		cursor: pointer;
	}

	.time-option input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.time-pill {
		padding: 0.55rem 0.8rem;
		border-radius: 999px;
		background: rgba(64, 117, 166, 0.08);
		border: 1px solid rgba(64, 117, 166, 0.18);
		color: rgba(0, 0, 0, 0.74);
		font-size: 0.92rem;
		font-weight: 700;
		transition:
			background-color 0.16s ease,
			border-color 0.16s ease,
			color 0.16s ease,
			box-shadow 0.16s ease,
			transform 0.16s ease;
	}

	.time-option:hover .time-pill {
		transform: translateY(-1px);
		border-color: rgba(64, 117, 166, 0.32);
	}

	.time-option input:checked + .time-pill {
		background: var(--color-theme-2);
		border-color: var(--color-theme-2);
		color: white;
		box-shadow: 0 10px 20px rgba(64, 117, 166, 0.2);
	}

	.time-option:focus-within .time-pill {
		outline: 3px solid rgba(64, 117, 166, 0.25);
		outline-offset: 3px;
	}

	.notes-stack {
		display: grid;
		grid-template-columns: auto 1fr;
		align-items: center;
		column-gap: 0.75rem;
		row-gap: 0.4rem;
	}

	.notes-toggle {
		width: 1rem;
		height: 1rem;
		margin: 0;
		accent-color: var(--color-theme-2);
	}

	.notes-row {
		font-weight: 600;
		color: rgba(0, 0, 0, 0.7);
		cursor: pointer;
	}

	.notes-fields {
		grid-column: 1 / -1;
		display: grid;
		gap: 0.55rem;
		padding-left: 1.75rem;
		max-height: 0;
		overflow: hidden;
		opacity: 0;
		pointer-events: none;
		transform: translateY(-0.35rem);
		transition:
			max-height 0.25s ease,
			opacity 0.18s ease,
			transform 0.18s ease,
			padding-top 0.18s ease;
	}

	.notes-toggle:checked ~ .notes-fields {
		max-height: 14rem;
		padding-top: 0.35rem;
		opacity: 1;
		pointer-events: auto;
		transform: translateY(0);
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
	}

	button:hover {
		filter: brightness(1.04);
	}

	button:focus-visible {
		outline: 3px solid rgba(64, 117, 166, 0.35);
		outline-offset: 3px;
	}
</style>
