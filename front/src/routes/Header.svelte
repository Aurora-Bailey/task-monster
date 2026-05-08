<script>
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import {
		Bot,
		ChartNoAxesColumn,
		Check,
		CircleCheck,
		CirclePlay,
		Flame,
		Inbox,
		Plus,
		Settings
	} from 'lucide-svelte';
	import { onMount, tick } from 'svelte';

	import AssistantDrawer from '$lib/AssistantDrawer.svelte';
	import { ASSISTANT_REFRESH_EVENT } from '$lib/assistant-client';
	import { buildIntensitySplitFill, getIntensityCellColor } from '$lib/intensity-cells';
	import {
		dispatchPanicUpdated,
		getCurrentLocalDay,
		getCurrentTimezoneOffsetMinutes,
		loadPanicStatus,
		PANIC_UPDATED_EVENT,
		startPanic,
		stopPanic
	} from '$lib/panic-client';
	import { normalizeAppPathname } from '$lib/routing';
	import { accountSessions, session, switchAccount } from '$lib/session';
	import { loadStatsHeatmap } from '$lib/stats-client';
	import { formatElapsedDuration } from '$lib/task-format';
	import { getThemeDefinition } from '$lib/theme';
	import { TASKS_UPDATED_EVENT } from '$lib/tasks-client';
	import logo from '$lib/images/tm-logo-crop.png';

	const MINUTES_PER_HOUR = 60;
	const MINUTE_MS = 60 * 1000;
	const CLOCK_MODE_STORAGE_KEY = 'task_monster_clock_mode';
	const CLOCK_HOUR_MARKS = Array.from({ length: 12 }, (_, index) => index);
	const CLOCK_WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
	const DIGITAL_CLOCK_SEGMENTS = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
	const DIGITAL_CLOCK_SEGMENT_MAP = Object.freeze({
		0: ['a', 'b', 'c', 'd', 'e', 'f'],
		1: ['b', 'c'],
		2: ['a', 'b', 'd', 'e', 'g'],
		3: ['a', 'b', 'c', 'd', 'g'],
		4: ['b', 'c', 'f', 'g'],
		5: ['a', 'c', 'd', 'f', 'g'],
		6: ['a', 'c', 'd', 'e', 'f', 'g'],
		7: ['a', 'b', 'c'],
		8: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
		9: ['a', 'b', 'c', 'd', 'f', 'g']
	});
	const EMPTY_TRACE_MINUTE = Object.freeze({
		active: false,
		fill: '',
		glow: '',
		label: '',
		panicking: false
	});

	function getStoredClockMode() {
		if (!browser) {
			return 'analog';
		}

		try {
			return window.localStorage.getItem(CLOCK_MODE_STORAGE_KEY) === 'digital'
				? 'digital'
				: 'analog';
		} catch {
			return 'analog';
		}
	}

	function storeClockMode(nextMode) {
		if (!browser) {
			return;
		}

		try {
			window.localStorage.setItem(CLOCK_MODE_STORAGE_KEY, nextMode);
		} catch {
			// Clock mode is a convenience preference; ignore blocked storage.
		}
	}

	let { user = null } = $props();
	let panic = $state(null);
	let panicError = $state('');
	let isPanicLoading = $state(true);
	let isPanicBusy = $state(false);
	let nowMs = $state(Date.now());
	let currentLocalDay = $state(getCurrentLocalDay());
	let currentHourTrace = $state(Array.from({ length: MINUTES_PER_HOUR }, () => EMPTY_TRACE_MINUTE));
	let showPanicReturnModal = $state(false);
	let panicReturnNote = $state('');
	let panicReturnCharge = $state(5);
	let panicReturnNoteInput = $state(null);
	let showAssistantDrawer = $state(false);
	let clockMode = $state(getStoredClockMode());
	let accountMenuOpen = $state(false);
	let accountMenuError = $state('');
	let switchingAccountToken = $state(null);
	let accountMenuElement = $state(null);
	let desktopRouteListElement = $state(null);
	let mobileRouteListElement = $state(null);
	let desktopNavIndicatorStyle = $state('');
	let mobileNavIndicatorStyle = $state('');

	const navLinks = [
		{ href: '/add', label: 'Add', icon: Plus },
		{ href: '/tasks', label: 'Tasks', icon: Inbox },
		{ href: '/active', label: 'Active', icon: CirclePlay },
		{ href: '/done', label: 'Done', icon: CircleCheck },
		{ href: '/stats', label: 'Stats', icon: ChartNoAxesColumn }
	];

	const currentPath = $derived(normalizeAppPathname(page.url.pathname));
	const activeNavIndex = $derived(getCurrentNavIndex(currentPath));
	const accountMenuAccounts = $derived(
		$accountSessions.length > 0
			? $accountSessions
			: user && $session.token
				? [{ token: $session.token, user }]
				: []
	);

	function isCurrent(href) {
		return currentPath === href || currentPath.startsWith(`${href}/`);
	}

	function getCurrentNavIndex(pathname) {
		return navLinks.findIndex(
			(link) => pathname === link.href || pathname.startsWith(`${link.href}/`)
		);
	}

	function getNavIndicatorStyle(routeListElement) {
		const activeLink = routeListElement?.querySelector('a[aria-current="page"]');

		if (!(activeLink instanceof HTMLElement)) {
			return '';
		}

		const routeListRect = routeListElement.getBoundingClientRect();
		const activeLinkRect = activeLink.getBoundingClientRect();
		const activeLeft = activeLinkRect.left - routeListRect.left + routeListElement.scrollLeft;
		const activeTop = activeLinkRect.top - routeListRect.top + routeListElement.scrollTop;

		return [
			`--active-nav-left: ${activeLeft}px`,
			`--active-nav-top: ${activeTop}px`,
			`--active-nav-width: ${activeLinkRect.width}px`,
			`--active-nav-height: ${activeLinkRect.height}px`
		].join('; ');
	}

	async function updateNavIndicators() {
		await tick();
		desktopNavIndicatorStyle = getNavIndicatorStyle(desktopRouteListElement);
		mobileNavIndicatorStyle = getNavIndicatorStyle(mobileRouteListElement);
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

	function formatAccountName(username) {
		if (!username) {
			return 'Account';
		}

		return `${username.slice(0, 1).toUpperCase()}${username.slice(1)}`;
	}

	function getAccountInitial(username) {
		return (username || '?').slice(0, 1).toUpperCase();
	}

	function getAccountAvatarStyle(accountUser) {
		const themeDefinition = getThemeDefinition(accountUser?.theme);
		const avatarText = themeDefinition.colorScheme === 'dark' ? '#ffffff' : '#111827';

		return `--account-swatch-0: ${themeDefinition.swatch[0]}; --account-swatch-1: ${themeDefinition.swatch[1]}; --account-swatch-2: ${themeDefinition.swatch[2]}; --account-avatar-text: ${avatarText};`;
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
	const clockDate = $derived(new Date(nowMs));
	const clockHours = $derived(clockDate.getHours());
	const clockMinutes = $derived(clockDate.getMinutes());
	const clockSeconds = $derived(clockDate.getSeconds());
	const clockDigitalLabel = $derived(
		`${String(clockHours % 12 || 12)}:${String(clockMinutes).padStart(2, '0')}`
	);
	const clockDigitalCharacters = $derived(clockDigitalLabel.split(''));
	const clockDayLabel = $derived(`${CLOCK_WEEKDAYS[clockDate.getDay()]} ${clockDate.getDate()}`);
	const analogClockStyle = $derived(
		`--hour-rotation: ${((clockHours % 12) + clockMinutes / 60) * 30}deg; --minute-rotation: ${(clockMinutes + clockSeconds / 60) * 6}deg;`
	);
	const clockButtonTitle = $derived(
		clockMode === 'analog'
			? `Switch to digital clock, current time ${clockDigitalLabel}, ${clockDayLabel}`
			: `Switch to analog clock, current time ${clockDigitalLabel}, ${clockDayLabel}`
	);

	$effect(() => {
		currentPath;

		if (browser) {
			void updateNavIndicators();
		}
	});

	function padDateTimePart(value) {
		return String(value).padStart(2, '0');
	}

	function getCurrentMinuteKey() {
		const date = new Date();

		return [
			date.getFullYear(),
			padDateTimePart(date.getMonth() + 1),
			padDateTimePart(date.getDate()),
			padDateTimePart(date.getHours()),
			padDateTimePart(date.getMinutes())
		].join('-');
	}

	function getLocalDayStartMs(day) {
		const [year, month, date] = day.split('-').map((part) => Number.parseInt(part, 10));

		return new Date(year, month - 1, date, 0, 0, 0, 0).getTime();
	}

	function getUniqueTaskSessions(sessions) {
		const seenTaskIds = new Set();

		return sessions.filter((session) => {
			const key = session.taskId || session.id;

			if (seenTaskIds.has(key)) {
				return false;
			}

			seenTaskIds.add(key);
			return true;
		});
	}

	function buildCurrentHourTrace(day) {
		const now = new Date();
		const hourStartMinute = now.getHours() * MINUTES_PER_HOUR;
		const dayStartMs = getLocalDayStartMs(day.day);
		const minuteBuckets = Array.from({ length: MINUTES_PER_HOUR }, () => []);
		const panicMinuteBuckets = Array.from({ length: MINUTES_PER_HOUR }, () => false);

		for (const session of day.sessions ?? []) {
			const startedAtMs = new Date(session.startedAt).getTime();
			const endedAtMs = new Date(session.endedAt).getTime();

			if (
				!Number.isFinite(startedAtMs) ||
				!Number.isFinite(endedAtMs) ||
				endedAtMs <= startedAtMs
			) {
				continue;
			}

			const startMinute = Math.max(0, Math.floor((startedAtMs - dayStartMs) / MINUTE_MS));
			const endMinute = Math.min(
				24 * MINUTES_PER_HOUR,
				Math.ceil((endedAtMs - dayStartMs) / MINUTE_MS)
			);
			const traceStart = Math.max(hourStartMinute, startMinute);
			const traceEnd = Math.min(hourStartMinute + MINUTES_PER_HOUR, endMinute);

			for (let minute = traceStart; minute < traceEnd; minute += 1) {
				minuteBuckets[minute - hourStartMinute].push(session);
			}
		}

		for (const panicSession of day.panicSessions ?? []) {
			const startedAtMs = new Date(panicSession.startedAt).getTime();
			const endedAtMs = new Date(panicSession.endedAt).getTime();

			if (
				!Number.isFinite(startedAtMs) ||
				!Number.isFinite(endedAtMs) ||
				endedAtMs <= startedAtMs
			) {
				continue;
			}

			const startMinute = Math.max(0, Math.floor((startedAtMs - dayStartMs) / MINUTE_MS));
			const endMinute = Math.min(
				24 * MINUTES_PER_HOUR,
				Math.ceil((endedAtMs - dayStartMs) / MINUTE_MS)
			);
			const traceStart = Math.max(hourStartMinute, startMinute);
			const traceEnd = Math.min(hourStartMinute + MINUTES_PER_HOUR, endMinute);

			for (let minute = traceStart; minute < traceEnd; minute += 1) {
				panicMinuteBuckets[minute - hourStartMinute] = true;
			}
		}

		return minuteBuckets.map((sessions, minuteIndex) => {
			const minuteLabel = `${now.getHours()}:${padDateTimePart(minuteIndex)}`;
			const panicking = panicMinuteBuckets[minuteIndex];

			if (sessions.length === 0) {
				return panicking
					? {
							active: false,
							fill: '',
							glow: '',
							label: `${minuteLabel}: Panic`,
							panicking
						}
					: EMPTY_TRACE_MINUTE;
			}

			const uniqueTaskSessions = getUniqueTaskSessions(sessions);
			const uniqueTaskNames = uniqueTaskSessions.map((session) => session.name);
			const firstTaskSession = uniqueTaskSessions.find((session) => session.color);

			return {
				active: true,
				fill: buildIntensitySplitFill(uniqueTaskSessions),
				glow: firstTaskSession
					? getIntensityCellColor(firstTaskSession.color, firstTaskSession.intensity)
					: '',
				label: `${minuteLabel}: ${uniqueTaskNames.join(' + ')}${panicking ? ' + Panic' : ''}`,
				panicking
			};
		});
	}

	async function loadCurrentHourTrace() {
		if (!user) {
			currentHourTrace = Array.from({ length: MINUTES_PER_HOUR }, () => EMPTY_TRACE_MINUTE);
			return;
		}

		try {
			const heatmap = await loadStatsHeatmap({
				startDay: getCurrentLocalDay(),
				count: 1,
				tzOffsetMinutes: getCurrentTimezoneOffsetMinutes()
			});
			const today = heatmap.days?.[0];

			currentHourTrace = today
				? buildCurrentHourTrace(today)
				: Array.from({ length: MINUTES_PER_HOUR }, () => EMPTY_TRACE_MINUTE);
		} catch (error) {
			console.error(error);
			currentHourTrace = Array.from({ length: MINUTES_PER_HOUR }, () => EMPTY_TRACE_MINUTE);
		}
	}

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

	async function openPanicReturnModal() {
		accountMenuOpen = false;
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
		accountMenuOpen = false;
		showAssistantDrawer = true;
	}

	function closeAssistantDrawer() {
		showAssistantDrawer = false;
	}

	function toggleClockMode() {
		accountMenuOpen = false;
		const nextMode = clockMode === 'analog' ? 'digital' : 'analog';

		clockMode = nextMode;
		storeClockMode(nextMode);
	}

	function closePanicReturnModal() {
		if (isPanicBusy) {
			return;
		}

		showPanicReturnModal = false;
		panicReturnNote = '';
		panicReturnCharge = 5;
	}

	function toggleAccountMenu() {
		accountMenuError = '';
		accountMenuOpen = !accountMenuOpen;

		if (accountMenuOpen) {
			showAssistantDrawer = false;
		}
	}

	function dispatchAccountRefresh() {
		if (!browser) {
			return;
		}

		window.dispatchEvent(
			new CustomEvent(ASSISTANT_REFRESH_EVENT, {
				detail: {
					refresh: {
						tasks: true,
						stats: true,
						panic: true
					}
				}
			})
		);
	}

	async function handleSwitchAccount(account) {
		if (!account || switchingAccountToken !== null) {
			return;
		}

		if (account.token === $session.token) {
			accountMenuOpen = false;
			return;
		}

		accountMenuError = '';
		switchingAccountToken = account.token;

		try {
			await switchAccount(account.token);
			dispatchAccountRefresh();
			accountMenuOpen = false;
		} catch (error) {
			accountMenuError = error.message;
		} finally {
			switchingAccountToken = null;
		}
	}

	async function handleAddAccount() {
		accountMenuOpen = false;
		await goto(`${resolve('/auth')}?addAccount=1`);
	}

	async function handleAccountSettings() {
		accountMenuOpen = false;
		await goto(resolve('/profile'));
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

	onMount(() => {
		void loadPanic();
		void loadCurrentHourTrace();

		if (!browser) {
			return;
		}

		let currentMinuteKey = getCurrentMinuteKey();
		const handleGlobalKeydown = async (event) => {
			if (
				event.defaultPrevented ||
				event.metaKey ||
				event.ctrlKey ||
				event.altKey ||
				event.shiftKey
			) {
				return;
			}

			if (event.key === 'Escape') {
				if (showPanicReturnModal) {
					return;
				}

				event.preventDefault();

				if (accountMenuOpen) {
					accountMenuOpen = false;
					return;
				}

				if (showAssistantDrawer) {
					closeAssistantDrawer();
					return;
				}

				openAssistantDrawer();
				return;
			}

			if (
				showPanicReturnModal ||
				showAssistantDrawer ||
				accountMenuOpen ||
				isTypingTarget(event.target)
			) {
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
			const nextMinuteKey = getCurrentMinuteKey();

			if (nextLocalDay !== currentLocalDay) {
				currentLocalDay = nextLocalDay;
				void loadPanic();
			}

			if (nextMinuteKey !== currentMinuteKey) {
				currentMinuteKey = nextMinuteKey;
				void loadCurrentHourTrace();
			}
		}, 1000);
		const handleAssistantRefresh = async (event) => {
			if (event.detail?.refresh?.panic === true) {
				await loadPanic();
			}

			if (event.detail?.refresh?.tasks === true || event.detail?.refresh?.stats === true) {
				await loadCurrentHourTrace();
			}
		};
		const handleTaskUpdated = () => {
			void loadCurrentHourTrace();
		};
		const handlePanicUpdated = () => {
			void loadPanic();
			void loadCurrentHourTrace();
		};
		const handleWindowResize = () => {
			void updateNavIndicators();
		};
		const handleDocumentPointerDown = (event) => {
			if (!accountMenuOpen || !accountMenuElement || !(event.target instanceof Node)) {
				return;
			}

			if (!accountMenuElement.contains(event.target)) {
				accountMenuOpen = false;
			}
		};

		window.addEventListener('keydown', handleGlobalKeydown);
		window.addEventListener(ASSISTANT_REFRESH_EVENT, handleAssistantRefresh);
		window.addEventListener(TASKS_UPDATED_EVENT, handleTaskUpdated);
		window.addEventListener(PANIC_UPDATED_EVENT, handlePanicUpdated);
		window.addEventListener('resize', handleWindowResize);
		window.addEventListener('pointerdown', handleDocumentPointerDown);

		const navResizeObserver =
			'ResizeObserver' in window
				? new ResizeObserver(() => {
						void updateNavIndicators();
					})
				: null;

		if (navResizeObserver) {
			if (desktopRouteListElement) {
				navResizeObserver.observe(desktopRouteListElement);
			}

			if (mobileRouteListElement) {
				navResizeObserver.observe(mobileRouteListElement);
			}
		}

		void updateNavIndicators();

		return () => {
			window.removeEventListener('keydown', handleGlobalKeydown);
			window.removeEventListener(ASSISTANT_REFRESH_EVENT, handleAssistantRefresh);
			window.removeEventListener(TASKS_UPDATED_EVENT, handleTaskUpdated);
			window.removeEventListener(PANIC_UPDATED_EVENT, handlePanicUpdated);
			window.removeEventListener('resize', handleWindowResize);
			window.removeEventListener('pointerdown', handleDocumentPointerDown);
			navResizeObserver?.disconnect();
			window.clearInterval(intervalId);
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

	<nav class="header-actions" aria-label="Primary navigation">
		<div class="nav-tools">
			<ul
				bind:this={desktopRouteListElement}
				class={`desktop-route-list ${activeNavIndex >= 0 ? 'has-active-route' : ''}`}
				style={desktopNavIndicatorStyle}
				aria-label="Primary"
			>
				{#each navLinks as link}
					{@const NavIcon = link.icon}
					<li>
						<a
							href={resolve(link.href)}
							aria-current={isCurrent(link.href) ? 'page' : undefined}
							aria-label={link.label}
							title={link.label}
						>
							<NavIcon size={20} strokeWidth={2.35} aria-hidden="true" />
							<span>{link.label}</span>
						</a>
					</li>
				{/each}
			</ul>
		</div>
	</nav>

	<nav class="header-utilities" aria-label="Utility controls">
		<button
			class="utility-button clock-button"
			class:is-digital={clockMode === 'digital'}
			type="button"
			title={clockButtonTitle}
			aria-label={clockButtonTitle}
			onclick={toggleClockMode}
		>
			{#if clockMode === 'analog'}
				<span class="clock-analog" style={analogClockStyle} aria-hidden="true">
					{#each CLOCK_HOUR_MARKS as mark}
						<span class="clock-analog__mark" style={`--clock-mark-angle: ${mark * 30}deg;`}></span>
					{/each}
					<span class="clock-analog__hand clock-analog__hand-hour"></span>
					<span class="clock-analog__hand clock-analog__hand-minute"></span>
					<span class="clock-analog__pin"></span>
				</span>
			{:else}
				<span class="clock-digital" aria-hidden="true">
					<span class="clock-digital__time">
						{#each clockDigitalCharacters as char}
							{#if char === ':'}
								<span class="clock-digital__colon">
									<span></span>
									<span></span>
								</span>
							{:else}
								<span class="clock-digit">
									{#each DIGITAL_CLOCK_SEGMENTS as segment}
										<span
											class={`clock-digit__segment ${DIGITAL_CLOCK_SEGMENT_MAP[char]?.includes(segment) ? 'is-on' : ''}`}
											data-segment={segment}
										></span>
									{/each}
								</span>
							{/if}
						{/each}
					</span>
					<span class="clock-digital__day">{clockDayLabel}</span>
				</span>
			{/if}
		</button>

		<button
			class="utility-button assistant-button"
			class:is-open={showAssistantDrawer}
			type="button"
			title={assistantButtonTitle}
			aria-label={assistantButtonTitle}
			onclick={showAssistantDrawer ? closeAssistantDrawer : openAssistantDrawer}
		>
			<Bot size={21} strokeWidth={2.35} aria-hidden="true" />
		</button>

		<button
			class="utility-button panic-button"
			class:is-active={panicIsActive}
			type="button"
			title={panicButtonTitle}
			aria-label={panicButtonTitle}
			disabled={isPanicBusy || isPanicLoading}
			onclick={handlePanicToggle}
		>
			<Flame size={21} strokeWidth={2.4} aria-hidden="true" />
			{#if panicIsActive && !isPanicBusy}
				<span class="panic-status-dot" aria-hidden="true"></span>
			{/if}
		</button>

		{#if user}
			<div class="account-switcher" bind:this={accountMenuElement}>
				<button
					class="utility-button user-pill account-trigger"
					class:is-open={accountMenuOpen}
					type="button"
					aria-haspopup="menu"
					aria-expanded={accountMenuOpen}
					aria-label={`Switch account, currently ${user.username}`}
					title={`Switch account, currently ${user.username}`}
					onclick={toggleAccountMenu}
				>
					<span class="account-avatar" style={getAccountAvatarStyle(user)} aria-hidden="true">
						{getAccountInitial(user.username)}
					</span>
				</button>

				{#if accountMenuOpen}
					<div class="account-menu" role="menu" aria-label="Account switcher">
						<div class="account-menu__accounts">
							{#each accountMenuAccounts as account (account.token)}
								<button
									class="account-menu__item"
									class:is-current={account.token === $session.token}
									type="button"
									role="menuitemradio"
									aria-checked={account.token === $session.token}
									disabled={switchingAccountToken !== null}
									onclick={() => handleSwitchAccount(account)}
								>
									<span
										class="account-avatar account-avatar--menu"
										style={getAccountAvatarStyle(account.user)}
										aria-hidden="true"
									>
										{getAccountInitial(account.user.username)}
									</span>
									<span class="account-menu__name">{formatAccountName(account.user.username)}</span>
									{#if account.token === $session.token}
										<Check size={16} strokeWidth={2.6} aria-hidden="true" />
									{/if}
								</button>
							{/each}
						</div>

						<button
							class="account-menu__item account-menu__command"
							type="button"
							role="menuitem"
							onclick={handleAddAccount}
						>
							<span class="account-command-icon" aria-hidden="true">
								<Plus size={15} strokeWidth={2.6} />
							</span>
							<span>Add account</span>
						</button>

						<div class="account-menu__separator"></div>

						<button
							class="account-menu__item account-menu__command"
							type="button"
							role="menuitem"
							onclick={handleAccountSettings}
						>
							<span class="account-command-icon" aria-hidden="true">
								<Settings size={15} strokeWidth={2.45} />
							</span>
							<span>Settings for {formatAccountName(user.username)}</span>
						</button>

						{#if accountMenuError}
							<p class="account-menu__error">{accountMenuError}</p>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	</nav>

	<div class="current-hour-trace" aria-label="Current hour activity trace">
		{#each currentHourTrace as minute}
			<span
				class:current-hour-trace__minute-active={minute.active}
				class:current-hour-trace__minute-panic={minute.panicking}
				class="current-hour-trace__minute"
				style={minute.fill ? `--trace-fill: ${minute.fill}; --trace-glow: ${minute.glow};` : ''}
				title={minute.label}
				aria-hidden="true"
			></span>
		{/each}
	</div>
</header>

<nav class="mobile-bottom-nav" aria-label="Primary">
	<ul
		bind:this={mobileRouteListElement}
		class={`mobile-bottom-nav__list ${activeNavIndex >= 0 ? 'has-active-route' : ''}`}
		style={mobileNavIndicatorStyle}
	>
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

{#if panicError}
	<p class="panic-error">{panicError}</p>
{/if}

<AssistantDrawer
	open={showAssistantDrawer}
	username={user?.username || ''}
	{currentPath}
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
				<button
					class="panic-modal__button panic-modal__button-primary"
					type="submit"
					disabled={isPanicBusy}
				>
					{isPanicBusy ? 'Saving...' : 'Return to focus'}
				</button>
			</div>
		</form>
	</div>
{/if}

<style>
	header {
		position: relative;
		z-index: 80;
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 1rem;
		padding: 0.9rem 1rem 1rem;
		background: linear-gradient(
			180deg,
			var(--surface-1),
			color-mix(in srgb, var(--surface-1) 64%, transparent)
		);
		backdrop-filter: blur(16px);
		border-bottom: 1px solid var(--surface-border);
		box-shadow: var(--surface-shadow);
	}

	.current-hour-trace {
		position: absolute;
		right: 0;
		bottom: 0;
		left: 0;
		z-index: 0;
		display: grid;
		grid-template-columns: repeat(60, minmax(0, 1fr));
		gap: 1px;
		height: 6px;
		padding: 0 1px;
		overflow: visible;
		background: color-mix(in srgb, var(--color-muted) 10%, transparent);
		pointer-events: none;
	}

	.current-hour-trace__minute {
		position: relative;
		min-width: 0;
		border-radius: 1.5px 1.5px 0 0;
		background: color-mix(in srgb, var(--color-muted) 18%, transparent);
	}

	.current-hour-trace__minute::after {
		position: absolute;
		top: 1px;
		right: 1px;
		width: 3px;
		height: 3px;
		border-radius: 999px;
		background: #ff2f2f;
		pointer-events: none;
		content: '';
		opacity: 0;
	}

	.current-hour-trace__minute-active {
		background: var(--trace-fill);
		box-shadow:
			0 4px 10px color-mix(in srgb, var(--trace-glow) 62%, transparent),
			0 9px 20px color-mix(in srgb, var(--trace-glow) 34%, transparent);
	}

	.current-hour-trace__minute-panic {
		&::after {
			opacity: 1;
		}
	}

	.corner {
		position: relative;
		z-index: 1;
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
		color: var(--color-heading);
	}

	.header-actions {
		position: relative;
		z-index: 1;
		justify-self: center;
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

	.desktop-route-list {
		position: relative;
		isolation: isolate;
		padding: 0.28rem;
		margin: 0;
		display: flex;
		align-items: stretch;
		gap: 0.16rem;
		list-style: none;
		overflow: hidden;
		background: var(--surface-1);
		border: 1px solid var(--surface-border);
		border-radius: 999px;
		box-shadow: var(--surface-shadow), var(--surface-inset);
	}

	.desktop-route-list::before,
	.mobile-bottom-nav__list::before {
		position: absolute;
		top: 0;
		left: 0;
		z-index: 0;
		width: var(--active-nav-width, 0);
		height: var(--active-nav-height, 0);
		border-radius: 999px;
		background: var(--accent-gradient);
		box-shadow: 0 14px 28px color-mix(in srgb, var(--color-accent) 32%, transparent);
		pointer-events: none;
		content: '';
		opacity: 0;
		transform: translate3d(var(--active-nav-left, 0), var(--active-nav-top, 0), 0);
		transition:
			transform 0.34s cubic-bezier(0.2, 0.8, 0.2, 1),
			width 0.34s cubic-bezier(0.2, 0.8, 0.2, 1),
			height 0.34s cubic-bezier(0.2, 0.8, 0.2, 1),
			opacity 0.16s ease,
			box-shadow 0.2s ease;
	}

	.desktop-route-list.has-active-route::before,
	.mobile-bottom-nav__list.has-active-route::before {
		opacity: 1;
	}

	@media (prefers-reduced-motion: reduce) {
		.desktop-route-list::before,
		.mobile-bottom-nav__list::before {
			transition: none;
		}
	}

	.desktop-route-list li {
		position: relative;
		z-index: 1;
		min-width: 0;
	}

	.desktop-route-list a {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.15rem;
		width: clamp(4.1rem, 5.2vw, 5.35rem);
		min-height: 2.72rem;
		padding: 0.34rem 0.58rem 0.3rem;
		border-radius: 999px;
		color: var(--color-muted);
		font-weight: 800;
		text-decoration: none;
		transition:
			color 0.2s ease,
			background-color 0.2s ease,
			transform 0.2s ease,
			box-shadow 0.2s ease;
	}

	.desktop-route-list a :global(svg) {
		width: 1.08rem;
		height: 1.08rem;
		flex: 0 0 auto;
	}

	.desktop-route-list a span {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.56rem;
		font-weight: 900;
		line-height: 1;
		letter-spacing: 0;
		text-transform: none;
	}

	.desktop-route-list a:hover {
		transform: translateY(-1px);
		color: var(--color-accent);
	}

	.desktop-route-list a[aria-current='page'] {
		color: var(--color-accent-contrast);
	}

	.header-utilities {
		position: relative;
		z-index: 1;
		isolation: isolate;
		justify-self: end;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.42rem;
		padding: 0.34rem;
		border: 1px solid color-mix(in srgb, var(--surface-border) 82%, transparent);
		border-radius: 999px;
		background:
			radial-gradient(
				circle at top,
				color-mix(in srgb, var(--color-accent) 14%, transparent),
				transparent 44%
			),
			color-mix(in srgb, var(--surface-2) 88%, transparent);
		box-shadow: var(--surface-shadow-strong), var(--surface-inset);
		backdrop-filter: blur(20px);
	}

	.utility-button {
		--utility-hover-ring: color-mix(in srgb, var(--color-accent) 16%, transparent);
		--utility-hover-shadow: color-mix(in srgb, var(--color-accent) 14%, transparent);

		position: relative;
		width: 2.74rem;
		min-width: 2.74rem;
		height: 2.74rem;
		min-height: 2.74rem;
		padding: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		appearance: none;
		border: 1px solid color-mix(in srgb, var(--surface-border) 80%, transparent);
		border-radius: 999px;
		color: var(--color-muted);
		font: inherit;
		text-decoration: none;
		cursor: pointer;
		transform-origin: center;
		transition:
			color 0.18s ease,
			background-color 0.18s ease,
			border-color 0.18s ease,
			box-shadow 0.18s ease,
			transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
		will-change: transform;
	}

	.utility-button:hover {
		z-index: 2;
		transform: scale(1.065);
		color: var(--color-heading);
		box-shadow:
			0 0 0 1px var(--utility-hover-ring),
			0 16px 32px var(--utility-hover-shadow),
			var(--surface-shadow);
	}

	.utility-button:active {
		transform: scale(0.975);
	}

	.utility-button:focus-visible {
		outline: none;
		box-shadow:
			0 0 0 3px var(--focus-ring),
			var(--surface-shadow);
	}

	.utility-button:disabled {
		cursor: wait;
		opacity: 0.72;
		transform: none;
	}

	.clock-button {
		--clock-digital-color: var(--color-theme-2);
		--clock-digital-colon-shadow: 0 0 6px color-mix(in srgb, var(--color-theme-2) 58%, transparent);
		--clock-digital-day-shadow: 0 0 5px color-mix(in srgb, var(--color-theme-2) 38%, transparent);
		--clock-digital-segment-shadow:
			0 0 5px color-mix(in srgb, var(--color-theme-2) 52%, transparent),
			0 0 9px color-mix(in srgb, var(--color-theme-1) 26%, transparent);
		--clock-digital-time-filter: drop-shadow(
			0 0 5px color-mix(in srgb, var(--color-theme-2) 42%, transparent)
		);

		overflow: hidden;
		background:
			radial-gradient(
				circle at 28% 18%,
				color-mix(in srgb, var(--color-theme-1) 18%, transparent),
				transparent 48%
			),
			linear-gradient(
				135deg,
				color-mix(in srgb, var(--surface-3) 94%, transparent),
				color-mix(in srgb, var(--surface-2) 98%, transparent)
			);
		border: 1px solid color-mix(in srgb, var(--color-theme-2) 24%, var(--surface-border));
		box-shadow: var(--surface-shadow);
		color: var(--color-heading);
	}

	.clock-button.is-digital {
		width: 3.72rem;
		min-width: 3.72rem;
		padding: 0 0.42rem;
		background: color-mix(in srgb, var(--surface-3) 94%, var(--color-theme-2) 6%);
	}

	.clock-analog {
		--clock-hour-length: 0.62rem;
		--clock-mark-radius: 1.02rem;
		--clock-minute-length: 0.9rem;

		position: relative;
		width: calc(100% - 0.1rem);
		height: calc(100% - 0.1rem);
		display: block;
		border-radius: 999px;
		background: radial-gradient(
			circle at 50% 38%,
			color-mix(in srgb, var(--surface-1) 92%, var(--color-theme-1) 8%),
			color-mix(in srgb, var(--surface-2) 96%, var(--color-theme-2) 4%) 66%
		);
		border: 1px solid color-mix(in srgb, var(--color-theme-2) 34%, var(--surface-border));
		box-shadow:
			inset 0 1px 0 color-mix(in srgb, var(--color-accent-contrast) 34%, transparent),
			inset 0 -8px 16px color-mix(in srgb, var(--color-theme-2) 10%, transparent);
	}

	.clock-analog__mark {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 0.17rem;
		height: 0.17rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--color-muted) 58%, var(--color-theme-2));
		transform: translate(-50%, -50%) rotate(var(--clock-mark-angle))
			translateY(calc(var(--clock-mark-radius) * -1));
	}

	.clock-analog__hand {
		position: absolute;
		left: 50%;
		bottom: 50%;
		border-radius: 999px;
		transform-origin: 50% 100%;
		box-shadow: 0 4px 9px color-mix(in srgb, var(--color-heading) 14%, transparent);
	}

	.clock-analog__hand-hour {
		width: 0.18rem;
		height: var(--clock-hour-length);
		background: var(--color-theme-1);
		transform: translateX(-50%) rotate(var(--hour-rotation));
	}

	.clock-analog__hand-minute {
		width: 0.13rem;
		height: var(--clock-minute-length);
		background: var(--color-theme-2);
		transform: translateX(-50%) rotate(var(--minute-rotation));
	}

	.clock-analog__pin {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 0.33rem;
		height: 0.33rem;
		border: 2px solid color-mix(in srgb, var(--surface-1) 72%, transparent);
		border-radius: 999px;
		background: var(--color-accent);
		box-shadow: 0 5px 10px color-mix(in srgb, var(--color-accent) 22%, transparent);
		transform: translate(-50%, -50%);
	}

	.clock-digital {
		--clock-digital-font:
			'DS-Digital', 'DSEG7 Classic', 'Digital-7', 'OCR A Std', ui-monospace, SFMono-Regular, Menlo,
			Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;

		width: 100%;
		max-width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.12rem;
		font-family: var(--clock-digital-font);
		font-weight: 900;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0;
		line-height: 1;
	}

	.clock-digital__time {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.055rem;
		filter: var(--clock-digital-time-filter);
	}

	.clock-digit {
		position: relative;
		width: 0.43rem;
		height: 0.9rem;
		flex: 0 0 0.43rem;
	}

	.clock-digit__segment {
		position: absolute;
		border-radius: 999px;
		background: color-mix(in srgb, var(--color-muted) 14%, transparent);
		opacity: 0.45;
		transition:
			background-color 0.18s ease,
			box-shadow 0.18s ease,
			opacity 0.18s ease;
	}

	.clock-digit__segment.is-on {
		background: var(--clock-digital-color);
		box-shadow: var(--clock-digital-segment-shadow);
		opacity: 1;
	}

	.clock-digit__segment[data-segment='a'],
	.clock-digit__segment[data-segment='d'],
	.clock-digit__segment[data-segment='g'] {
		left: 0.1rem;
		right: 0.1rem;
		height: 0.08rem;
	}

	.clock-digit__segment[data-segment='a'] {
		top: 0;
	}

	.clock-digit__segment[data-segment='d'] {
		bottom: 0;
	}

	.clock-digit__segment[data-segment='g'] {
		top: calc(50% - 0.04rem);
	}

	.clock-digit__segment[data-segment='b'],
	.clock-digit__segment[data-segment='c'],
	.clock-digit__segment[data-segment='e'],
	.clock-digit__segment[data-segment='f'] {
		width: 0.08rem;
		height: 0.36rem;
	}

	.clock-digit__segment[data-segment='b'] {
		top: 0.07rem;
		right: 0;
	}

	.clock-digit__segment[data-segment='c'] {
		right: 0;
		bottom: 0.07rem;
	}

	.clock-digit__segment[data-segment='e'] {
		bottom: 0.07rem;
		left: 0;
	}

	.clock-digit__segment[data-segment='f'] {
		top: 0.07rem;
		left: 0;
	}

	.clock-digital__colon {
		width: 0.12rem;
		height: 0.9rem;
		display: grid;
		place-items: center;
		gap: 0.18rem;
		flex: 0 0 0.12rem;
	}

	.clock-digital__colon span {
		width: 0.08rem;
		height: 0.08rem;
		border-radius: 999px;
		background: var(--clock-digital-color);
		box-shadow: var(--clock-digital-colon-shadow);
	}

	.clock-digital__day {
		max-width: 100%;
		overflow: hidden;
		color: color-mix(in srgb, var(--clock-digital-color) 78%, var(--color-muted));
		font-family: var(--clock-digital-font);
		font-size: 0.47rem;
		font-weight: 900;
		letter-spacing: 0.04em;
		line-height: 1;
		text-shadow: var(--clock-digital-day-shadow);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.panic-button {
		--panic-active-end: color-mix(in srgb, var(--color-danger) 74%, var(--color-warning));
		--panic-active-shadow: color-mix(in srgb, var(--color-danger) 32%, transparent);
		--panic-active-start: var(--color-danger);
		--panic-button-end: color-mix(in srgb, var(--color-warning) 72%, var(--color-danger));
		--panic-button-shadow: color-mix(in srgb, var(--color-warning) 28%, transparent);
		--panic-button-start: var(--color-warning);
		--panic-button-text: var(--color-accent-contrast);
		--utility-hover-ring: color-mix(in srgb, var(--panic-button-start) 28%, transparent);
		--utility-hover-shadow: var(--panic-button-shadow);

		border: 0;
		background: linear-gradient(135deg, var(--panic-button-start), var(--panic-button-end));
		box-shadow: 0 14px 28px var(--panic-button-shadow);
		color: var(--panic-button-text);
	}

	.assistant-button {
		background:
			radial-gradient(
				circle at top left,
				color-mix(in srgb, var(--color-accent) 20%, transparent),
				transparent 46%
			),
			linear-gradient(
				135deg,
				color-mix(in srgb, var(--surface-3) 92%, transparent),
				color-mix(in srgb, var(--surface-2) 96%, transparent)
			);
		border: 1px solid color-mix(in srgb, var(--color-accent) 20%, var(--surface-border));
		box-shadow: var(--surface-shadow);
		color: var(--color-heading);
	}

	.panic-button.is-active {
		background: linear-gradient(135deg, var(--panic-active-start), var(--panic-active-end));
		box-shadow: 0 14px 28px var(--panic-active-shadow);
	}

	:global(:root[data-theme='light']) .clock-button,
	:global(:root[data-theme='magica-pink']) .clock-button,
	:global(:root[data-theme='candy-apple-green']) .clock-button,
	:global(:root[data-theme='candy-cloud']) .clock-button,
	:global(:root[data-theme='kawaii']) .clock-button,
	:global(:root[data-theme='ancient-book']) .clock-button,
	:global(:root[data-theme='tea-and-leaves']) .clock-button,
	:global(:root[data-theme='lain']) .clock-button,
	:global(:root[data-theme='ultra-white']) .clock-button {
		--clock-digital-colon-shadow: none;
		--clock-digital-day-shadow: none;
		--clock-digital-segment-shadow: none;
		--clock-digital-time-filter: none;
	}

	:global(:root[data-theme='light']) .panic-button,
	:global(:root[data-theme='magica-pink']) .panic-button,
	:global(:root[data-theme='candy-apple-green']) .panic-button,
	:global(:root[data-theme='candy-cloud']) .panic-button,
	:global(:root[data-theme='kawaii']) .panic-button,
	:global(:root[data-theme='ancient-book']) .panic-button,
	:global(:root[data-theme='tea-and-leaves']) .panic-button,
	:global(:root[data-theme='lain']) .panic-button,
	:global(:root[data-theme='ultra-white']) .panic-button {
		--panic-active-end: #ff7a1a;
		--panic-active-shadow: rgba(255, 110, 24, 0.34);
		--panic-active-start: #ff3f1f;
		--panic-button-end: #ff6a00;
		--panic-button-shadow: rgba(255, 132, 22, 0.32);
		--panic-button-start: #ffae1f;
		--panic-button-text: #ffffff;
	}

	.panic-status-dot {
		position: absolute;
		top: 0.42rem;
		right: 0.42rem;
		width: 0.46rem;
		height: 0.46rem;
		border-radius: 999px;
		background: var(--color-danger);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent-contrast) 65%, transparent);
	}

	.assistant-button.is-open {
		border-color: color-mix(in srgb, var(--color-accent) 42%, var(--surface-border));
		background: var(--accent-gradient);
		color: var(--color-accent-contrast);
		box-shadow:
			0 0 0 3px var(--focus-ring),
			0 14px 28px color-mix(in srgb, var(--color-accent) 28%, transparent);
	}

	.user-pill {
		background: var(--surface-1);
	}

	.user-pill.is-open {
		background: color-mix(in srgb, var(--color-accent) 16%, var(--surface-2));
		color: var(--color-accent);
		box-shadow: 0 14px 28px color-mix(in srgb, var(--color-accent) 18%, transparent);
	}

	.account-switcher {
		position: relative;
		z-index: 3;
		display: inline-flex;
	}

	.account-trigger {
		overflow: hidden;
	}

	.account-trigger .account-avatar {
		width: 100%;
		height: 100%;
		font-size: 0.98rem;
	}

	.account-avatar {
		width: 1.82rem;
		height: 1.82rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: 0 0 auto;
		border-radius: 999px;
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--account-swatch-0) 86%, var(--account-swatch-1)),
			var(--account-swatch-2)
		);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.42),
			0 8px 18px color-mix(in srgb, var(--account-swatch-2) 28%, transparent);
		color: var(--account-avatar-text);
		font-size: 0.82rem;
		font-weight: 900;
		line-height: 1;
		text-transform: uppercase;
	}

	.account-menu {
		position: absolute;
		top: calc(100% + 0.55rem);
		right: 0;
		z-index: 1000;
		width: min(18rem, calc(100vw - 1.5rem));
		display: grid;
		gap: 0.28rem;
		padding: 0.45rem;
		border: 1px solid color-mix(in srgb, var(--surface-border) 88%, transparent);
		border-radius: 18px;
		background: color-mix(in srgb, var(--surface-2) 96%, transparent);
		box-shadow: var(--surface-shadow-strong), var(--surface-inset);
		backdrop-filter: blur(22px);
	}

	.account-menu__accounts {
		display: grid;
		gap: 0.2rem;
	}

	.account-menu__item {
		width: 100%;
		min-width: 0;
		min-height: 2.95rem;
		padding: 0.52rem 0.6rem;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.58rem;
		border: 0;
		border-radius: 14px;
		background: transparent;
		color: var(--color-muted);
		font: inherit;
		font-size: 0.86rem;
		font-weight: 800;
		text-align: left;
		cursor: pointer;
		transition:
			background-color 0.16s ease,
			color 0.16s ease,
			transform 0.16s ease;
	}

	.account-menu__item:hover {
		transform: translateY(-1px);
		background: color-mix(in srgb, var(--color-accent) 10%, var(--surface-1));
		color: var(--color-heading);
	}

	.account-menu__item:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--focus-ring);
	}

	.account-menu__item:disabled {
		cursor: wait;
		opacity: 0.72;
		transform: none;
	}

	.account-menu__item.is-current {
		background: color-mix(in srgb, var(--color-accent) 14%, var(--surface-1));
		color: var(--color-heading);
	}

	.account-avatar--menu {
		width: 2rem;
		height: 2rem;
		font-size: 0.86rem;
	}

	.account-menu__name,
	.account-menu__command span:last-child {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.account-menu__command {
		grid-template-columns: auto minmax(0, 1fr);
		color: var(--color-muted);
	}

	.account-command-icon {
		width: 2rem;
		height: 2rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		background: var(--surface-muted);
		color: var(--color-accent);
	}

	.account-menu__separator {
		height: 1px;
		margin: 0.18rem 0.2rem;
		background: var(--surface-border-strong);
	}

	.account-menu__error {
		margin: 0.2rem 0.25rem 0.1rem;
		color: var(--color-danger);
		font-size: 0.76rem;
		font-weight: 700;
		line-height: 1.25;
	}

	.panic-error {
		margin: 0;
		padding: 0 1rem 0.75rem;
		font-size: 0.78rem;
		font-weight: 700;
		color: var(--color-warning);
		text-align: center;
	}

	.panic-modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 90;
		display: grid;
		place-items: center;
		padding: 1.25rem;
		background: color-mix(in srgb, var(--app-bg-color) 58%, transparent);
		backdrop-filter: blur(10px);
	}

	.panic-modal {
		width: min(100%, 34rem);
		display: grid;
		gap: 1rem;
		padding: 1.25rem;
		border-radius: 24px;
		background:
			linear-gradient(
				180deg,
				color-mix(in srgb, var(--surface-3) 96%, transparent),
				color-mix(in srgb, var(--surface-2) 94%, transparent)
			),
			linear-gradient(
				135deg,
				color-mix(in srgb, var(--color-warning) 16%, transparent),
				color-mix(in srgb, var(--color-danger) 12%, transparent)
			);
		border: 1px solid color-mix(in srgb, var(--color-danger) 18%, var(--surface-border));
		box-shadow: var(--surface-shadow-strong), var(--surface-inset);
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
		color: var(--color-warning);
	}

	.panic-modal h2 {
		margin: 0;
		font-size: 1.55rem;
		letter-spacing: -0.04em;
		color: var(--color-heading);
	}

	.panic-modal__close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.4rem;
		height: 2.4rem;
		border: 0;
		border-radius: 999px;
		background: var(--surface-2);
		color: var(--color-muted);
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
		color: var(--color-muted);
	}

	.panic-modal textarea,
	.panic-modal input[type='range'] {
		width: 100%;
	}

	.panic-modal textarea {
		padding: 0.9rem 1rem;
		border-radius: 18px;
		border: 1px solid var(--field-border);
		background: var(--field-bg);
		box-shadow: var(--surface-inset);
		font: inherit;
		color: var(--color-text);
		resize: vertical;
	}

	.panic-modal textarea:focus,
	.panic-modal input[type='range']:focus {
		outline: none;
		box-shadow:
			0 0 0 3px color-mix(in srgb, var(--color-danger) 16%, transparent),
			var(--surface-inset);
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
		color: var(--color-warning);
	}

	.panic-modal__charge-scale {
		font-size: 0.74rem;
		font-weight: 700;
		color: var(--color-soft);
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
		background: var(--surface-2);
		color: var(--color-muted);
		border: 1px solid var(--surface-border-strong);
	}

	.panic-modal__button-primary {
		background: linear-gradient(
			135deg,
			var(--color-danger),
			color-mix(in srgb, var(--color-danger) 74%, var(--color-warning))
		);
		box-shadow: 0 14px 28px color-mix(in srgb, var(--color-danger) 26%, transparent);
		color: var(--color-accent-contrast);
	}

	@media (max-width: 1024px) {
		header {
			position: sticky;
			top: 0;
			z-index: 80;
			grid-template-columns: auto 1fr auto;
			gap: 0.55rem;
			padding: 0.68rem 0.85rem;
		}

		.header-actions {
			display: none;
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

		.header-utilities {
			gap: 0.34rem;
			padding: 0.28rem;
		}

		.utility-button {
			width: 2.58rem;
			min-width: 2.58rem;
			height: 2.58rem;
			min-height: 2.58rem;
		}

		.clock-button.is-digital {
			width: 3.5rem;
			min-width: 3.5rem;
			padding-inline: 0.4rem;
		}

		.clock-analog {
			--clock-hour-length: 0.59rem;
			--clock-mark-radius: 0.95rem;
			--clock-minute-length: 0.84rem;
		}

		.clock-digital__day {
			font-size: 0.45rem;
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
			position: relative;
			isolation: isolate;
			width: min(100%, 44rem);
			min-height: 4.6rem;
			margin: 0 auto;
			padding: 0.5rem;
			display: grid;
			grid-template-columns: repeat(5, minmax(0, 1fr));
			gap: 0.12rem;
			background: var(--surface-2);
			border: 1px solid var(--surface-border);
			border-radius: 999px;
			box-shadow: var(--surface-shadow-strong), var(--surface-inset);
			backdrop-filter: blur(22px);
			overflow: hidden;
			pointer-events: auto;
		}

		.mobile-bottom-nav li {
			position: relative;
			z-index: 1;
			min-width: 0;
		}

		.mobile-bottom-nav__item {
			position: relative;
			z-index: 1;
			height: 100%;
			min-height: 3.45rem;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: 0.18rem;
			padding: 0.25rem 0.1rem;
			border-radius: 999px;
			color: var(--color-muted);
			text-decoration: none;
			transition:
				color 0.18s ease,
				background-color 0.18s ease,
				transform 0.18s ease,
				box-shadow 0.18s ease;
		}

		.mobile-bottom-nav__item:hover {
			transform: translateY(-1px);
			color: var(--color-accent);
		}

		.mobile-bottom-nav__item[aria-current='page'] {
			color: var(--color-accent-contrast);
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
			padding-inline: 0.72rem;
		}

		.corner img {
			width: 2.05rem;
			height: 2.05rem;
		}

		.utility-button {
			width: 2.52rem;
			min-width: 2.52rem;
			height: 2.52rem;
			min-height: 2.52rem;
		}

		.clock-button.is-digital {
			width: 3.35rem;
			min-width: 3.35rem;
			padding-inline: 0.34rem;
		}

		.clock-analog {
			--clock-hour-length: 0.58rem;
			--clock-mark-radius: 0.93rem;
			--clock-minute-length: 0.82rem;
		}

		.clock-digital__day {
			font-size: 0.43rem;
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
