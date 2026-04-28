const { ObjectId } = require('mongodb');

const { getUtcRangeForLocalDay } = require('./local-days');

const serializedPanicStatusJsonSchema = {
	type: 'object',
	required: ['day', 'active', 'startedAt', 'activeMilliseconds', 'totalMilliseconds', 'runCount'],
	properties: {
		day: { type: 'string' },
		active: { type: 'boolean' },
		startedAt: { type: ['string', 'null'] },
		activeMilliseconds: { type: 'integer' },
		totalMilliseconds: { type: 'integer' },
		runCount: { type: 'integer' }
	}
};

const serializedPanicLogItemJsonSchema = {
	type: 'object',
	required: ['id', 'startedAt', 'endedAt', 'milliseconds', 'note', 'emotionalCharge'],
	properties: {
		id: { type: 'string' },
		startedAt: { type: 'string' },
		endedAt: { type: 'string' },
		milliseconds: { type: 'integer' },
		note: { type: ['string', 'null'] },
		emotionalCharge: { type: ['integer', 'null'] }
	}
};

function serializePanicLogItem(panicRun, clippedWindow) {
	return {
		id: panicRun._id.toString(),
		startedAt: clippedWindow.effectiveStartedAt.toISOString(),
		endedAt: clippedWindow.effectiveEndedAt.toISOString(),
		milliseconds: clippedWindow.milliseconds,
		note: typeof panicRun.note === 'string' ? panicRun.note : null,
		emotionalCharge: Number.isInteger(panicRun.emotionalCharge)
			? panicRun.emotionalCharge
			: null
	};
}

function toObjectId(value) {
	return value instanceof ObjectId ? value : new ObjectId(value);
}

async function loadPanicRunsForDay(db, { userId, day }) {
	return db
		.collection('panic_runs')
		.find({
			userId: toObjectId(userId),
			day
		})
		.sort({
			startedAt: 1
		})
		.toArray();
}

async function loadOpenPanicRuns(db, { userId }) {
	return db
		.collection('panic_runs')
		.find({
			userId: toObjectId(userId),
			endedAt: null
		})
		.sort({
			startedAt: 1
		})
		.toArray();
}

async function loadPanicRunsOverlappingWindow(db, { userId, startedAt, endedAt }) {
	return db
		.collection('panic_runs')
		.find({
			userId: toObjectId(userId),
			startedAt: {
				$lt: endedAt
			},
			$or: [
				{
					endedAt: null
				},
				{
					endedAt: {
						$gt: startedAt
					}
				}
			]
		})
		.sort({
			startedAt: 1
		})
		.toArray();
}

async function loadPanicRunsOverlappingLocalDay(
	db,
	{ userId, day, timezoneOffsetMinutes }
) {
	const { startedAt, endedBefore } = getUtcRangeForLocalDay(day, timezoneOffsetMinutes);

	return loadPanicRunsOverlappingWindow(db, {
		userId,
		startedAt,
		endedAt: endedBefore
	});
}

function getWindowOverlapMilliseconds(startedAt, endedAt, leftStartedAt, leftEndedAt) {
	return Math.max(
		0,
		Math.min(endedAt.getTime(), leftEndedAt.getTime()) - Math.max(startedAt.getTime(), leftStartedAt.getTime())
	);
}

function getClippedPanicWindow(panicRun, { day, timezoneOffsetMinutes, now = new Date() }) {
	const { startedAt, endedBefore } = getUtcRangeForLocalDay(day, timezoneOffsetMinutes);
	const effectiveStartedAt = new Date(Math.max(panicRun.startedAt.getTime(), startedAt.getTime()));
	const rawEndedAt = panicRun.endedAt || now;
	const effectiveEndedAt = new Date(Math.min(rawEndedAt.getTime(), endedBefore.getTime()));
	const milliseconds = Math.max(0, effectiveEndedAt.getTime() - effectiveStartedAt.getTime());

	return {
		effectiveStartedAt,
		effectiveEndedAt,
		milliseconds
	};
}

function mergeWindowSegments(segments) {
	if (segments.length === 0) {
		return [];
	}

	const sortedSegments = [...segments].sort(
		(left, right) => left.effectiveStartedAt.getTime() - right.effectiveStartedAt.getTime()
	);
	const mergedSegments = [];

	for (const segment of sortedSegments) {
		const lastSegment = mergedSegments.at(-1);

		if (
			lastSegment &&
			segment.effectiveStartedAt.getTime() <= lastSegment.effectiveEndedAt.getTime()
		) {
			if (segment.effectiveEndedAt.getTime() > lastSegment.effectiveEndedAt.getTime()) {
				lastSegment.effectiveEndedAt = segment.effectiveEndedAt;
				lastSegment.milliseconds = Math.max(
					0,
					lastSegment.effectiveEndedAt.getTime() - lastSegment.effectiveStartedAt.getTime()
				);
			}

			continue;
		}

		mergedSegments.push({
			effectiveStartedAt: segment.effectiveStartedAt,
			effectiveEndedAt: segment.effectiveEndedAt,
			milliseconds: segment.milliseconds
		});
	}

	return mergedSegments;
}

