const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS_PER_IP_AND_USERNAME = 10;
const MAX_FAILED_ATTEMPTS_PER_IP = 50;

function getAttemptsCollection(db) {
	return db.collection('login_attempts');
}

function getWindowStart(now) {
	return new Date(now.getTime() - LOGIN_WINDOW_MS);
}

async function findRetryAt(collection, filter, count, limit) {
	const attemptsToExpire = count - limit + 1;

	if (attemptsToExpire <= 0) {
		return null;
	}

	const blockingAttempt = await collection
		.find(filter, {
			projection: {
				expireAt: 1
			}
		})
		.sort({ createdAt: 1 })
		.skip(attemptsToExpire - 1)
		.limit(1)
		.next();

	return blockingAttempt?.expireAt || null;
}

function chooseLaterDate(left, right) {
	if (!left) {
		return right;
	}

	if (!right) {
		return left;
	}

	return left.getTime() >= right.getTime() ? left : right;
}

async function getLoginRateLimitState(db, { ipAddress, usernameLower, now = new Date() }) {
	const attempts = getAttemptsCollection(db);
	const windowStart = getWindowStart(now);
	const ipFilter = {
		ipAddress,
		createdAt: {
			$gte: windowStart
		}
	};
	const ipAndUsernameFilter = {
		...ipFilter,
		usernameLower
	};

	const [ipAndUsernameCount, ipCount] = await Promise.all([
		attempts.countDocuments(ipAndUsernameFilter),
		attempts.countDocuments(ipFilter)
	]);

	let retryAt = null;

	if (ipAndUsernameCount >= MAX_FAILED_ATTEMPTS_PER_IP_AND_USERNAME) {
		retryAt = chooseLaterDate(
			retryAt,
			await findRetryAt(
				attempts,
				ipAndUsernameFilter,
				ipAndUsernameCount,
				MAX_FAILED_ATTEMPTS_PER_IP_AND_USERNAME
			)
		);
	}

	if (ipCount >= MAX_FAILED_ATTEMPTS_PER_IP) {
		retryAt = chooseLaterDate(
			retryAt,
			await findRetryAt(attempts, ipFilter, ipCount, MAX_FAILED_ATTEMPTS_PER_IP)
		);
	}

	if (!retryAt) {
		return {
			isLimited: false,
			retryAfterSeconds: 0,
			retryAt: null
		};
	}

	return {
		isLimited: true,
		retryAfterSeconds: Math.max(1, Math.ceil((retryAt.getTime() - now.getTime()) / 1000)),
		retryAt
	};
}

async function recordFailedLoginAttempt(db, { ipAddress, usernameLower, userAgent, now = new Date() }) {
	const attempts = getAttemptsCollection(db);

	await attempts.insertOne({
		ipAddress,
		usernameLower,
		userAgent: userAgent || null,
		createdAt: now,
		expireAt: new Date(now.getTime() + LOGIN_WINDOW_MS)
	});
}

async function clearFailedLoginAttempts(db, { ipAddress, usernameLower }) {
	await getAttemptsCollection(db).deleteMany({
		ipAddress,
		usernameLower
	});
}

module.exports = {
	clearFailedLoginAttempts,
	getLoginRateLimitState,
	recordFailedLoginAttempt
};
