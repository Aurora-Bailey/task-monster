import { browser } from '$app/environment';
import { writable } from 'svelte/store';

import { APP_REFRESH_EVENT } from './app-events';
import {
	buildActiveActivityFingerprint,
	buildActiveMembershipFingerprint
} from './live-activity-state';
import { PANIC_UPDATED_EVENT } from './panic-client';
import { session } from './session';
import { loadStatsHeatmap } from './stats-client';
import { loadActiveTasks, TASKS_UPDATED_EVENT } from './tasks-client';

export const LIVE_ACTIVITY_INTERVAL_MS = 30 * 1000;

const initialLiveActivity = {
	accountKey: '',
	activeTasks: [],
	activeLoaded: false,
	activeRevision: 0,
	activityRevision: 0,
	membershipRevision: 0,
	today: null,
	heatmapLoaded: false,
	heatmapRevision: 0,
	lastSyncedAt: null,
	error: ''
};

export const liveActivity = writable(initialLiveActivity);

let startCount = 0;
let sessionUnsubscribe = null;
let intervalId = null;
let minuteTimeoutId = null;
let activeRequest = null;
let heatmapRequest = null;
let heatmapQueued = false;
let generation = 0;
let activeFingerprint = '';
let membershipFingerprint = '';
let activeAccountKey = '';

function getLocalDay() {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const day = String(now.getDate()).padStart(2, '0');

	return `${year}-${month}-${day}`;
}

function getAccountKey(sessionState) {
	if (sessionState?.status !== 'authenticated') {
		return '';
	}

	return sessionState.user?.id || sessionState.user?.username || '';
}

function clearTimers() {
	if (intervalId !== null) {
		window.clearInterval(intervalId);
		intervalId = null;
	}

	if (minuteTimeoutId !== null) {
		window.clearTimeout(minuteTimeoutId);
		minuteTimeoutId = null;
	}
}

function scheduleMinuteRefresh() {
	if (!browser || document.hidden || !activeAccountKey) {
		return;
	}

	if (minuteTimeoutId !== null) {
		window.clearTimeout(minuteTimeoutId);
	}

	const delay = 60 * 1000 - (Date.now() % (60 * 1000)) + 75;
	minuteTimeoutId = window.setTimeout(() => {
		minuteTimeoutId = null;
		void syncHeatmap();
		scheduleMinuteRefresh();
	}, delay);
}

function scheduleVisiblePolling() {
	clearTimers();

	if (!browser || document.hidden || !activeAccountKey) {
		return;
	}

	intervalId = window.setInterval(() => {
		void syncActiveTasks();
	}, LIVE_ACTIVITY_INTERVAL_MS);
	scheduleMinuteRefresh();
}

async function syncHeatmap({ queueIfBusy = false } = {}) {
	if (!activeAccountKey || (browser && document.hidden)) {
		return;
	}

	if (heatmapRequest) {
		if (queueIfBusy) {
			heatmapQueued = true;
		}
		return heatmapRequest;
	}

	const requestGeneration = generation;
	const request = loadStatsHeatmap({
		startDay: getLocalDay(),
		count: 1,
		tzOffsetMinutes: new Date().getTimezoneOffset()
	})
		.then((heatmap) => {
			if (requestGeneration !== generation) {
				return;
			}

			liveActivity.update((current) => ({
				...current,
				today: heatmap.days?.[0] ?? null,
				heatmapLoaded: true,
				heatmapRevision: current.heatmapRevision + 1,
				error: ''
			}));
		})
		.catch((error) => {
			if (requestGeneration === generation) {
				liveActivity.update((current) => ({ ...current, error: error.message }));
			}
		})
		.finally(() => {
			if (heatmapRequest === request) {
				heatmapRequest = null;
			}

			if (!heatmapRequest && heatmapQueued) {
				heatmapQueued = false;
				void syncHeatmap();
			}
		});
	heatmapRequest = request;

	return request;
}

