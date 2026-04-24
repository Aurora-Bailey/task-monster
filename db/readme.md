# db scratch area

This directory is not part of the main runtime.

Use it for:

- notes
- import/export experiments
- ad hoc database scratch work

Do not treat anything here as authoritative application behavior.

The real runtime database integration lives in:

- `back/lib/mongo.js`
- `back/lib/tasks.js`
- `back/lib/task-runs.js`
- `back/lib/panic.js`

If you need the actual app model, read `AGENTS.md` and the backend code instead of this folder.
