# task-monster backend

## Overview

The backend is a Fastify server backed by MongoDB. It owns the real business logic for:

- auth and session validation
- task creation and task-state transitions
- active run tracking in `task_runs`
- panic logging in `panic_runs`
- limited shortcut-token quick actions for iOS/Apple Watch
- newest-to-oldest done feeds, daily stats summaries, and heatmap batches

## Commands

- Install: `npm install`
- Dev: `npm run dev`
- Start: `npm start`

## Config

The backend now treats the repo root `.env` as the canonical env source.

- canonical runtime env file: `../.env`
- tracked template: `../.env.example`
- backend-local env files are no longer the source of truth

At startup, the backend loads the root `.env` and then reads from `process.env` in `lib/config.js`.

- `HOST`
  - default: `127.0.0.1`
- `PORT`
  - default: `3001`
- `MONGO_URL`
  - default: `mongodb://127.0.0.1:27017`
- `MONGO_DB_NAME`
  - default: `task-monster`

## Structure

- `index.js`
  - builds the Fastify app, connects to Mongo, installs hooks, and registers routes
- `lib/`
  - shared logic
- `routes/`
  - one file per route, auto-registered recursively

## Main collections

- `users`
- `sessions`
- `login_attempts`
- `login_events`
- `tasks`
- `task_runs`
- `panic_runs`
- `quick_action_tokens`

Indexes are created on startup in `lib/mongo.js`.

## Auth and sessions

- Most routes require `Authorization: Bearer <token>`
- Public exceptions:
  - `GET /ping`
  - `POST /users`
  - `POST /sessions/login`
- Session/profile route:
  - `GET /login-attempts`
  - returns recent login-event history for the profile page
- User preference route:
  - `PATCH /users/theme`
  - stores the selected theme on `users.theme`
- Shortcut token management routes:
  - `GET /quick-tokens`
  - `POST /quick-tokens`
  - `DELETE /quick-tokens/:tokenId`
  - normal bearer-session auth is required
- Quick action routes:
  - `POST /api/quick/stop`
  - `POST /api/quick/next`
  - `POST /api/quick/start`
  - use `tmq_live_*` shortcut tokens only; normal session tokens are not accepted
- Session verification:
  - `GET /whoami`
  - returns `id`, `username`, and `theme`
- Passwords are hashed with salted `scrypt`
- Session tokens are not stored raw
  - only SHA-256 token hashes are stored
- Shortcut tokens are not stored raw
  - only SHA-256 token hashes plus the token preview are stored
- Account creation currently requires alpha code `gyarados`
- Account creation also requires `acceptedLegalTerms === true`
- New users currently store legal acceptance metadata on `users.legalAcceptance`:
  - `acceptedAt`
  - `version`
- if the legal pages materially change, bump `LEGAL_DOCUMENTS_VERSION` in `routes/users/create.js`
- Failed login attempts are rate-limited and written to `login_attempts`
- Login outcomes are written to `login_events`

## Task model

Tasks support:

- modes:
  - `one-time`
  - `repeatable`
- tracking types:
  - `time`
  - `tally`

Important task-state fields:

- `mappedToday`
- `activeToday`
- `queuePosition`
- `daymapLocked`
- `daymapWeekdays`
- `skippedLocalDay`
- `activatedAt`
- `lastStartedAt`
- `activeTallyCount`
- `lastCompletedTallyCount`
- `nextDueAt`
- `lastCompletedAt`
- `lastInactivatedAt`

Notes:

- `tasks.note` is the template-level task note
- `task_runs.instanceNote` is the per-run note

## Task lifecycle

- Create:
  - `POST /tasks`
- Move to daymap:
  - `POST /tasks/:taskId/daymap`
- Remove from daymap:
  - `POST /tasks/:taskId/unmap`
- Pin or unpin daymap membership:
  - `PATCH /tasks/:taskId/daymap-pin`
- Skip or unskip the current local day:
  - `PATCH /tasks/:taskId/day-skip`
  - stores a local-day skip marker without creating a `task_runs` history record
- Queue:
  - `POST /tasks/:taskId/queue`
- Unqueue:
  - `POST /tasks/:taskId/unqueue`
