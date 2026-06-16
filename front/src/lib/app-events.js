import { browser } from '$app/environment';

export const APP_REFRESH_EVENT = 'taskmonster:app-refresh';

export function dispatchAppRefresh(refresh) {
	if (!browser) {
		return;
	}

	window.dispatchEvent(
		new CustomEvent(APP_REFRESH_EVENT, {
			detail: {
				refresh: {
					tasks: refresh?.tasks === true,
					stats: refresh?.stats === true,
					panic: refresh?.panic === true
				}
			}
		})
	);
}