function buildPanicStatus({ day, panicRuns, timezoneOffsetMinutes, now = new Date() }) {
	const clippedWindows = panicRuns
		.map((panicRun) => ({
			panicRun,
			clippedWindow: getClippedPanicWindow(panicRun, {
				day,
				timezoneOffsetMinutes,
				now
			})
		}))
		.filter(({ clippedWindow }) => clippedWindow.milliseconds > 0);
	const mergedWindows = mergeWindowSegments(
		clippedWindows.map(({ clippedWindow }) => clippedWindow)
	);
	const totalMilliseconds = mergedWindows.reduce(
		(total, clippedWindow) => total + clippedWindow.milliseconds,
		0
	);
	const activeRun = panicRuns
		.filter((panicRun) => !panicRun.endedAt)
		.sort((left, right) => right.startedAt.getTime() - left.startedAt.getTime())[0] ?? null;

	const activeMilliseconds = activeRun
		? getClippedPanicWindow(activeRun, {
				day,
				timezoneOffsetMinutes,
				now
			}).milliseconds
		: 0;

	return {
		day,
		active: Boolean(activeRun),
		startedAt: activeRun ? activeRun.startedAt.toISOString() : null,
		activeMilliseconds,
		totalMilliseconds,
		runCount: panicRuns.length
	};
}

function buildPanicLog({ day, panicRuns, timezoneOffsetMinutes, now = new Date() }) {
	return panicRuns
		.map((panicRun) => {
			const clippedWindow = getClippedPanicWindow(panicRun, {
				day,
				timezoneOffsetMinutes,
				now
			});

			if (clippedWindow.milliseconds <= 0) {
				return null;
			}

			return serializePanicLogItem(panicRun, clippedWindow);
		})
		.filter(Boolean);
}

function getPanicWindowSegmentsForWindow({
	panicRuns,
	startedAt,
	endedAt,
	now = new Date(),
	includeOpenRuns = true
}) {
	if (!startedAt || !endedAt || endedAt <= startedAt || panicRuns.length === 0) {
		return [];
	}

	return panicRuns
		.map((panicRun) => {
			if (!includeOpenRuns && !panicRun.endedAt) {
				return null;
			}

			const panicEndedAt = panicRun.endedAt || now;
			const effectiveStartedAt = new Date(
				Math.max(startedAt.getTime(), panicRun.startedAt.getTime())
			);
			const effectiveEndedAt = new Date(
				Math.min(endedAt.getTime(), panicEndedAt.getTime())
			);
			const milliseconds = Math.max(
				0,
				effectiveEndedAt.getTime() - effectiveStartedAt.getTime()
			);

			if (milliseconds <= 0) {
				return null;
			}

			return {
				panicRun,
				effectiveStartedAt,
				effectiveEndedAt,
				milliseconds
			};
		})
		.filter(Boolean);
}

function buildPanicLogItemsForWindow({
	panicRuns,
	startedAt,
	endedAt,
	now = new Date(),
	includeOpenRuns = true
}) {
	return getPanicWindowSegmentsForWindow({
		panicRuns,
		startedAt,
		endedAt,
		now,
		includeOpenRuns
	}).map(({ panicRun, effectiveStartedAt, effectiveEndedAt, milliseconds }) =>
		serializePanicLogItem(panicRun, {
			effectiveStartedAt,
			effectiveEndedAt,
			milliseconds
		})
	);
}

function getPanicMillisecondsForWindow({ panicRuns, startedAt, endedAt, now = new Date() }) {
	return mergeWindowSegments(
		getPanicWindowSegmentsForWindow({
		panicRuns,
		startedAt,
		endedAt,
		now
		})
	).reduce((total, panicItem) => total + panicItem.milliseconds, 0);
}

module.exports = {
	buildPanicLogItemsForWindow,
	buildPanicLog,
	buildPanicStatus,
	getPanicMillisecondsForWindow,
	loadOpenPanicRuns,
	loadPanicRunsForDay,
	loadPanicRunsOverlappingLocalDay,
	loadPanicRunsOverlappingWindow,
	serializedPanicLogItemJsonSchema,
	serializedPanicStatusJsonSchema
};
