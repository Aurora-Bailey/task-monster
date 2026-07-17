const assert = require('node:assert/strict');
const test = require('node:test');

const {
	SHORTCUT_INSTANCE_NOTE,
	appendShortcutInstanceNote,
	countQuickActionNoteWords,
	validateQuickActionNotes
} = require('../lib/quick-actions');

test('shortcut notes preserve existing instance notes and marker ordering', () => {
	assert.equal(appendShortcutInstanceNote(null), SHORTCUT_INSTANCE_NOTE);
	assert.equal(
		appendShortcutInstanceNote(null, '  Finished the requested work.  '),
		`Finished the requested work.\n\n${SHORTCUT_INSTANCE_NOTE}`
	);
	assert.equal(
		appendShortcutInstanceNote('Existing session context.\n', '  Finished the requested work.  '),
		`Existing session context.\n\nFinished the requested work.\n\n${SHORTCUT_INSTANCE_NOTE}`
	);
	assert.equal(
		appendShortcutInstanceNote('Existing session context.\n', ' \n\t '),
		`Existing session context.\n\n${SHORTCUT_INSTANCE_NOTE}`
	);
});

test('shortcut note validation accepts optional and boundary-sized values', () => {
	assert.deepEqual(validateQuickActionNotes(undefined), {
		ok: true,
		notes: null
	});
	assert.deepEqual(validateQuickActionNotes(null), { ok: true, notes: null });
	assert.deepEqual(validateQuickActionNotes(' \n\t '), {
		ok: true,
		notes: null
	});
	assert.deepEqual(validateQuickActionNotes('  concise note  '), {
		ok: true,
		notes: 'concise note'
	});
	assert.equal(validateQuickActionNotes(Array(500).fill('word').join(' ')).ok, true);
	assert.equal(validateQuickActionNotes('a'.repeat(4000)).ok, true);
	assert.equal(countQuickActionNoteWords('one\ntwo\tthree'), 3);
});

test('shortcut note validation rejects invalid or oversized values', () => {
	assert.deepEqual(validateQuickActionNotes({ note: 'nope' }), {
		ok: false,
		error: 'invalid_notes',
		message: 'Notes must be a string.'
	});
	assert.deepEqual(validateQuickActionNotes(Array(501).fill('word').join(' ')), {
		ok: false,
		error: 'notes_too_long',
		message: 'Notes must be 500 words or fewer.'
	});
	assert.deepEqual(validateQuickActionNotes('a'.repeat(4001)), {
		ok: false,
		error: 'notes_too_long',
		message: 'Notes must be 4,000 characters or fewer.'
	});
});