async function syncActiveTasks() {
	if (!activeAccountKey || (browser && document.hidden)) {
		return;
	}

	if (activeRequest) {
		return activeRequest;
	}

	const requestGeneration = generation;
	const request = loadActiveTasks()
		.then((tasks) => {
			if (requestGeneration !== generation) {
				return;
			}

			const nextActivityFingerprint = buildActiveActivityFingerprint(tasks);
			const nextMembershipFingerprint = buildActiveMembershipFingerprint(tasks);
			const activityChanged = activeFingerprint !== nextActivityFingerprint;
			const membershipChanged = membershipFingerprint !== nextMembershipFingerprint;
			activeFingerprint = nextActivityFingerprint;
			membershipFingerprint = nextMembershipFingerprint;

			liveActivity.update((current) => ({
				...current,
				activeTasks: tasks,
				activeLoaded: true,
				activeRevision: current.activeRevision + 1,
				activityRevision: current.activityRevision + (activityChanged ? 1 : 0),
				membershipRevision: current.membershipRevision + (membershipChanged ? 1 : 0),
				lastSyncedAt: new Date().toISOString(),
				error: ''
			}));

			if (activityChanged) {
				void syncHeatmap({ queueIfBusy: true });
			}
		})
		.catch((error) => {
			if (requestGeneration === generation) {
				liveActivity.update((current) => ({ ...current, error: error.message }));
			}
		})
		.finally(() => {
			if (activeRequest === request) {
				activeRequest = null;
			}
		});
	activeRequest = request;

	return request;
}

export function requestLiveActivitySync({ heatmap = true } = {}) {
	if (!browser || document.hidden || !activeAccountKey) {
		return;
	}

	void syncActiveTasks();

	if (heatmap) {
		void syncHeatmap();
	}
}

function resetForAccount(accountKey) {
	generation += 1;
	activeAccountKey = accountKey;
	activeRequest = null;
	heatmapRequest = null;
	activeFingerprint = '';
	membershipFingerprint = '';
	heatmapQueued = false;
	liveActivity.set({ ...initialLiveActivity, accountKey });
	scheduleVisiblePolling();

	if (accountKey && !document.hidden) {
		void syncActiveTasks();
		void syncHeatmap();
	}
}

function handleVisibilityChange() {
	scheduleVisiblePolling();

	if (!document.hidden) {
		requestLiveActivitySync();
	}
}

function handleFocus() {
	requestLiveActivitySync();
}

function handleTaskUpdated() {
	requestLiveActivitySync();
}

function handlePanicUpdated() {
	requestLiveActivitySync();
}

function handleAppRefresh(event) {
	if (
		event.detail?.refresh?.tasks === true ||
		event.detail?.refresh?.stats === true ||
		event.detail?.refresh?.panic === true
	) {
		requestLiveActivitySync();
	}
}

export function startLiveActivity() {
	if (!browser) {
		return () => {};
	}

	startCount += 1;

	if (startCount === 1) {
		sessionUnsubscribe = session.subscribe((sessionState) => {
			const nextAccountKey = getAccountKey(sessionState);

			if (nextAccountKey !== activeAccountKey) {
				resetForAccount(nextAccountKey);
			}
		});
		document.addEventListener('visibilitychange', handleVisibilityChange);
		window.addEventListener('focus', handleFocus);
		window.addEventListener('online', handleFocus);
		window.addEventListener(TASKS_UPDATED_EVENT, handleTaskUpdated);
		window.addEventListener(PANIC_UPDATED_EVENT, handlePanicUpdated);
		window.addEventListener(APP_REFRESH_EVENT, handleAppRefresh);
	}

	return () => {
		startCount -= 1;

		if (startCount > 0) {
			return;
		}

		startCount = 0;
		generation += 1;
		clearTimers();
		sessionUnsubscribe?.();
		sessionUnsubscribe = null;
		document.removeEventListener('visibilitychange', handleVisibilityChange);
		window.removeEventListener('focus', handleFocus);
		window.removeEventListener('online', handleFocus);
		window.removeEventListener(TASKS_UPDATED_EVENT, handleTaskUpdated);
		window.removeEventListener(PANIC_UPDATED_EVENT, handlePanicUpdated);
		window.removeEventListener(APP_REFRESH_EVENT, handleAppRefresh);
	};
}
