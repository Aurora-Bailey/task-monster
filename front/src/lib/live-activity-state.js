export function buildActiveMembershipFingerprint(tasks) {
	return (tasks ?? [])
		.map((task) => task?.id)
		.filter(Boolean)
		.sort()
		.join('|');
}

export function buildActiveActivityFingerprint(tasks) {
	return JSON.stringify(
		(tasks ?? [])
			.map((task) => ({
				id: task?.id ?? '',
				updatedAt: task?.updatedAt ?? '',
				activatedAt: task?.activatedAt ?? '',
				activeToday: task?.activeToday === true,
				archived: task?.archived === true,
				tallyCount: task?.tallyCount ?? null,
				instanceNote: task?.instanceNote ?? null,
				note: task?.note ?? null,
				nextDueAt: task?.nextDueAt ?? null,
				hueShift: task?.hueShift ?? null,
				panicRuns: (task?.taskPanicLog ?? []).map((panicRun) => ({
					id: panicRun?.id ?? '',
					startedAt: panicRun?.startedAt ?? '',
					active: panicRun?.active === true
				}))
			}))
			.sort((left, right) => left.id.localeCompare(right.id))
	);
}

export function mergeProtectedTaskSnapshot(
	currentTasks,
	nextTasks,
	protectedTaskIds,
	protectedFields = ['note', 'instanceNote']
) {
	const currentTasksById = new Map(currentTasks.map((task) => [task.id, task]));
	const mergedTasks = nextTasks.map((task) => {
		const currentTask = currentTasksById.get(task.id);

		if (!protectedTaskIds.has(task.id) || !currentTask) {
			return task;
		}

		return protectedFields.reduce(
			(mergedTask, field) => ({ ...mergedTask, [field]: currentTask[field] }),
			{ ...task }
		);
	});

	for (const taskId of protectedTaskIds) {
		const currentTask = currentTasksById.get(taskId);

		if (currentTask && !mergedTasks.some((task) => task.id === taskId)) {
			mergedTasks.push(currentTask);
		}
	}

	return mergedTasks;
}

export function mergeDoneSnapshots(currentItems, nextItems, protectedRunIds) {
	const currentItemsById = new Map(currentItems.map((task) => [task.id, task]));
	const mergedItems = [];
	const seenIds = new Set();
	const protectedFields = ['note', 'startedAt', 'endedAt', 'completedAt'];

	for (const item of [...nextItems, ...currentItems]) {
		if (seenIds.has(item.id)) {
			continue;
		}

		seenIds.add(item.id);
		const currentItem = currentItemsById.get(item.id);

		if (!currentItem || !protectedRunIds.has(item.id)) {
			mergedItems.push(item);
			continue;
		}

		mergedItems.push(
			protectedFields.reduce(
				(mergedItem, field) => ({ ...mergedItem, [field]: currentItem[field] }),
				{ ...item }
			)
		);
	}

	return mergedItems;
}