- Activate:
  - `POST /tasks/:taskId/activate`
  - opens a `task_runs` record
- Inactivate:
  - `POST /tasks/:taskId/inactivate`
  - closes the open run as `inactive`
- Cancel active:
  - `POST /tasks/:taskId/cancel-active`
  - deletes the open run and returns the task to daymap without writing inactive history
- Done:
  - `POST /tasks/:taskId/done`
  - closes the open run as `done`
  - accepts optional `startedAt`, `completedAt`, `instanceNote`, and `nextDueAt`
  - inactive or daymap tasks can be historically completed only when both `startedAt` and `completedAt` are supplied
- Archive:
  - `POST /tasks/:taskId/archive`
  - only valid for inactive tasks

Done semantics:

- one-time tasks archive immediately
- repeatable tasks return to inactive unless `daymapLocked === true`
- repeatable locked tasks return to daymap after done
- `daymap-pin` sets `daymapLocked` for repeatable tasks when starred/pinned

Queue semantics:

- active tasks cannot be queued
- queue order uses `queuePosition`
- queueing a scheduled-only Day Map task materializes it with `mappedToday: true` before assigning queue order
- when the last active task is removed by `done` or `inactivate`, the backend auto-activates the next queued daymap task if one exists
- canceling an active task is treated as an undo and does not auto-activate the next queued task

Quick action semantics:

- quick stop marks all active task runs `done`, applies normal Done task-state updates, and starts nothing
- quick next marks all active task runs `done`, applies normal Done task-state updates, then activates the first queued Day Map task by queue order
- quick start accepts `{ "taskId": "<task id>" }`, marks other active task runs `done`, then activates that task
- quick stop returns `message: "All active tasks marked done"`
- quick next returns `message: "Next Task: <title>"` when a queued task starts, otherwise `message: "No next task queued"`
- quick start returns `message: "<title> active"`
- quick start requires `tasks:start`; legacy quick tokens with `tasks:next` are accepted for compatibility
- all quick actions append `-- Ended with shortcut` to the bottom of each completed run's instance note
- all quick actions derive `userId` from the shortcut token, never from the request body

## Active runtime behavior

- Active list route:
  - `GET /tasks/active`
- Time tasks record active runtime and history only
- Tally updates:
  - `POST /tasks/:taskId/tally`
- Task note updates:
  - `PATCH /tasks/:taskId/note`
- Active run instance note updates:
  - `PATCH /tasks/:taskId/instance-note`
- Broad task edits:
  - `PATCH /tasks/:taskId`
  - supports metadata edits, note, next due, daymap lock, tracking type, tally fields, and active started-time changes

The active list derives and returns:

- `panicMilliseconds`
- `effectiveMilliseconds`
- `taskPanicLog`

## Panic

- Routes:
  - `GET /panic/status`
  - `POST /panic/start`
  - `POST /panic/stop`
- Panic logs are stored in `panic_runs`
- Panic mode does not currently pause tasks automatically
- Instead, panic overlap is subtracted from effective task time in active, done, and stats responses

## History and stats

- Done history:
  - `GET /tasks/done`
  - without `day`, returns newest-to-oldest completed runs with `limit`, `cursor`, `nextCursor`, and `hasMore`
  - with `day`, returns a local day's completed runs for compatibility
- Daily stats:
  - `GET /stats/daily`
- Heatmap stats:
  - `GET /stats/heatmap`
  - returns clipped task-run sessions for local day batches; default count is 10 days, max is 31

Daily stats are local-day aware through `day` and `tzOffsetMinutes`.
Done history and heatmap requests use `tzOffsetMinutes`; heatmap batches use `startDay` and `count`.

Daily stats are derived from:

- `task_runs`
- `panic_runs`

Current daily stats output includes:

- summary
- overlap bands
- task breakdown
- hourly cadence
- panic log
- done log
- session log

The current `/stats` frontend page uses `GET /stats/heatmap`, not the daily report UI. The daily endpoint remains available for future UI.

## Current quirk

Fastify/Ajv currently emits strict-mode warnings at startup for schemas that use `type: ['integer', 'string']` around `tzOffsetMinutes`. The app still boots.

## Verification

- there is no automated test suite yet
- current cheap smoke check is booting the server against a reachable Mongo instance
