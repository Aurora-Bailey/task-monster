<script>
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import {
		Bot,
		CalendarDays,
		ChartNoAxesColumn,
		CircleCheck,
		CirclePlay,
		Flame,
		Inbox,
		LogOut,
		Plus,
		UserRound
	} from 'lucide-svelte';
	import { onMount, tick } from 'svelte';

	import AssistantDrawer from '$lib/AssistantDrawer.svelte';
	import { ASSISTANT_REFRESH_EVENT } from '$lib/assistant-client';
	import { playBellSound, unlockBellAudio } from '$lib/bell-sounds';
	import {
		dispatchPanicUpdated,
		getCurrentLocalDay,
		loadPanicStatus,
		startPanic,
		stopPanic
	} from '$lib/panic-client';
	import { getPomodoroState } from '$lib/pomodoro';
	import { normalizeAppPathname } from '$lib/routing';
	import { logoutAccount } from '$lib/session';
	import { formatElapsedDuration } from '$lib/task-format';
	import { loadActiveTasks, TASKS_UPDATED_EVENT } from '$lib/tasks-client';
	import logo from '$lib/images/tm-logo-crop.png';

	let { user = null } = $props();
	let isLoggingOut = $state(false);
	let logoutError = $state('');
	let panic = $state(null);
	let panicError = $state('');
	let isPanicLoading = $state(true);
	let isPanicBusy = $state(false);
	let nowMs = $state(Date.now());
	let currentLocalDay = $state(getCurrentLocalDay());
	let showPanicReturnModal = $state(false);
	let panicReturnNote = $state('');
	let panicReturnCharge = $state(5);
	let panicReturnNoteInput = $state(null);
	let showAssistantDrawer = $state(false);
	let activeBellTasks = $state([]);

	let bellAudioContext = null;
	let lastPomodoroBellKeys = new Map();

	const navLinks = [
		{ href: '/add', label: 'Add', icon: Plus },
		{ href: '/inactive', label: 'Inactive', icon: Inbox },
		{ href: '/daymap', label: 'Daymap', icon: CalendarDays },
		{ href: '/active', label: 'Active', icon: CirclePlay },
		{ href: '/done', label: 'Done', icon: CircleCheck },
		{ href: '/stats', label: 'Stats', icon: ChartNoAxesColumn }
	];

	const currentPath = $derived(normalizeAppPathname(page.url.pathname));

	function isCurrent(href) {
		return currentPath === href || currentPath.startsWith(`${href}/`);
	}

	function getCurrentNavIndex(pathname) {
		return navLinks.findIndex(
			(link) => pathname === link.href || pathname.startsWith(`${link.href}/`)
		);
	}

	function isTypingTarget(target) {
		if (!(target instanceof HTMLElement)) {
			return false;
		}

		if (target.isContentEditable) {
			return true;
		}

		const closestEditable = target.closest('input, textarea, select, [contenteditable="true"]');

		return Boolean(closestEditable);
	}

	const panicIsActive = $derived(Boolean(panic?.active) && panic?.day === currentLocalDay);
	const panicElapsedLabel = $derived(
		panicIsActive && panic?.startedAt
			? formatElapsedDuration(nowMs - new Date(panic.startedAt).getTime())
			: ''
	);
	const panicButtonTitle = $derived(
		panicIsActive ? `Panic active for ${panicElapsedLabel}` : 'Start tracking off-the-rails time'
	);
	const assistantButtonTitle = $derived(
		showAssistantDrawer ? 'Close the AI assistant' : 'Open the AI assistant'
	);

	async function loadPanic() {
		isPanicLoading = true;

		try {
			panic = await loadPanicStatus();
			panicError = '';
		} catch (error) {
			panicError = error.message;
		} finally {
			isPanicLoading = false;
		}
	}

	async function loadGlobalBellTasks() {
		try {
			activeBellTasks = await loadActiveTasks();
		} catch (error) {
			console.error(error);
		}
	}

	async function primeBellAudio() {
		const result = await unlockBellAudio(bellAudioContext);
		bellAudioContext = result.audioContext;
	}

	function syncGlobalBreakBell(referenceNowMs = nowMs) {
		if (!browser) {
			return;
		}

		const dueSounds = [];
		const activeTaskIds = new Set(activeBellTasks.map((task) => task.id));

		for (const taskId of lastPomodoroBellKeys.keys()) {
			if (!activeTaskIds.has(taskId)) {
				lastPomodoroBellKeys.delete(taskId);
			}
		}

		for (const task of activeBellTasks) {
			const pomodoroState = getPomodoroState(task, referenceNowMs);

			if (!pomodoroState?.isBreak || !pomodoroState.bellKey) {
				lastPomodoroBellKeys.delete(task.id);
				continue;
			}

			if (lastPomodoroBellKeys.get(task.id) !== pomodoroState.bellKey) {
				lastPomodoroBellKeys.set(task.id, pomodoroState.bellKey);
				dueSounds.push(task.bellSound);
			}
		}

		if (dueSounds.length > 0) {
			void primeBellAudio().then(() => {
				if (!bellAudioContext || bellAudioContext.state !== 'running') {
					return;
				}

				for (const soundKey of dueSounds) {
					playBellSound(bellAudioContext, soundKey);
				}
			});
		}
	}

	async function openPanicReturnModal() {
		showPanicReturnModal = true;
		await tick();
		panicReturnNoteInput?.focus();
	}

	async function handlePanicToggle() {
		panicError = '';

		if (panicIsActive) {
			await openPanicReturnModal();
			return;
		}

		isPanicBusy = true;

		try {
			const result = await startPanic();
			panic = result.panic;

			dispatchPanicUpdated(panic);
		} catch (error) {
			panicError = error.message;
		} finally {
			isPanicBusy = false;
		}
	}

	function openAssistantDrawer() {
		showAssistantDrawer = true;
	}

	function closeAssistantDrawer() {
		showAssistantDrawer = false;
	}

	function closePanicReturnModal() {
		if (isPanicBusy) {
			return;
		}

		showPanicReturnModal = false;
		panicReturnNote = '';
		panicReturnCharge = 5;
	}

	async function handlePanicReturnSubmit(event) {
		event.preventDefault();
		panicError = '';
		isPanicBusy = true;
		const emotionalCharge = Number.parseInt(String(panicReturnCharge), 10);

		try {
			panic = await stopPanic({
				note: panicReturnNote,
				emotionalCharge: Number.isInteger(emotionalCharge) ? emotionalCharge : 5
			});
			showPanicReturnModal = false;
			panicReturnNote = '';
			panicReturnCharge = 5;
			dispatchPanicUpdated(panic);
		} catch (error) {
			panicError = error.message;
		} finally {
			isPanicBusy = false;
		}
	}

	async function handleLogout() {
		logoutError = '';
		isLoggingOut = true;

		try {
			await logoutAccount();
		} catch (error) {
			logoutError = error.message;
		} finally {
			isLoggingOut = false;
		}
	}

	onMount(() => {
		void loadPanic();
		void loadGlobalBellTasks();

		if (!browser) {
			return;
		}

		const handleGlobalKeydown = async (event) => {
			void primeBellAudio();

			if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
				return;
			}

			if (event.key === 'Escape') {
				if (showPanicReturnModal) {
					return;
				}

				event.preventDefault();

				if (showAssistantDrawer) {
					closeAssistantDrawer();
					return;
				}

				openAssistantDrawer();
				return;
			}

			if (showPanicReturnModal || showAssistantDrawer || isTypingTarget(event.target)) {
				return;
			}

			if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
				return;
			}

			const currentIndex = getCurrentNavIndex(currentPath);

			if (currentIndex === -1) {
				return;
			}

			const nextIndex = event.key === 'ArrowLeft' ? currentIndex - 1 : currentIndex + 1;
			const nextLink = navLinks[nextIndex];

			if (!nextLink) {
				return;
			}

			event.preventDefault();
			await goto(resolve(nextLink.href));
		};

		const intervalId = window.setInterval(() => {
			const nextNowMs = Date.now();
			nowMs = nextNowMs;
			const nextLocalDay = getCurrentLocalDay();

			if (nextLocalDay !== currentLocalDay) {
				currentLocalDay = nextLocalDay;
				void loadPanic();
			}

			syncGlobalBreakBell(nextNowMs);
		}, 1000);
		const handleAssistantRefresh = async (event) => {
			if (event.detail?.refresh?.panic === true) {
				await loadPanic();
			}

			if (event.detail?.refresh?.tasks === true) {
				await loadGlobalBellTasks();
			}
		};
		const handleTasksUpdated = async () => {
			await loadGlobalBellTasks();
		};
		const handlePointerDown = () => {
			void primeBellAudio();
		};
		const handleVisibilityChange = async () => {
			if (document.visibilityState === 'visible') {
				await loadGlobalBellTasks();
			}
		};

		window.addEventListener('keydown', handleGlobalKeydown);
		window.addEventListener('pointerdown', handlePointerDown);
		window.addEventListener(ASSISTANT_REFRESH_EVENT, handleAssistantRefresh);
		window.addEventListener(TASKS_UPDATED_EVENT, handleTasksUpdated);
		window.addEventListener('focus', handleTasksUpdated);
		document.addEventListener('visibilitychange', handleVisibilityChange);

		return () => {
			window.removeEventListener('keydown', handleGlobalKeydown);
			window.removeEventListener('pointerdown', handlePointerDown);
			window.removeEventListener(ASSISTANT_REFRESH_EVENT, handleAssistantRefresh);
			window.removeEventListener(TASKS_UPDATED_EVENT, handleTasksUpdated);
			window.removeEventListener('focus', handleTasksUpdated);
			document.removeEventListener('visibilitychange', handleVisibilityChange);
			window.clearInterval(intervalId);
			lastPomodoroBellKeys = new Map();

			if (bellAudioContext) {
				void bellAudioContext.close();
			}
		};
	});
