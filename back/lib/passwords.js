const { randomBytes, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

async function hashPassword(password) {
	const salt = randomBytes(16).toString('hex');
	const derivedKey = await scryptAsync(password, salt, KEY_LENGTH);

	return `scrypt:${salt}:${Buffer.from(derivedKey).toString('hex')}`;
}

async function verifyPassword(password, storedHash) {
	const [algorithm, salt, hash] = storedHash.split(':');

	if (algorithm !== 'scrypt' || !salt || !hash) {
		return false;
	}

	const derivedKey = await scryptAsync(password, salt, KEY_LENGTH);
	const derivedBuffer = Buffer.from(derivedKey);
	const storedBuffer = Buffer.from(hash, 'hex');

	if (derivedBuffer.length !== storedBuffer.length) {
		return false;
	}

	return timingSafeEqual(derivedBuffer, storedBuffer);
}

module.exports = {
	hashPassword,
	verifyPassword
};
