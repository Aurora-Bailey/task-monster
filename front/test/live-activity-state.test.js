import assert from 'node:assert/strict';
import test from 'node:test';

import {
	buildActiveActivityFingerprint,
	buildActiveMembershipFingerprint,
	mergeDoneSnapshots,
	mergeProtectedTaskSnapshot
} from '../src/lib/live-activity-state.js';

test('active fingerprints are order independent and ignore ticking runtime fields', () => {
	const first = {
		id: 'a',
		updatedAt: '2026-07-15T00:00:00.000Z',
		activeToday: true,
		effectiveMilliseconds: 1_000
	};
	const second = {
		id: 'b',
		updatedAt: '2026-07-15T00:00:00.000Z',
		activeToday: true,
		effectiveMilliseconds: 2_000
	};

	assert.equal(buildActiveMembershipFingerprint([second, first]), 'a|b');
	assert.equal(
		buildActiveActivityFingerprint([first, second]),
		buildActiveActivityFingerprint([
			{ ...second, effectiveMilliseconds: 30_000 },
			{ ...first, effectiveMilliseconds: 30_000 }
		])
	);
	assert.notEqual(
		buildActiveActivityFingerprint([first, second]),
		buildActiveActivityFingerprint([{ ...first, tallyCount: 1 }, second])
	);
});

test('protected task drafts and membership survive an incoming snapshot', () => {
	const currentTasks = [
		{ id: 'editing', name: 'Editing', note: 'local draft', instanceNote: 'local run draft' },
		{ id: 'finished', name: 'Finished' }
	];
	const nextTasks = [{ id: 'editing', name: 'Editing renamed', note: 'server note' }];

	assert.deepEqual(
		mergeProtectedTaskSnapshot(currentTasks, nextTasks, new Set(['editing', 'finished'])),
		[
			{
				id: 'editing',
				name: 'Editing renamed',
				note: 'local draft',
				instanceNote: 'local run draft'
			},
			{ id: 'finished', name: 'Finished' }
		]
	);
});

test('done reconciliation prepends new runs, deduplicates overlap, and protects edits', () => {
	const currentItems = [
		{ id: 'known', note: 'local note', startedAt: 'local-start' },
		{ id: 'older', note: 'older' }
	];
	const incomingItems = [
		{ id: 'new', note: 'new' },
		{ id: 'known', note: 'server note', startedAt: 'server-start' }
	];

	assert.deepEqual(mergeDoneSnapshots(currentItems, incomingItems, new Set(['known'])), [
		{ id: 'new', note: 'new' },
		{
			id: 'known',
			note: 'local note',
			startedAt: 'local-start',
			endedAt: undefined,
			completedAt: undefined
		},
		{ id: 'older', note: 'older' }
	]);
});