</script>

<header>
	<div class="corner">
		<a class="brand" href={resolve('/active')}>
			<img src={logo} alt="task-monster" />
			<span>task monster</span>
		</a>
	</div>

	<nav class="header-actions" aria-label="Header controls">
		<div class="nav-tools">
			<ul class="desktop-route-list" aria-label="Primary">
				{#each navLinks as link}
					<li>
						<a href={resolve(link.href)} aria-current={isCurrent(link.href) ? 'page' : undefined}>
							{link.label}
						</a>
					</li>
				{/each}
			</ul>

			<button
				class="panic-button"
				class:is-active={panicIsActive}
				type="button"
				title={panicButtonTitle}
				aria-label={panicButtonTitle}
				disabled={isPanicBusy || isPanicLoading}
				onclick={handlePanicToggle}
			>
				<span class="mobile-action-icon" aria-hidden="true">
					<Flame size={22} strokeWidth={2.4} />
				</span>
				<span class="panic-button__label">
					{#if isPanicBusy}
						{panicIsActive ? 'Stopping...' : 'Starting...'}
					{:else}
						Panic
					{/if}
				</span>
				{#if panicIsActive && !isPanicBusy}
					<span class="panic-button__time">{panicElapsedLabel}</span>
				{/if}
			</button>

			<button
				class="assistant-button"
				class:is-open={showAssistantDrawer}
				type="button"
				title={assistantButtonTitle}
				aria-label={assistantButtonTitle}
				onclick={showAssistantDrawer ? closeAssistantDrawer : openAssistantDrawer}
			>
				<span class="mobile-action-icon" aria-hidden="true">
					<Bot size={22} strokeWidth={2.35} />
				</span>
				<span class="assistant-button__label">AI</span>
				<span class="assistant-button__meta">{showAssistantDrawer ? 'Open' : 'Ready'}</span>
			</button>
		</div>
	</nav>

	<div class="session-tools">
		{#if user}
			<a
				class="user-pill"
				href={resolve('/profile')}
				aria-current={isCurrent('/profile') ? 'page' : undefined}
				aria-label={`Profile for ${user.username}`}
				title={`Profile for ${user.username}`}
			>
				<span class="mobile-session-icon" aria-hidden="true">
					<UserRound size={20} strokeWidth={2.3} />
				</span>
				<span class="session-label">{user.username}</span>
			</a>
			<button
				class="logout-button"
				type="button"
				title="Log out"
				aria-label={isLoggingOut ? 'Logging out' : 'Log out'}
				onclick={handleLogout}
				disabled={isLoggingOut}
			>
				<span class="mobile-session-icon" aria-hidden="true">
					<LogOut size={20} strokeWidth={2.3} />
				</span>
				<span class="session-label">{isLoggingOut ? 'Logging out...' : 'Log out'}</span>
			</button>
		{/if}
	</div>
</header>

<nav class="mobile-bottom-nav" aria-label="Primary">
	<ul class="mobile-bottom-nav__list">
		{#each navLinks as link}
			{@const NavIcon = link.icon}
			<li>
				<a
					class="mobile-bottom-nav__item"
					href={resolve(link.href)}
					aria-current={isCurrent(link.href) ? 'page' : undefined}
					aria-label={link.label}
					title={link.label}
				>
					<NavIcon size={22} strokeWidth={2.35} aria-hidden="true" />
					<span>{link.label}</span>
				</a>
			</li>
		{/each}
	</ul>
</nav>

{#if logoutError}
	<p class="logout-error">{logoutError}</p>
{/if}

{#if panicError}
	<p class="panic-error">{panicError}</p>
{/if}

<AssistantDrawer
	open={showAssistantDrawer}
	username={user?.username || ''}
	currentPath={currentPath}
	onClose={closeAssistantDrawer}
/>

{#if showPanicReturnModal}
	<div class="panic-modal-backdrop">
		<form class="panic-modal" onsubmit={handlePanicReturnSubmit}>
			<div class="panic-modal__header">
				<div>
					<p class="panic-modal__eyebrow">Return From Panic</p>
					<h2>What pulled you off focus?</h2>
				</div>
				<button
					class="panic-modal__close"
					type="button"
					aria-label="Cancel panic return"
					disabled={isPanicBusy}
					onclick={closePanicReturnModal}
				>
					×
				</button>
			</div>

			<label class="panic-modal__field">
				<span>What was the panic?</span>
				<textarea
					bind:this={panicReturnNoteInput}
					bind:value={panicReturnNote}
					rows="4"
					placeholder="What grabbed your attention or pulled you away?"
				></textarea>
			</label>

			<div class="panic-modal__field">
				<div class="panic-modal__charge-row">
					<span>How strong was the pull?</span>
					<strong>{panicReturnCharge}/10</strong>
				</div>
				<input bind:value={panicReturnCharge} type="range" min="1" max="10" step="1" />
				<div class="panic-modal__charge-scale" aria-hidden="true">
					<span>1 low</span>
					<span>10 high</span>
				</div>
			</div>

			<div class="panic-modal__actions">
				<button
					class="panic-modal__button panic-modal__button-secondary"
					type="button"
					disabled={isPanicBusy}
					onclick={closePanicReturnModal}
				>
					Keep panic on
				</button>
				<button class="panic-modal__button panic-modal__button-primary" type="submit" disabled={isPanicBusy}>
					{isPanicBusy ? 'Saving...' : 'Return to focus'}
				</button>
			</div>
		</form>
	</div>
{/if}

<style>
	header {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 1rem;
		padding: 0.9rem 1rem;
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0.34));
		backdrop-filter: blur(16px);
		border-bottom: 1px solid rgba(255, 255, 255, 0.5);
		box-shadow: 0 16px 32px rgba(44, 62, 80, 0.08);
	}

	.corner {
		display: flex;
		align-items: center;
	}

	.corner a {
		display: flex;
		align-items: center;
		text-decoration: none;
	}

	.corner img {
		width: 2.3rem;
		height: 2.3rem;
		object-fit: contain;
	}

	.brand {
		gap: 0.75rem;
		font-size: 0.82rem;
		font-weight: 800;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: rgba(13, 24, 36, 0.82);
	}

	nav,
	.session-tools {
		display: flex;
		justify-content: center;
	}

	.nav-tools {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.7rem;
	}

	.mobile-bottom-nav {
		display: none;
	}

	.mobile-action-icon,
	.mobile-session-icon {
		display: none;
	}

	.session-tools {
		align-items: center;
		gap: 0.65rem;
	}

	ul {
		padding: 0.32rem;
		margin: 0;
		display: flex;
		align-items: stretch;
		gap: 0.2rem;
		list-style: none;
		background: rgba(255, 255, 255, 0.62);
		border: 1px solid rgba(255, 255, 255, 0.72);
		border-radius: 999px;
		box-shadow:
			0 18px 32px rgba(44, 62, 80, 0.08),
			inset 0 1px 0 rgba(255, 255, 255, 0.85);
	}

	nav a {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.72rem 1rem;
		border-radius: 999px;
		color: rgba(13, 24, 36, 0.62);
		font-weight: 800;
		font-size: 0.78rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		text-decoration: none;
		transition:
			color 0.2s ease,
			background-color 0.2s ease,
			transform 0.2s ease,
			box-shadow 0.2s ease;
	}

	nav a:hover {
		transform: translateY(-1px);
		color: var(--color-theme-2);
	}

	nav a[aria-current='page'] {
		background: linear-gradient(135deg, var(--color-theme-2), #5b93c8);
		color: white;
		box-shadow: 0 14px 28px rgba(64, 117, 166, 0.28);
	}

	.panic-button {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.1rem;
		min-width: 7.2rem;
		min-height: 3.2rem;
		padding: 0.55rem 0.95rem;
		border: 0;
		border-radius: 999px;
		background: linear-gradient(135deg, #ff9f3f, #ff7c21);
		box-shadow: 0 14px 28px rgba(219, 119, 23, 0.28);
		color: white;
		cursor: pointer;
		transition:
			transform 0.2s ease,
			box-shadow 0.2s ease,
			filter 0.2s ease;
	}

	.assistant-button {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.1rem;
		min-width: 7.2rem;
		min-height: 3.2rem;
		padding: 0.55rem 0.95rem;
		border-radius: 999px;
		background:
			radial-gradient(circle at top left, rgba(132, 186, 255, 0.3), transparent 46%),
			linear-gradient(135deg, rgba(20, 30, 44, 0.94), rgba(11, 17, 28, 0.96));
		border: 1px solid rgba(132, 186, 255, 0.18);
		box-shadow: 0 14px 28px rgba(12, 18, 30, 0.24);
		color: white;
		cursor: pointer;
		transition:
			transform 0.2s ease,
			box-shadow 0.2s ease,
			filter 0.2s ease;
	}

	.panic-button:hover {
		transform: translateY(-1px);
		filter: brightness(1.03);
	}

	.assistant-button:hover {
		transform: translateY(-1px);
		filter: brightness(1.04);
	}

	.panic-button:disabled {
		cursor: wait;
		opacity: 0.82;
		transform: none;
	}

	.assistant-button:disabled {
		cursor: wait;
		opacity: 0.82;
		transform: none;
	}

	.panic-button.is-active {
		background: linear-gradient(135deg, #f24839, #bd1f1f);
		box-shadow: 0 14px 28px rgba(190, 31, 31, 0.32);
		animation: panic-flash 0.9s ease-in-out infinite alternate;
	}

	.assistant-button.is-open {
		border-color: rgba(132, 186, 255, 0.34);
		box-shadow:
			0 0 0 3px rgba(132, 186, 255, 0.12),
			0 14px 28px rgba(12, 18, 30, 0.28);
	}

	.assistant-button__label,
	.panic-button__label {
		font-size: 0.76rem;
		font-weight: 900;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		line-height: 1;
	}

	.assistant-button__meta,
	.panic-button__time {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		line-height: 1;
	}

	.user-pill,
	.logout-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.7rem 0.9rem;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.62);
		border: 1px solid rgba(255, 255, 255, 0.72);
		box-shadow: 0 14px 28px rgba(44, 62, 80, 0.08);
		font-size: 0.76rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(13, 24, 36, 0.72);
		text-decoration: none;
	}

	.user-pill .session-label,
	.logout-button .session-label,
	.user-pill .mobile-session-icon,
	.logout-button .mobile-session-icon {
		display: inline-flex;
		align-items: center;
	}

	.logout-button {
		cursor: pointer;
	}

	.user-pill[aria-current='page'] {
		background: linear-gradient(135deg, rgba(64, 117, 166, 0.18), rgba(91, 147, 200, 0.12));
		color: var(--color-theme-2);
		box-shadow: 0 14px 28px rgba(64, 117, 166, 0.16);
	}

	.logout-button:hover {
		transform: translateY(-1px);
		color: var(--color-theme-2);
	}

	.logout-button:disabled {
		cursor: wait;
		opacity: 0.72;
	}

	.logout-error {
		margin: 0;
		padding: 0 1rem 0.75rem;
		font-size: 0.78rem;
		font-weight: 700;
		color: #9f2d27;
		text-align: right;
	}

	.panic-error {
		margin: 0;
		padding: 0 1rem 0.75rem;
		font-size: 0.78rem;
		font-weight: 700;
		color: #b54d12;
		text-align: center;
	}

	.panic-modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 90;
		display: grid;
		place-items: center;
		padding: 1.25rem;
		background: rgba(12, 18, 26, 0.4);
		backdrop-filter: blur(10px);
	}

	.panic-modal {
		width: min(100%, 34rem);
		display: grid;
		gap: 1rem;
		padding: 1.25rem;
		border-radius: 24px;
		background:
			linear-gradient(180deg, rgba(255, 252, 249, 0.98), rgba(255, 245, 240, 0.95)),
			linear-gradient(135deg, rgba(255, 159, 63, 0.16), rgba(242, 72, 57, 0.12));
		border: 1px solid rgba(242, 72, 57, 0.16);
		box-shadow:
			0 30px 70px rgba(20, 28, 38, 0.28),
			inset 0 1px 0 rgba(255, 255, 255, 0.8);
	}

	.panic-modal__header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	.panic-modal__eyebrow {
		margin: 0 0 0.3rem;
		font-size: 0.74rem;
		font-weight: 800;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: #bd5a18;
	}

	.panic-modal h2 {
		margin: 0;
		font-size: 1.55rem;
		letter-spacing: -0.04em;
		color: rgba(18, 26, 36, 0.92);
	}

	.panic-modal__close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.4rem;
		height: 2.4rem;
		border: 0;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.75);
		color: rgba(18, 26, 36, 0.62);
		font-size: 1.45rem;
		line-height: 1;
		cursor: pointer;
	}

	.panic-modal__field {
		display: grid;
		gap: 0.55rem;
	}

	.panic-modal__field span {
		font-size: 0.82rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		color: rgba(18, 26, 36, 0.76);
	}

	.panic-modal textarea,
	.panic-modal input[type='range'] {
		width: 100%;
	}

	.panic-modal textarea {
		padding: 0.9rem 1rem;
		border-radius: 18px;
		border: 1px solid rgba(18, 26, 36, 0.12);
		background: rgba(255, 255, 255, 0.82);
		box-shadow: inset 0 1px 2px rgba(18, 26, 36, 0.04);
		font: inherit;
		color: rgba(18, 26, 36, 0.88);
		resize: vertical;
	}

	.panic-modal textarea:focus,
	.panic-modal input[type='range']:focus {
		outline: none;
		box-shadow:
			0 0 0 3px rgba(242, 72, 57, 0.14),
			inset 0 1px 2px rgba(18, 26, 36, 0.04);
	}

	.panic-modal__charge-row,
	.panic-modal__charge-scale,
	.panic-modal__actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.8rem;
	}

	.panic-modal__charge-row strong {
		font-size: 1rem;
		letter-spacing: -0.02em;
		color: #b44718;
	}

	.panic-modal__charge-scale {
		font-size: 0.74rem;
		font-weight: 700;
		color: rgba(18, 26, 36, 0.52);
	}

	.panic-modal__button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 3rem;
		padding: 0.75rem 1rem;
		border: 0;
		border-radius: 999px;
		font-size: 0.8rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.panic-modal__button:disabled,
	.panic-modal__close:disabled {
		cursor: wait;
		opacity: 0.72;
	}

	.panic-modal__button-secondary {
		background: rgba(255, 255, 255, 0.75);
		color: rgba(18, 26, 36, 0.7);
		border: 1px solid rgba(18, 26, 36, 0.1);
	}

	.panic-modal__button-primary {
		background: linear-gradient(135deg, #f24839, #bd1f1f);
		box-shadow: 0 14px 28px rgba(190, 31, 31, 0.26);
		color: white;
	}

	@keyframes panic-flash {
		from {
			filter: saturate(1) brightness(1);
		}

		to {
			filter: saturate(1.18) brightness(1.18);
			box-shadow: 0 0 0 3px rgba(242, 72, 57, 0.15), 0 16px 30px rgba(190, 31, 31, 0.38);
		}
	}

	@media (max-width: 1024px) {
		header {
			position: sticky;
			top: 0;
			z-index: 65;
			grid-template-columns: auto 1fr auto;
			gap: 0.55rem;
			padding: 0.68rem 0.85rem;
		}

		.header-actions {
			justify-content: flex-end;
		}

		.nav-tools {
			justify-content: flex-end;
			gap: 0.45rem;
		}

		.desktop-route-list {
			display: none;
		}

		.brand span {
			max-width: 9.5rem;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			letter-spacing: 0.1em;
		}

		.panic-button,
		.assistant-button,
		.user-pill,
		.logout-button {
			width: 2.75rem;
			min-width: 2.75rem;
			height: 2.75rem;
			min-height: 2.75rem;
			padding: 0;
			border-radius: 999px;
		}

		.mobile-action-icon,
		.mobile-session-icon {
			display: block;
			flex: 0 0 auto;
		}

		.panic-button__label,
		.panic-button__time,
		.assistant-button__label,
		.assistant-button__meta,
		.session-label {
			position: absolute;
			width: 1px;
			height: 1px;
			padding: 0;
			margin: -1px;
			overflow: hidden;
			clip: rect(0, 0, 0, 0);
			white-space: nowrap;
			border: 0;
		}

		.mobile-bottom-nav {
			position: fixed;
			left: 0.75rem;
			right: 0.75rem;
			bottom: calc(0.65rem + env(safe-area-inset-bottom));
			z-index: 70;
			display: block;
			pointer-events: none;
		}

		.mobile-bottom-nav__list {
			width: min(100%, 44rem);
			min-height: 4.6rem;
			margin: 0 auto;
			padding: 0.5rem;
			display: grid;
			grid-template-columns: repeat(6, minmax(0, 1fr));
			gap: 0.12rem;
			background: rgba(255, 255, 255, 0.82);
			border: 1px solid rgba(255, 255, 255, 0.82);
			border-radius: 999px;
			box-shadow:
				0 22px 45px rgba(25, 36, 48, 0.2),
				inset 0 1px 0 rgba(255, 255, 255, 0.9);
			backdrop-filter: blur(22px);
			pointer-events: auto;
		}

		.mobile-bottom-nav li {
			min-width: 0;
		}

		.mobile-bottom-nav__item {
			position: relative;
			height: 100%;
			min-height: 3.45rem;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: 0.18rem;
			padding: 0.25rem 0.1rem;
			border-radius: 999px;
			color: rgba(13, 24, 36, 0.56);
			text-decoration: none;
			transition:
				color 0.18s ease,
				background-color 0.18s ease,
				transform 0.18s ease,
				box-shadow 0.18s ease;
		}

		.mobile-bottom-nav__item:hover {
			transform: translateY(-1px);
			color: var(--color-theme-2);
		}

		.mobile-bottom-nav__item[aria-current='page'] {
			background: linear-gradient(135deg, var(--color-theme-2), #5b93c8);
			color: white;
			box-shadow: 0 12px 24px rgba(64, 117, 166, 0.24);
		}

		.mobile-bottom-nav__item span {
			max-width: 100%;
			overflow: hidden;
			text-overflow: ellipsis;
			font-size: 0.62rem;
			font-weight: 900;
			line-height: 1;
			letter-spacing: 0;
			text-transform: none;
			opacity: 0;
			max-height: 0;
			transition:
				opacity 0.18s ease,
				max-height 0.18s ease;
		}

		.mobile-bottom-nav__item[aria-current='page'] span {
			opacity: 1;
			max-height: 0.85rem;
		}

		:global(.app main) {
			padding-bottom: calc(5.9rem + env(safe-area-inset-bottom));
		}

		:global(.app .site-footer) {
			padding-bottom: calc(5.7rem + env(safe-area-inset-bottom));
		}
	}

	@media (max-width: 520px) {
		.brand span {
			display: none;
		}

		header {
			grid-template-columns: auto 1fr auto;
			padding-inline: 0.72rem;
		}

		.corner img {
			width: 2.05rem;
			height: 2.05rem;
		}

		.session-tools {
			gap: 0.4rem;
		}

		.user-pill,
		.logout-button {
			width: 2.52rem;
			min-width: 2.52rem;
			height: 2.52rem;
			min-height: 2.52rem;
		}

		.panic-button,
		.assistant-button {
			width: 2.52rem;
			min-width: 2.52rem;
			height: 2.52rem;
			min-height: 2.52rem;
		}

		.mobile-bottom-nav {
			left: 0.55rem;
			right: 0.55rem;
			bottom: calc(0.5rem + env(safe-area-inset-bottom));
		}

		.mobile-bottom-nav__list {
			min-height: 4.25rem;
			padding: 0.4rem;
		}

		.mobile-bottom-nav__item {
			min-height: 3.25rem;
		}

		.mobile-bottom-nav__item span {
			display: none;
		}

		.panic-modal__actions {
			flex-direction: column-reverse;
		}

		.panic-modal__button {
			width: 100%;
		}
	}
</style>
