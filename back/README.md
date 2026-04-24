# task-monster backend

## Overview

The backend is a Fastify server backed by MongoDB. It owns the real business logic for:

- auth and session validation
- task creation and task-state transitions
- active run tracking in `task_runs`
- panic logging in `panic_runs`
- done history and daily stats

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

Indexes are created on startup in `lib/mongo.js`.

## Auth and sessions

- Most routes require `Authorization: Bearer <token>`
- Public exceptions:
  - `GET /ping`
  - `POST /users`
  - `POST /sessions/login`
- Passwords are hashed with salted `scrypt`
- Session tokens are not stored raw
  - only SHA-256 token hashes are stored
- Account creation currently requires alpha code `gyarados`
- Account creation also requires `acceptedLegalTerms === true`
- New users currently store legal acceptance metadata on `users.legalAcceptance`:
  - `acceptedAt`
  - `version`
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
- `activatedAt`
- `alarmDueAt`
- `activeTallyCount`

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
- Done:
  - `POST /tasks/:taskId/done`
  - closes the open run as `done`
- Archive:
  - `POST /tasks/:taskId/archive`
  - only valid for inactive tasks

Done semantics:

- one-time tasks archive immediately
- repeatable tasks return to inactive unless `daymapLocked === true`
- repeatable locked tasks return to daymap after done

Queue semantics:

- only daymap tasks can be queued
- queue order uses `queuePosition`
- when the last active task is removed by `done` or `inactivate`, the backend auto-activates the next queued daymap task if one exists

## Active runtime behavior

- Active list route:
  - `GET /tasks/active`
- Tally updates:
  - `POST /tasks/:taskId/tally`
- Snooze:
  - `POST /tasks/:taskId/snooze`
- Task note updates:
  - `PATCH /tasks/:taskId/note`
- Active run instance note updates:
  - `PATCH /tasks/:taskId/instance-note`

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
- Daily stats:
  - `GET /stats/daily`

Both are local-day aware through `day` and `tzOffsetMinutes`.

Daily stats are derived from:

- `task_runs`
- `panic_runs`

Current stats output includes:

- summary
- overlap bands
- task breakdown
- hourly cadence
- panic log
- done log
- session log

## Current quirk

Fastify/Ajv currently emits strict-mode warnings at startup for schemas that use `type: ['integer', 'string']` around `tzOffsetMinutes`. The app still boots.

## Verification

- there is no automated test suite yet
- current cheap smoke check is booting the server against a reachable Mongo instance
